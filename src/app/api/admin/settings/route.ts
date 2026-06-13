import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidPhone, normalizePhone, formatPhoneForStorage } from "@/lib/phone";
import { MAX_SERVICE_DISTANCE_MILES_KEY, PAST_DUE_GRACE_PERIOD_DAYS_KEY } from "@/lib/settings";

const DEFAULT_PAST_DUE_GRACE_PERIOD_DAYS = 3;
import {
  BOOKING_AVAILABILITY_KEY,
  parseBookingAvailabilityJson,
  serializeBookingAvailability,
  isValidBookingAvailability,
  type BookingAvailability,
} from "@/lib/booking-availability";

const PRICE_PER_POUND_KEY = "price_per_pound_cents";
const DEFAULT_PRICE_PER_POUND_CENTS = 150;
const GRT_PERCENT_KEY = "grt_percent";
const DEFAULT_GRT_PERCENT = 8.39;

const COMPANY_KEYS = {
  name: "company_name",
  address: "company_address",
  phone: "company_phone",
  email: "company_email",
  logoUrl: "company_logo_url",
} as const;

/** Ensure session/cookies are read on each request (admin UI loads settings client-side). */
export const dynamic = "force-dynamic";

/**
 * GET: Return global settings (admin only). Includes pricePerPoundCents, grtPercent, and company info.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as { role: string }).role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [priceRow, grtRow, companyRows, maxDistRow, bookingRow, pastDueRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: PRICE_PER_POUND_KEY } }),
      prisma.setting.findUnique({ where: { key: GRT_PERCENT_KEY } }),
      prisma.setting.findMany({ where: { key: { in: Object.values(COMPANY_KEYS) } } }),
      prisma.setting.findUnique({ where: { key: MAX_SERVICE_DISTANCE_MILES_KEY } }),
      prisma.setting.findUnique({ where: { key: BOOKING_AVAILABILITY_KEY } }),
      prisma.setting.findUnique({ where: { key: PAST_DUE_GRACE_PERIOD_DAYS_KEY } }),
    ]);
    const pricePerPoundCents = priceRow
      ? parseInt(priceRow.value, 10) || DEFAULT_PRICE_PER_POUND_CENTS
      : DEFAULT_PRICE_PER_POUND_CENTS;
    const grtPercent = grtRow
      ? parseFloat(grtRow.value) || DEFAULT_GRT_PERCENT
      : DEFAULT_GRT_PERCENT;
    const companyMap = Object.fromEntries(companyRows.map((r) => [r.key, r.value]));
    const company = {
      companyName: companyMap[COMPANY_KEYS.name] ?? "",
      companyAddress: companyMap[COMPANY_KEYS.address] ?? "",
      companyPhone: companyMap[COMPANY_KEYS.phone] ?? "",
      companyEmail: companyMap[COMPANY_KEYS.email] ?? "",
      companyLogoUrl: companyMap[COMPANY_KEYS.logoUrl] ?? "",
    };
    const maxServiceDistanceMiles = maxDistRow?.value?.trim()
      ? parseFloat(maxDistRow.value)
      : null;
    const bookingAvailability = parseBookingAvailabilityJson(bookingRow?.value);
    const pastDueGracePeriodDays = pastDueRow?.value
      ? (parseInt(pastDueRow.value, 10) || DEFAULT_PAST_DUE_GRACE_PERIOD_DAYS)
      : DEFAULT_PAST_DUE_GRACE_PERIOD_DAYS;
    return NextResponse.json({
      pricePerPoundCents,
      grtPercent,
      pastDueGracePeriodDays,
      maxServiceDistanceMiles:
        maxServiceDistanceMiles != null &&
        Number.isFinite(maxServiceDistanceMiles) &&
        maxServiceDistanceMiles >= 0
          ? maxServiceDistanceMiles
          : null,
      bookingAvailability,
      ...company,
    });
  } catch (e) {
    console.error("[admin/settings GET]", e);
    return NextResponse.json(
      { error: "Failed to load settings from the database." },
      { status: 500 }
    );
  }
}

function upsertSetting(key: string, value: string, createId: string) {
  return prisma.setting.upsert({
    where: { key },
    create: { id: createId, key, value },
    update: { value },
  });
}

/**
 * PATCH: Update settings (admin only). Body: pricePerPoundCents?, grtPercent?, companyName?, companyAddress?, companyPhone?, companyEmail?, companyLogoUrl?
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    pricePerPoundCents?: number;
    grtPercent?: number;
    pastDueGracePeriodDays?: number;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyLogoUrl?: string;
    maxServiceDistanceMiles?: number | null;
    bookingAvailability?: BookingAvailability;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result: Record<string, unknown> = {};

  if (typeof body.pricePerPoundCents === "number" && body.pricePerPoundCents >= 0) {
    const cents = Math.round(body.pricePerPoundCents);
    await upsertSetting(PRICE_PER_POUND_KEY, String(cents), "setting-price-per-pound");
    result.pricePerPoundCents = cents;
  }

  if (typeof body.grtPercent === "number" && body.grtPercent >= 0 && body.grtPercent <= 100) {
    const value = Math.round(body.grtPercent * 100) / 100;
    await upsertSetting(GRT_PERCENT_KEY, String(value), "setting-grt-percent");
    result.grtPercent = value;
  }

  if (typeof body.pastDueGracePeriodDays === "number" && body.pastDueGracePeriodDays >= 0) {
    const days = Math.round(body.pastDueGracePeriodDays);
    await upsertSetting(PAST_DUE_GRACE_PERIOD_DAYS_KEY, String(days), "setting-past-due-grace-period-days");
    result.pastDueGracePeriodDays = days;
  }

  if (typeof body.companyName === "string") {
    await upsertSetting(COMPANY_KEYS.name, body.companyName.trim(), "setting-company-name");
    result.companyName = body.companyName.trim();
  }
  if (typeof body.companyAddress === "string") {
    await upsertSetting(COMPANY_KEYS.address, body.companyAddress.trim(), "setting-company-address");
    result.companyAddress = body.companyAddress.trim();
  }
  if (typeof body.companyPhone === "string") {
    const trimmed = body.companyPhone.trim();
    if (trimmed !== "" && !isValidPhone(trimmed)) {
      return NextResponse.json(
        { error: "Company phone must be a valid 10-digit US number (e.g. 505-123-4567) or empty." },
        { status: 400 }
      );
    }
    const value =
      trimmed === ""
        ? ""
        : (() => {
            const norm = normalizePhone(trimmed);
            return norm !== null ? formatPhoneForStorage(norm) : trimmed;
          })();
    await upsertSetting(COMPANY_KEYS.phone, value, "setting-company-phone");
    result.companyPhone = value;
  }
  if (typeof body.companyEmail === "string") {
    await upsertSetting(COMPANY_KEYS.email, body.companyEmail.trim(), "setting-company-email");
    result.companyEmail = body.companyEmail.trim();
  }
  if (typeof body.companyLogoUrl === "string") {
    await upsertSetting(COMPANY_KEYS.logoUrl, body.companyLogoUrl.trim(), "setting-company-logo-url");
    result.companyLogoUrl = body.companyLogoUrl.trim();
  }

  if (body.maxServiceDistanceMiles !== undefined) {
    if (body.maxServiceDistanceMiles === null) {
      await prisma.setting.deleteMany({ where: { key: MAX_SERVICE_DISTANCE_MILES_KEY } });
      result.maxServiceDistanceMiles = null;
    } else if (
      typeof body.maxServiceDistanceMiles === "number" &&
      body.maxServiceDistanceMiles >= 0 &&
      Number.isFinite(body.maxServiceDistanceMiles)
    ) {
      const v = Math.round(body.maxServiceDistanceMiles * 1000) / 1000;
      await upsertSetting(
        MAX_SERVICE_DISTANCE_MILES_KEY,
        String(v),
        "setting-max-service-distance-miles"
      );
      result.maxServiceDistanceMiles = v;
    } else {
      return NextResponse.json(
        { error: "maxServiceDistanceMiles must be a non-negative number or null" },
        { status: 400 }
      );
    }
  }

  if (body.bookingAvailability !== undefined) {
    const a = body.bookingAvailability;
    if (
      !a ||
      !Array.isArray(a.morningByDay) ||
      a.morningByDay.length !== 7 ||
      !Array.isArray(a.eveningByDay) ||
      a.eveningByDay.length !== 7
    ) {
      return NextResponse.json(
        { error: "bookingAvailability must include morningByDay and eveningByDay (each 7 booleans)" },
        { status: 400 }
      );
    }
    const normalized: BookingAvailability = {
      morningByDay: a.morningByDay.map((x) => Boolean(x)),
      eveningByDay: a.eveningByDay.map((x) => Boolean(x)),
    };
    const check = isValidBookingAvailability(normalized);
    if (!check.ok) {
      return NextResponse.json({ error: check.error ?? "Invalid booking availability" }, { status: 400 });
    }
    await upsertSetting(
      BOOKING_AVAILABILITY_KEY,
      serializeBookingAvailability(normalized),
      "setting-booking-availability"
    );
    result.bookingAvailability = normalized;
  }

  if (Object.keys(result).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one setting to update" },
      { status: 400 }
    );
  }
  return NextResponse.json(result);
}
