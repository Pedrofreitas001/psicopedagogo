import { NextResponse } from "next/server";
import { authEnabled, signIn, serializeSession, SESSION_COOKIE } from "@/lib/supabase-auth";

export async function POST(req: Request) {
  if (!authEnabled()) return NextResponse.json({ error: "Auth não configurado (modo demo)." }, { status: 400 });
  const { email, password } = await req.json();
  if (!email?.trim() || !password) return NextResponse.json({ error: "Informe email e senha." }, { status: 400 });

  const result = await signIn(email.trim(), password);
  if (!result.session) return NextResponse.json({ error: result.error }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, serializeSession(result.session), { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return res;
}
