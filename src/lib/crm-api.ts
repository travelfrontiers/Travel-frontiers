import type { NextRequest } from "next/server";

const authorizedEmail = "tf.travel.frontiers@gmail.com";

export async function isAuthorizedStudioUser(request: NextRequest): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  if (!token || token.length > 8192 || !projectId) return false;

  try {
    const response = await fetch(`https://${projectId}.api.sanity.io/v2021-06-07/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const user = await response.json() as { email?: unknown };
    return typeof user.email === "string" && user.email.toLowerCase() === authorizedEmail;
  } catch {
    return false;
  }
}

export function supabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = secretKey || legacyServiceRoleKey;
  if (!url || !key) return null;
  return {
    url,
    headers: {
      apikey: key,
      ...(secretKey ? {} : { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
    },
  };
}

export const CRM_LEAD_STATUSES = ["new", "quote_preparing", "quote_sent", "awaiting_reply", "won", "lost"] as const;
