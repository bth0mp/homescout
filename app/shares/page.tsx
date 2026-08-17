import { desc } from "drizzle-orm";
import { createShare, revokeShare } from "@/app/actions";
import { CopyLink } from "@/components/copy-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { propertyColumns, properties, shareLinks } from "@/lib/db/schema";
import { EXPIRY_CHOICES, shareState } from "@/lib/share";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shares — HomeScout" };

export default function SharesPage() {
  const db = getDb();
  const links = db.select().from(shareLinks).orderBy(desc(shareLinks.createdAt)).all();
  const props = db.select(propertyColumns).from(properties).orderBy(desc(properties.createdAt)).all();

  const origin = process.env.APP_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Share links</h1>
        <p className="text-muted-foreground text-sm">
          Read-only links anyone can open without signing in. Notes marked private are never
          included.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New link</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createShare} className="grid gap-4 sm:grid-cols-4">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="sh-label">Label</Label>
              <Input id="sh-label" name="label" placeholder="For my agent" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sh-property">Shares</Label>
              <select
                id="sh-property"
                name="propertyId"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">The whole board</option>
                {props.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sh-expiry">Expires</Label>
              <select
                id="sh-expiry"
                name="expiryHours"
                defaultValue={String(EXPIRY_CHOICES[1].hours)}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                {EXPIRY_CHOICES.map((c) => (
                  <option key={c.label} value={c.hours}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4">
              <Button type="submit">Create link</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing links</CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-muted-foreground text-sm">No share links yet.</p>
          ) : (
            <ul className="divide-border/60 divide-y">
              {links.map((l) => {
                const state = shareState(l);
                const target = props.find((p) => p.id === l.propertyId);
                const url = `${origin}/s/${l.token}`;
                return (
                  <li key={l.token} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{l.label || "Untitled"}</span>
                        <Badge variant={state === "valid" ? "default" : "outline"}>{state}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {target ? target.nickname : "whole board"}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate font-mono text-xs">
                        {origin ? url : `/s/${l.token}`}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        created {l.createdAt.toLocaleDateString()}
                        {l.expiresAt ? ` · expires ${l.expiresAt.toLocaleDateString()}` : " · never expires"}
                      </p>
                    </div>
                    {state === "valid" ? (
                      <div className="flex gap-2">
                        <CopyLink url={origin ? url : `/s/${l.token}`} />
                        <form action={revokeShare.bind(null, l.token)}>
                          <Button type="submit" variant="destructive" size="sm">
                            Revoke
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {!origin ? (
            <p className="text-muted-foreground mt-4 text-xs">
              Set <code className="text-foreground">APP_URL</code> so links render with their full
              public address.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
