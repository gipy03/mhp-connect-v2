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
    console.warn("GOOGLE_GEOCODING_API_KEY not set, skipping geocoding");
    return null;
  }

  const parts = [roadAddress, cityCode, city, country].filter(Boolean);
  if (parts.length === 0) return null;

  const address = parts.join(", ");

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("Geocoding API HTTP error:", response.status);
      return null;
    }

    const data = (await response.json()) as {
      status: string;
      results: Array<{
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) {
      console.warn(
        `Geocoding returned no results for "${address}" (status: ${data.status})`
      );
      return null;
    }

    const location = data.results[0]!.geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}
