import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("geocodeAddress", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, GOOGLE_GEOCODING_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns null when no API key is set", async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    const { geocodeAddress } = await import("../geocoding.js");
    const result = await geocodeAddress("123 Rue Test", "1204", "Genève", "Suisse");
    expect(result).toBeNull();
  });

  it("returns null when all address parts are empty", async () => {
    const { geocodeAddress } = await import("../geocoding.js");
    const result = await geocodeAddress(null, null, null, null);
    expect(result).toBeNull();
  });

  it("returns coordinates on successful geocode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [{ geometry: { location: { lat: 46.204, lng: 6.143 } } }],
        }),
        { status: 200 }
      )
    );

    const { geocodeAddress } = await import("../geocoding.js");
    const result = await geocodeAddress("Rue du Rhône", "1204", "Genève", "Suisse");
    expect(result).toEqual({ latitude: 46.204, longitude: 6.143 });
  });

  it("returns null when Google returns ZERO_RESULTS", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: "ZERO_RESULTS", results: [] }),
        { status: 200 }
      )
    );

    const { geocodeAddress } = await import("../geocoding.js");
    const result = await geocodeAddress("nowhere", null, null, null);
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network fail"));

    const { geocodeAddress } = await import("../geocoding.js");
    const result = await geocodeAddress("Rue Test", null, "Genève", null);
    expect(result).toBeNull();
  });
});
