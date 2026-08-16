import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteProperty, updateProperty } from "@/app/actions";
import { PropertyForm } from "@/components/property-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { properties } from "@/lib/db/schema";
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

  const p = db.select().from(properties).where(eq(properties.id, id)).get();
  if (!p) notFound();

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
          <TabsTrigger value="notes">Notes</TabsTrigger>
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
              <CardTitle className="text-base">Location</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {p.lat != null && p.lng != null ? (
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
              ) : (
                <p className="text-muted-foreground">
                  Not geocoded. Add a street, city and state, then save.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financing" className="pt-4">
          <p className="text-muted-foreground text-sm">VA calculator lands in milestone 3.</p>
        </TabsContent>
        <TabsContent value="crime" className="pt-4">
          <p className="text-muted-foreground text-sm">Crime lookup lands in milestone 5.</p>
        </TabsContent>
        <TabsContent value="links" className="pt-4">
          <p className="text-muted-foreground text-sm">Listing deep links land in milestone 2.</p>
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
