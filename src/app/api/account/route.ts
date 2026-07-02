import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidPhone, normalizePhone, formatPhoneForStorage } from "@/lib/phone";
import type { LoadOptionsInput } from "@/lib/load-options";
import { LOAD_OPTION_KEYS } from "@/lib/load-options";

/** Only these fields are writable by the customer; rate and tax are admin-only. */
function parseDefaultLoadOptions(
  value: unknown
): LoadOptionsInput | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const result: LoadOptionsInput = {};
  for (const key of LOAD_OPTION_KEYS) {
    if (typeof obj[key] === "boolean") result[key] = obj[key] as boolean;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  try {
    const body = await request.json();
    const { name, phone, smsConsent, defaultLoadOptions } = body as {
      name?: string;
      phone?: string;
      smsConsent?: boolean;
      defaultLoadOptions?: unknown;
    };
    const data: {
      name?: string;
      phone?: string;
      smsConsentAt?: Date | null;
      defaultLoadOptions?: LoadOptionsInput | null;
    } = {};
    if (typeof name === "string") data.name = name;
    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
      }
      if (!isValidPhone(phone)) {
        return NextResponse.json(
          { error: "Please enter a valid 10-digit US phone number (e.g. 505-123-4567)." },
          { status: 400 }
        );
      }
      const normalized = normalizePhone(phone);
      data.phone = normalized !== null ? formatPhoneForStorage(normalized) : "";
      if (data.phone === "") data.smsConsentAt = null;
    }
    if (smsConsent === true && data.phone !== "" && data.phone !== undefined) {
      data.smsConsentAt = new Date();
    } else if (smsConsent === false) {
      data.smsConsentAt = null;
    }
    if (defaultLoadOptions !== undefined) {
      data.defaultLoadOptions = parseDefaultLoadOptions(defaultLoadOptions);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true });
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.smsConsentAt !== undefined && { smsConsentAt: data.smsConsentAt }),
        ...(data.defaultLoadOptions !== undefined && {
          defaultLoadOptions:
            data.defaultLoadOptions === null
              ? Prisma.JsonNull
              : (data.defaultLoadOptions as object),
        }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Update account error:", e);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
