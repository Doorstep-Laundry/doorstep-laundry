import { parseAddressComponents, type AddressParts } from "@/lib/address-parse";

type GoogleGeocodeResponse = {
  status: string;
  results: Array<{
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    geometry: {
      location: { lat: number; lng: number };
    };
  }>;
};

export type GeocodeResult =
  | { valid: true; address: AddressParts; lat: number; lng: number }
  | { valid: false; message: string };

export async function geocodeAddress(parts: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { valid: false, message: "Address verification is not configured." };
  }

  const query = [parts.street, parts.city, parts.state, parts.zip]
    .filter(Boolean)
    .join(", ");

  let data: GoogleGeocodeResponse;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:US&key=${apiKey}`
    );
    if (!res.ok) {
      console.error("[geocode] API error:", res.status);
      return { valid: false, message: "Address verification request failed." };
    }
    data = (await res.json()) as GoogleGeocodeResponse;
  } catch (e) {
    console.error("[geocode] request failed:", e);
    return { valid: false, message: "Address verification request failed." };
  }

  if (data.status !== "OK" || data.results.length === 0) {
    return { valid: false, message: "Address not found." };
  }

  const hit = data.results[0];
  const address = parseAddressComponents(hit.address_components);

  if (!address.street) {
    return { valid: false, message: "Address not found or incomplete." };
  }

  return {
    valid: true,
    address,
    lat: hit.geometry.location.lat,
    lng: hit.geometry.location.lng,
  };
}
