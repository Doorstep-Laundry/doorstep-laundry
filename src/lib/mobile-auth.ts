import { getServerSession } from "next-auth";
import { SignJWT, jwtVerify } from "jose";
import { authOptions, isStaff } from "./auth";

const MOBILE_TOKEN_EXPIRY = "90d";

function getMobileSecret(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function signMobileToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(MOBILE_TOKEN_EXPIRY)
    .sign(getMobileSecret());
}

export async function verifyMobileToken(
  token: string
): Promise<{ userId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getMobileSecret());
    const { userId, role } = payload as { userId?: string; role?: string };
    if (!userId || !role) return null;
    return { userId, role };
  } catch {
    return null;
  }
}

/**
 * Resolves driver identity from either a NextAuth session cookie or a
 * mobile Bearer token. Returns null if unauthenticated or not staff/admin.
 */
export async function getDriverSession(
  request: Request
): Promise<{ id: string; role: string } | null> {
  // Try cookie-based session first
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const role = (session.user as { role: string }).role;
    if (!isStaff(role)) return null;
    return { id: (session.user as { id: string }).id, role };
  }

  // Fall back to Bearer token
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = await verifyMobileToken(token);
  if (!payload || !isStaff(payload.role)) return null;
  return { id: payload.userId, role: payload.role };
}
