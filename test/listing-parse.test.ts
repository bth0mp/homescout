import { describe, expect, it } from "vitest";
import { parseListingUrl } from "@/lib/listing-parse";

describe("parseListingUrl", () => {
  it("reads the address straight out of a Redfin URL", () => {
    const r = parseListingUrl(
      "https://www.redfin.com/WA/Wenatchee/908-N-Elliott-Ave-98801/home/75131851",
    );
    expect(r).toMatchObject({
      provider: "redfin",
      addressLine: "908 N Elliott Ave, Wenatchee, WA 98801",
      listingId: "75131851",
    });
  });

  it("keeps the directional the Census geocoder would drop", () => {
    const r = parseListingUrl(
      "https://www.redfin.com/WA/Wenatchee/908-N-Elliott-Ave-98801/home/75131851",
    );
    // Census answers "908 ELLIOTT AVE" for this address; the listing URL is the
    // better source for the street, since the deep links are built from it.
    expect(r?.parts).toEqual({
      street: "908 N Elliott Ave",
      city: "Wenatchee",
      state: "WA",
      zip: "98801",
    });
  });

  it("only claims split parts when the URL is unambiguous", () => {
    const realtor = parseListingUrl(
      "https://www.realtor.com/realestateandhomes-detail/908-N-Elliott-Ave_Wenatchee_WA_98801_M12345-67890",
    );
    expect(realtor?.parts?.street).toBe("908 N Elliott Ave");
    expect(realtor?.parts?.state).toBe("WA");

    // Zillow/Trulia mash city into the slug with no delimiter, so no parts.
    expect(
      parseListingUrl(
        "https://www.zillow.com/homedetails/908-N-Elliott-Ave-Wenatchee-WA-98801/75131851_zpid/",
      )?.parts,
    ).toBeUndefined();
  });

  it("handles a Redfin unit URL", () => {
    const r = parseListingUrl(
      "https://www.redfin.com/WA/Seattle/123-Main-St-98101/unit-4B/home/123456",
    );
    expect(r?.addressLine).toBe("123 Main St Unit 4B, Seattle, WA 98101");
    expect(r?.listingId).toBe("123456");
  });

  it("reads Zillow", () => {
    const r = parseListingUrl(
      "https://www.zillow.com/homedetails/908-N-Elliott-Ave-Wenatchee-WA-98801/75131851_zpid/",
    );
    expect(r?.provider).toBe("zillow");
    expect(r?.addressLine).toBe("908 N Elliott Ave Wenatchee WA 98801");
    expect(r?.listingId).toBe("75131851");
  });

  it("reads Realtor.com and drops the M-prefixed id from the address", () => {
    const r = parseListingUrl(
      "https://www.realtor.com/realestateandhomes-detail/908-N-Elliott-Ave_Wenatchee_WA_98801_M12345-67890",
    );
    expect(r?.provider).toBe("realtor");
    expect(r?.addressLine).toBe("908 N Elliott Ave, Wenatchee, WA, 98801");
    expect(r?.addressLine).not.toContain("M12345");
    expect(r?.listingId).toBe("M12345-67890");
  });

  it("reads Trulia", () => {
    const r = parseListingUrl(
      "https://www.trulia.com/p/wa/wenatchee/908-n-elliott-ave-wenatchee-wa-98801--2079123456",
    );
    expect(r?.provider).toBe("trulia");
    expect(r?.addressLine).toBe("908 n elliott ave wenatchee wa 98801");
    expect(r?.listingId).toBe("2079123456");
  });

  it("reads Homes.com", () => {
    const r = parseListingUrl("https://www.homes.com/property/908-n-elliott-ave-wenatchee-wa/abc123/");
    expect(r?.provider).toBe("homes");
    expect(r?.addressLine).toBe("908 n elliott ave wenatchee wa");
  });

  it("tolerates a missing scheme and tracking query junk", () => {
    const bare = parseListingUrl(
      "www.redfin.com/WA/Wenatchee/908-N-Elliott-Ave-98801/home/75131851?utm_source=share",
    );
    expect(bare?.addressLine).toBe("908 N Elliott Ave, Wenatchee, WA 98801");
  });

  it("returns null rather than guessing", () => {
    // Search / city pages, not homes.
    expect(parseListingUrl("https://www.redfin.com/city/30772/WA/Wenatchee")).toBeNull();
    expect(parseListingUrl("https://www.zillow.com/wenatchee-wa/")).toBeNull();
    // Not a listing site at all.
    expect(parseListingUrl("https://example.com/908-N-Elliott-Ave")).toBeNull();
    // Lookalike domain must not match.
    expect(parseListingUrl("https://notredfin.com/WA/X/1-A-98801/home/1")).toBeNull();
    // Junk.
    expect(parseListingUrl("")).toBeNull();
    expect(parseListingUrl("   ")).toBeNull();
    expect(parseListingUrl("just some text")).toBeNull();
    expect(parseListingUrl("908 N Elliott Ave")).toBeNull();
  });

  it("accepts a subdomain of a known host", () => {
    expect(
      parseListingUrl("https://redfin.com/WA/Wenatchee/908-N-Elliott-Ave-98801/home/75131851")
        ?.provider,
    ).toBe("redfin");
  });
});
