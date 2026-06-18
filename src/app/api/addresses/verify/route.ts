import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";

/**
 * POST: Verify a US address using Google Maps Geocoding API.
 * Body: { street, city, state, zip }
 * Returns: { valid: boolean, suggested?: { street, city, state, zip }, message?: string }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { street?: string; city?: string; state?: string; zip?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const street = typeof body.street === "string" ? body.street.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const zip = typeof body.zip === "string" ? body.zip.trim() : "";

  if (!street) {
    return NextResponse.json({ valid: false, message: "Address is required." }, { status: 400 });
  }

  const result = await geocodeAddress({ street, city, state, zip });

  if (!result.valid) {
    return NextResponse.json({ valid: false, message: result.message });
  }

  return NextResponse.json({ valid: true, suggested: result.address });
}
