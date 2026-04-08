import { fetchWithRetry } from "./retry.js";

interface GeocodingResult {
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(
  roadAddress?: string | null,
  cityCode?: string | null,
  city?: string | null,
  country?: string | null
): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    return null;
  }

  const parts = [roadAddress, cityCode, city, country].filter(Boolean);
  if (parts.length === 0) return null;

  const address = parts.join(", ");

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", apiKey);

    const response = await fetchWithRetry(url.toString(), {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      status: string;
      results: Array<{
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) {
      return null;
    }

    const location = data.results[0]!.geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  } catch {
    return null;
  }
}
