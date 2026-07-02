import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST: Send a test SMS via Quo. Admin only.
 * Body: { to: string, message: string }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.QUO_API_KEY;
  const from = process.env.QUO_PHONE_NUMBER;
  const userId = process.env.QUO_USER_ID;
  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "Quo not configured (QUO_API_KEY, QUO_PHONE_NUMBER)" },
      { status: 503 }
    );
  }

  let body: { to?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "Test from Doorstep Debug";
  if (!to) {
    return NextResponse.json({ error: "to (phone number) is required" }, { status: 400 });
  }

  try {
    const payload: Record<string, unknown> = { content: message, from, to: [to] };
    if (userId) payload.userId = userId;

    const res = await fetch("https://api.quo.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Debug Quo error:", res.status, data);
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? `Quo returned ${res.status}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }
    return NextResponse.json({ ok: true, id: (data as { id?: string }).id });
  } catch (e: unknown) {
    console.error("Debug Quo error:", e);
    return NextResponse.json({ error: (e as Error).message ?? "Quo send failed" }, { status: 500 });
  }
}
