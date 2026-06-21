import { NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/auth";
import { signMobileToken } from "@/lib/mobile-auth";

/**
 * POST: Authenticate a staff/driver user and return a long-lived JWT for mobile use.
 * Body: { email: string, password: string }
 * Returns: { token: string }
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.emailVerifiedAt == null) {
    return NextResponse.json({ error: "Email not verified" }, { status: 401 });
  }

  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = await signMobileToken(user.id, user.role);
  return NextResponse.json({ token });
}
