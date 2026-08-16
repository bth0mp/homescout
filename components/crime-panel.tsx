"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrimeMapLink } from "@/lib/crime";
import { CATEGORY_LABEL, COVERAGE_LABEL, type CrimeResult } from "@/lib/crime/types";

type Report = {
  result: CrimeResult | null;
  links: CrimeMapLink[];
  skipped: Array<{ name: string; reason: string }>;
  cachedAt?: string;
};

/** 12-month trend. Inline SVG — a chart library for one polyline is not worth it. */
function Sparkline({ points }: { points: Array<{ month: string; count: number }> }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.count), 1);
  const w = 100;
  const h = 24;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(h - (p.count / max) * h).toFixed(2)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-8 w-full"
        role="img"
        aria-label={`Monthly incident trend, ${first.month} (${first.count}) to ${last.month} (${last.count}). Peak ${max}.`}
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="text-sky-500" />
      </svg>
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>{first.month}</span>
        <span>peak {max}/mo</span>
        <span>{last.month}</span>
      </div>
    </div>
  );
}

function CoverageBadge({ result }: { result: CrimeResult }) {
  const tone =
    result.coverage === "incident"
      ? "default"
      : result.coverage === "none"
        ? "outline"
        : "secondary";
  return <Badge variant={tone as "default"}>{COVERAGE_LABEL[result.coverage]}</Badge>;
}

export function CrimePanel({ propertyId, geocoded }: { propertyId: number; geocoded: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!geocoded) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    fetch(`/api/crime?propertyId=${propertyId}`, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<Report>;
      })
      .then(setReport)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [propertyId, geocoded]);

  if (!geocoded) {
    return (
      <p className="text-muted-foreground text-sm">
        Add a street, city and state so the address can be geocoded — crime lookup needs
        coordinates.
      </p>
    );
  }

  if (loading) return <p className="text-muted-foreground text-sm">Looking up crime data…</p>;
  if (error) return <p className="text-destructive text-sm">Crime lookup failed: {error}</p>;
  if (!report) return null;

  const r = report.result;

  return (
    <div className="space-y-4">
      {r ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{r.areaName}</CardTitle>
              <CoverageBadge result={r} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* The most important sentence on this tab: what the numbers actually describe. */}
            <p
              className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                r.coverage === "incident"
                  ? "border-border text-muted-foreground"
                  : "border-amber-500/40 text-amber-600 dark:text-amber-500"
              }`}
            >
              {r.coverage === "incident" ? (
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              )}
              <span>{r.coverageNote}</span>
            </p>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground text-sm">
                  Reported incidents, last {r.periodMonths} months
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {r.total.toLocaleString()}
                </span>
              </div>
              {r.radiusMiles ? (
                <p className="text-muted-foreground text-xs">
                  Within about {r.radiusMiles} mile{r.radiusMiles === 1 ? "" : "s"} of the address.
                </p>
              ) : null}
            </div>

            {r.totals.length > 0 ? (
              <dl className="divide-border/60 divide-y text-sm">
                {r.totals.map((t) => (
                  <div key={t.category} className="flex justify-between py-1">
                    <dt className="text-muted-foreground">{CATEGORY_LABEL[t.category]}</dt>
                    <dd className="tabular-nums">{t.count.toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {r.monthly.some((m) => m.count > 0) ? <Sparkline points={r.monthly} /> : null}

            {r.ratePer100k !== undefined ? (
              <dl className="divide-border/60 divide-y text-sm">
                <div className="flex justify-between py-1">
                  <dt className="text-muted-foreground">Per 100k residents / year</dt>
                  <dd className="tabular-nums">{r.ratePer100k.toLocaleString()}</dd>
                </div>
                {r.stateRatePer100k !== undefined ? (
                  <div className="flex justify-between py-1">
                    <dt className="text-muted-foreground">State average</dt>
                    <dd className="tabular-nums">{r.stateRatePer100k.toLocaleString()}</dd>
                  </div>
                ) : null}
                {r.nationalRatePer100k !== undefined ? (
                  <div className="flex justify-between py-1">
                    <dt className="text-muted-foreground">National average</dt>
                    <dd className="tabular-nums">{r.nationalRatePer100k.toLocaleString()}</dd>
                  </div>
                ) : null}
              </dl>
            ) : r.coverage === "incident" ? (
              <p className="text-muted-foreground text-xs">
                No per-capita rate shown: the resident population of a {r.radiusMiles}-mile radius
                is unknown, and dividing by the whole city&rsquo;s population would be wrong by
                orders of magnitude.
              </p>
            ) : null}

            {r.notes?.map((n) => (
              <p key={n} className="text-muted-foreground text-xs">
                {n}
              </p>
            ))}

            <p className="text-muted-foreground text-xs">
              Source:{" "}
              <a
                href={r.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline underline-offset-2"
              >
                {r.providerName}
              </a>
              {r.lastUpdated ? ` · data through ${r.lastUpdated}` : ""}
              {report.cachedAt
                ? ` · fetched ${new Date(report.cachedAt).toLocaleString()}`
                : " · fetched just now"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No local crime data available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Nothing here publishes incident data we can query for this address. Rather than show
              you a number borrowed from a wider area, here is where to look directly.
            </p>
            {report.skipped.map((s) => (
              <p key={s.name} className="text-muted-foreground text-xs">
                <span className="font-medium">{s.name}:</span> {s.reason}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check these directly</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {report.links.map((l) => (
              <a
                key={l.id}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {l.label}
                <ExternalLink aria-hidden className="size-3" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ))}
          </div>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {report.links
              .filter((l) => l.note)
              .map((l) => (
                <li key={l.id}>
                  <span className="font-medium">{l.label}:</span> {l.note}
                </li>
              ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
