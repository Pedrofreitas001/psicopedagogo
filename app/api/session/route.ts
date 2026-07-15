import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** Troca o usuário atual (demo de RBAC): grava o cookie `uid`. */
export async function POST(req: Request) {
  const body = await req.json();
  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE id = ? AND workspace_id = 1").get(Number(body.uid)) as { id: number } | undefined;
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("uid", String(user.id), { path: "/", httpOnly: false });
  return res;
}
