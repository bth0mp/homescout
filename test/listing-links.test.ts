import { describe, expect, it } from "vitest";
import { buildLinks, type LinkTarget } from "@/lib/listing-links";

const full: LinkTarget = {
  street: "1600 Pennsylvania Avenue NW",
  city: "Washington",
  state: "DC",
  zip: "20500",
  lat: 38.8987,
  lng: -77.0352,
};

describe("buildLinks", () => {
  it("builds every provider when the address and coords are complete", () => {
    const ids = buildLinks(full).map((l) => l.id);
    expect(ids).toEqual([
      "zillow",
      "redfin",
      "realtor",
      "trulia",
      "homes",
      "google-maps",
      "street-view",
      "county-appraiser",
    ]);
  });

  it("slugs the address for path-style providers", () => {
    const byId = Object.fromEntries(buildLinks(full).map((l) => [l.id, l.href]));
    expect(byId.zillow).toBe(
      "https://www.zillow.com/homes/1600-Pennsylvania-Avenue-NW-Washington-DC-20500_rb/",
    );
    expect(byId.realtor).toContain("/1600-Pennsylvania-Avenue-NW-Washington-DC-20500");
  });

  it("encodes the address for query-style providers", () => {
    const byId = Object.fromEntries(buildLinks(full).map((l) => [l.id, l.href]));
    expect(byId.redfin).toContain(encodeURIComponent("1600 Pennsylvania Avenue NW, Washington, DC"));
    expect(byId.redfin).not.toContain(" ");
  });

  it("prefers coordinates over the address for maps", () => {
    const byId = Object.fromEntries(buildLinks(full).map((l) => [l.id, l.href]));
    expect(byId["google-maps"]).toContain(encodeURIComponent("38.8987,-77.0352"));
    expect(byId["street-view"]).toContain("viewpoint=38.8987,-77.0352");
  });

  it("drops providers whose inputs are missing rather than emitting a broken URL", () => {
    const noCoords = buildLinks({ ...full, lat: null, lng: null }).map((l) => l.id);
    expect(noCoords).not.toContain("street-view");
    // Maps falls back to the text address.
    expect(noCoords).toContain("google-maps");

    const noStreet = buildLinks({ ...full, street: "" }).map((l) => l.id);
    expect(noStreet).not.toContain("zillow");
    expect(noStreet).not.toContain("redfin");

    const nothing = buildLinks({ street: "", city: "", state: "", zip: "", lat: null, lng: null });
    expect(nothing).toEqual([]);
  });

  it("never emits an http: or relative URL", () => {
    for (const l of buildLinks(full)) {
      expect(l.href.startsWith("https://")).toBe(true);
    }
  });
});
