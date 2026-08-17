import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { deleteProperty, updateProperty } from "@/app/actions";
import { CrimePanel } from "@/components/crime-panel";
import { FinancingPanel } from "@/components/financing-panel";
import { OpenInRow } from "@/components/open-in-row";
import { PropertyForm } from "@/components/property-form";
import { PhotoPicker } from "@/components/photo-picker";
import { PropertyMap } from "@/components/property-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDb } from "@/lib/db";
import { properties, scenarios } from "@/lib/db/schema";
import { money } from "@/lib/parse";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-medium">{value}</dd>
    </div>
  );
}

export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const p = getDb().select().from(properties).where(eq(properties.id, id)).get();
  if (!p) notFound();

  const propertyScenarios = getDb()
    .select()
    .from(scenarios)
    .where(eq(scenarios.propertyId, id))
    .all();

  // Seed a first scenario from whatever was used most recently anywhere. Rate,
  // term and the VA flags are properties of the buyer, not of the house — a
  // funding-fee-exempt veteran should not re-tick the box for every listing.
  const lastUsed = getDb()
    .select()
    .from(scenarios)
    .orderBy(desc(scenarios.createdAt))
    .limit(1)
    .get();

  const updateThis = updateProperty.bind(null, p.id);
  const deleteThis = deleteProperty.bind(null, p.id);
  const perSqft = p.sqft && p.listPrice ? p.listPrice / p.sqft : null;
  const addressLine = [p.street, p.city, p.state, p.zip].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          ← All properties
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{p.nickname}</h1>
          <Badge variant="secondary">{p.status}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">{addressLine || "No address yet"}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financing">Financing</TabsTrigger>
          <TabsTrigger value="crime">Crime</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          {/* Labelled "Edit" too: the edit form lives here, and nobody looks
              for it under a tab called "Notes". */}
          <TabsTrigger value="notes">Edit &amp; notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="List price" value={p.listPrice ? money(p.listPrice) : "—"} />
              <Stat label="$/sq ft" value={perSqft ? money(perSqft) : "—"} />
              <Stat label="Tax / yr" value={p.propertyTaxAnnual ? money(p.propertyTaxAnnual) : "—"} />
              <Stat label="HOA / mo" value={p.hoaMonthly ? money(p.hoaMonthly) : "—"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoPicker propertyId={p.id} hasPhoto={Boolean(p.photoType)} nickname={p.nickname} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {p.lat != null && p.lng != null ? (
                <div className="space-y-3">
                  <PropertyMap
                    pins={[
                      {
                        id: p.id,
                        lat: p.lat,
                        lng: p.lng,
                        label: p.nickname,
                        sublabel: addressLine,
                        price: p.listPrice || undefined,
                        status: p.status,
                      },
                    ]}
                    height="18rem"
                    zoom={15}
                  />
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground text-xs">Coordinates</dt>
                    <dd className="font-mono">
                      {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Census tract (FIPS)</dt>
                    <dd className="font-mono">
                      {p.fipsState && p.fipsCounty && p.fipsTract
                        ? `${p.fipsState}${p.fipsCounty}${p.fipsTract}`
                        : "Not available — geocoded without tract data"}
                    </dd>
                  </div>
                </dl>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Not geocoded. Add a street, city and state, then save.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financing" className="pt-4">
          <FinancingPanel property={p} scenarios={propertyScenarios} lastUsed={lastUsed ?? null} />
        </TabsContent>
        <TabsContent value="crime" className="pt-4">
          <CrimePanel propertyId={p.id} geocoded={p.lat != null && p.lng != null} />
        </TabsContent>
        <TabsContent value="links" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open in…</CardTitle>
            </CardHeader>
            <CardContent>
              <OpenInRow
                target={{
                  street: p.street,
                  city: p.city,
                  state: p.state,
                  zip: p.zip,
                  lat: p.lat,
                  lng: p.lng,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit</CardTitle>
            </CardHeader>
            <CardContent>
              <PropertyForm action={updateThis} property={p} submitLabel="Save changes" />
            </CardContent>
          </Card>
          <form action={deleteThis}>
            <Button type="submit" variant="destructive" size="sm">
              Delete property
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
