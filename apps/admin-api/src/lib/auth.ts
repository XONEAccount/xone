import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "./env.js";

export interface AdminSession {
  sub: string;
  role: "admin";
}

/**
 * Creates a short-lived admin session JWT after wallet signature login.
 * @param subject - Wallet address stored as token subject
 * @returns Signed JWT string
 * @throws When ADMIN_JWT_SECRET is missing
 */
export async function signAdminToken(subject: string): Promise<string> {
  const env = getEnv();
  if (!env.adminJwtSecret) {
    throw new Error("ADMIN_JWT_SECRET is not configured");
  }

  const key = new TextEncoder().encode(env.adminJwtSecret);
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}

/**
 * Verifies an admin Bearer JWT.
 * @param token - JWT from Authorization header
 * @returns Session payload when valid
 */
export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  const env = getEnv();
  if (!env.adminJwtSecret) return null;

  try {
    const key = new TextEncoder().encode(env.adminJwtSecret);
    const { payload } = await jwtVerify(token, key);
    if (payload.role !== "admin" || typeof payload.sub !== "string") {
      return null;
    }
    return { sub: payload.sub, role: "admin" };
  } catch {
    return null;
  }
}
