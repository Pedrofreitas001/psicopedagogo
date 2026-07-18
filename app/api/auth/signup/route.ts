import { NextResponse } from "next/server";
import { authEnabled, signUp, serializeSession, SESSION_COOKIE } from "@/lib/supabase-auth";

export async function POST(req: Request) {
  if (!authEnabled()) return NextResponse.json({ error: "Auth não configurado (modo demo)." }, { status: 400 });
  const { email, password, nome } = await req.json();
  if (!email?.trim() || !password || !nome?.trim()) {
    return NextResponse.json({ error: "Informe nome, email e senha." }, { status: 400 });
  }
  if (password.length < 8) return NextResponse.json({ error: "A senha precisa de pelo menos 8 caracteres." }, { status: 400 });

  const result = await signUp(email.trim(), password, nome.trim());
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  if (result.pendingConfirmation) {
    return NextResponse.json({ pendingConfirmation: true, message: "Conta criada! Confirme pelo link enviado ao seu email e depois faça login." });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, serializeSession(result.session!), { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return res;
}
