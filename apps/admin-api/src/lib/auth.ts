import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "./env.js";

export interface AdminSession {
  sub: string;
  role: "admin";
}

/**
 * Creates a short-lived admin session JWT after password login.
 * @param subject - Actor label stored in the token
 * @returns Signed JWT string
 * @throws When ADMIN_JWT_SECRET is missing
 */
export async function signAdminToken(subject = "admin"): Promise<string> {
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

/**
 * Constant-time-ish string equality for credential checks.
 * @param expected - Expected secret
 * @param actual - Submitted value
 * @returns Whether both strings match
 */
function secureEqual(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  if (expected.length !== actual.length) {
    let mismatch = 0;
    for (let i = 0; i < expected.length; i += 1) {
      mismatch |= expected.charCodeAt(i) ^ 0;
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < expected.length; i += 1) {
    result |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates admin username + password against env credentials.
 * @param username - Submitted username
 * @param password - Submitted password
 * @returns Whether credentials match
 */
export function verifyAdminCredentials(username: string, password: string): boolean {
  const env = getEnv();
  if (!env.adminUsername || !env.adminPassword) return false;
  const userOk = secureEqual(env.adminUsername, username);
  const passOk = secureEqual(env.adminPassword, password);
  return userOk && passOk;
}
