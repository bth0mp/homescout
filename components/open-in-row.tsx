import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LAST_VERIFIED, buildLinks, type LinkTarget } from "@/lib/listing-links";

const GROUP_LABEL = {
  listing: "Listing sites",
  map: "Maps",
  "public-record": "Public records",
} as const;

export function OpenInRow({ target }: { target: LinkTarget }) {
  const links = buildLinks(target);

  if (links.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add a street and city (or ZIP) to build listing links.
      </p>
    );
  }

  const groups = (["listing", "map", "public-record"] as const)
    .map((g) => ({ group: g, items: links.filter((l) => l.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map(({ group, items }) => (
        <div key={group}>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            {GROUP_LABEL[group]}
          </h3>
          <div className="flex flex-wrap gap-2">
            {items.map((l) => (
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
        </div>
      ))}
      <p className="text-muted-foreground text-xs">
        These are search links built from the address, not listing IDs — HomeScout does not scrape
        or query these sites. Some will land on the exact home, some on the neighborhood. Patterns
        last checked {LAST_VERIFIED}; fix them in{" "}
        <code className="text-foreground">lib/listing-links.ts</code>.
      </p>
    </div>
  );
}
