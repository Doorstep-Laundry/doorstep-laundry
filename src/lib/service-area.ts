import { getCompanyInfo, getMaxServiceDistanceMiles } from "@/lib/settings";
import { geocodeAddress } from "@/lib/geocode";

type LatLng = { lat: number; lng: number };

let facilityLatLngCache: { at: number; value: LatLng | null; address: string } | null = null;
const FACILITY_CACHE_MS = 5 * 60 * 1000;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function geocodeToLatLng(parts: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): Promise<LatLng | null> {
  const result = await geocodeAddress(parts);
  if (!result.valid) return null;
  return { lat: result.lat, lng: result.lng };
}

async function getFacilityLatLng(facilityAddress: string): Promise<LatLng | null> {
  const now = Date.now();
  if (
    facilityLatLngCache &&
    facilityLatLngCache.address === facilityAddress &&
    now - facilityLatLngCache.at < FACILITY_CACHE_MS
  ) {
    return facilityLatLngCache.value;
  }
  const parts = parseFacilityAddress(facilityAddress);
  const value = parts ? await geocodeToLatLng(parts) : null;
  facilityLatLngCache = { at: now, value, address: facilityAddress };
  return value;
}

function parseFacilityAddress(
  raw: string
): { street: string; city: string; state: string; zip: string } | null {
  // Expected format from company settings: "123 Main St, Las Cruces, NM 88001"
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Try to extract zip from end
  const zipMatch = trimmed.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
  const zip = zipMatch ? zipMatch[1] : "";
  const withoutZip = zip ? trimmed.slice(0, trimmed.lastIndexOf(zip)).replace(/,?\s*$/, "") : trimmed;
  // Split remainder by comma
  const parts = withoutZip.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { street: parts[0], city: parts[1], state: parts[2], zip };
  }
  if (parts.length === 2) {
    // Could be "123 Main St, Las Cruces NM" — try splitting city from state
    const cityState = parts[1].split(/\s+/);
    const state = cityState.length > 1 ? cityState[cityState.length - 1] : "";
    const city = cityState.slice(0, -1).join(" ");
    return { street: parts[0], city, state, zip };
  }
  // Fallback: treat whole thing as street
  return { street: trimmed, city: "", state: "", zip };
}

export type ServiceAreaResult = { ok: true } | { ok: false; error: string };

/**
 * When max distance is 0 or facility address is empty, always ok.
 * When max > 0, requires GOOGLE_MAPS_API_KEY and valid geocodes for both addresses.
 */
export async function checkAddressWithinServiceArea(parts: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): Promise<ServiceAreaResult> {
  const maxMiles = await getMaxServiceDistanceMiles();
  if (maxMiles <= 0) {
    return { ok: true };
  }

  const company = await getCompanyInfo();
  const facilityAddress = company.address.trim();
  if (!facilityAddress) {
    return { ok: true };
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return {
      ok: false,
      error:
        "Service area is configured but address verification is unavailable. Please try again later or contact us.",
    };
  }

  if (!parts.street.trim()) {
    return { ok: false, error: "Address is required." };
  }

  const [facility, customer] = await Promise.all([
    getFacilityLatLng(facilityAddress),
    geocodeToLatLng(parts),
  ]);

  if (!facility) {
    return {
      ok: false,
      error:
        "We couldn’t verify our facility location for distance. Please contact us or try again later.",
    };
  }

  if (!customer) {
    return {
      ok: false,
      error:
        "We couldn’t verify that address. Please check the street, city, state, and ZIP and try again.",
    };
  }

  const miles = haversineMiles(facility, customer);
  if (miles > maxMiles) {
    const roundedMax =
      maxMiles >= 10 ? Math.round(maxMiles) : Math.round(maxMiles * 10) / 10;
    return {
      ok: false,
      error: `This address is outside our service area—we currently serve within about ${roundedMax} miles of our facility. Please use a closer address or contact us for help.`,
    };
  }

  return { ok: true };
}
