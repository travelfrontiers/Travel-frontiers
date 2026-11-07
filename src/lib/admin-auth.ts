import { createPublicKey, randomBytes, timingSafeEqual, verify as verifySignature } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "tf_admin_google_session";
const NONCE_COOKIE = "tf_admin_google_nonce";
const SESSION_MAX_AGE = 60 * 60;

type GoogleIdTokenClaims = {
  aud?: string | string[];
  azp?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iat?: number;
  iss?: string;
  nonce?: string;
};

type GoogleJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

let cachedKeys: { keys: GoogleJwk[]; expiresAt: number } | undefined;

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function googleSigningKeys(): Promise<GoogleJwk[]> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google signing keys are unavailable");

  const body = (await response.json()) as { keys?: GoogleJwk[] };
  if (!Array.isArray(body.keys)) throw new Error("Google signing keys are invalid");

  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 300);
  cachedKeys = { keys: body.keys, expiresAt: Date.now() + Math.min(maxAge, 3600) * 1000 };
  return cachedKeys.keys;
}

export async function verifyGoogleIdToken(
  token: string,
  expectedNonce?: string,
): Promise<GoogleIdTokenClaims | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!clientId || !allowedEmail || token.length > 16_384) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedClaims, encodedSignature] = parts;
    const header = decodeSegment<{ alg?: string; kid?: string; typ?: string }>(encodedHeader);
    const claims = decodeSegment<GoogleIdTokenClaims>(encodedClaims);
    if (header.alg !== "RS256" || !header.kid || header.typ !== "JWT") return null;

    const jwk = (await googleSigningKeys()).find((key) => key.kid === header.kid && key.alg === "RS256");
    if (!jwk) return null;
    const publicKey = createPublicKey({ key: jwk, format: "jwk" } as Parameters<typeof createPublicKey>[0]);
    const validSignature = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
    );
    if (!validSignature) return null;

    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const issuerValid = claims.iss === "accounts.google.com" || claims.iss === "https://accounts.google.com";
    const audienceValid = audiences.includes(clientId) && (audiences.length === 1 || claims.azp === clientId);
    const emailValid = claims.email?.trim().toLowerCase() === allowedEmail;
    const verifiedEmail = claims.email_verified === true || claims.email_verified === "true";
    const timeValid = typeof claims.exp === "number" && claims.exp > now && claims.exp <= now + SESSION_MAX_AGE + 120
      && typeof claims.iat === "number" && claims.iat <= now + 60 && claims.iat >= now - SESSION_MAX_AGE - 120;
    const nonceValid = expectedNonce === undefined || (typeof claims.nonce === "string" && safeEqual(claims.nonce, expectedNonce));

    if (!issuerValid || !audienceValid || !emailValid || !verifiedEmail || !timeValid || !nonceValid) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<GoogleIdTokenClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifyGoogleIdToken(token) : null;
}

export async function issueLoginNonce(): Promise<string> {
  return randomBytes(32).toString("base64url");
}

export const adminAuthCookies = { SESSION_COOKIE, NONCE_COOKIE, SESSION_MAX_AGE };
