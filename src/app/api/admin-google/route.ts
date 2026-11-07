import { NextRequest, NextResponse } from "next/server";
import { adminAuthCookies, issueLoginNonce, verifyGoogleIdToken } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const secure = process.env.NODE_ENV === "production";

function sameOrigin(request: NextRequest): boolean {
  return request.headers.get("origin") === request.nextUrl.origin;
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || !process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "A autenticação ainda não está configurada." }, { status: 503 });
  }

  const nonce = await issueLoginNonce();
  const response = NextResponse.json({ nonce }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(adminAuthCookies.NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/admin-google",
    maxAge: 10 * 60,
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Pedido inválido." }, { status: 403 });

  const nonce = request.cookies.get(adminAuthCookies.NONCE_COOKIE)?.value;
  if (!nonce) return NextResponse.json({ error: "Inicia novamente o processo de autenticação." }, { status: 401 });

  let credential: unknown;
  try {
    credential = (await request.json()).credential;
  } catch {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 400 });
  }
  if (typeof credential !== "string") return NextResponse.json({ error: "Credenciais inválidas." }, { status: 400 });

  const claims = await verifyGoogleIdToken(credential, nonce);
  if (!claims || typeof claims.exp !== "number") {
    return NextResponse.json({ error: "Esta conta Google não tem acesso a esta área." }, { status: 401 });
  }

  const maxAge = Math.max(0, Math.min(claims.exp - Math.floor(Date.now() / 1000), adminAuthCookies.SESSION_MAX_AGE));
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(adminAuthCookies.SESSION_COOKIE, credential, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  response.cookies.set(adminAuthCookies.NONCE_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/admin-google",
    maxAge: 0,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Pedido inválido." }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(adminAuthCookies.SESSION_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
