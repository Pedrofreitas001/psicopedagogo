import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authEnabled } from "@/lib/supabase-auth";

/** Troca o usuário atual (demo de RBAC): grava o cookie `uid`. Desativado com Supabase Auth. */
export async function POST(req: Request) {
  if (authEnabled()) {
    return NextResponse.json({ error: "Troca de usuário demo desativada — autenticação real ativa." }, { status: 403 });
  }
  const body = await req.json();
  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE id = ? AND workspace_id = 1").get(Number(body.uid)) as { id: number } | undefined;
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("uid", String(user.id), { path: "/", httpOnly: false });
  return res;
}
