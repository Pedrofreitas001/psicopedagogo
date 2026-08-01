import { NextResponse } from "next/server";
import { updateHypothesis, deleteHypothesis } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

const STATUS = new Set(["ativa", "confirmada", "descartada"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const body = (await req.json()) as { status?: string; evidenciasFavor?: string; evidenciasContra?: string };
  if (body.status && !STATUS.has(body.status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });

  await updateHypothesis(Number(id), {
    status: body.status as "ativa" | "confirmada" | "descartada" | undefined,
    evidenciasFavor: body.evidenciasFavor,
    evidenciasContra: body.evidenciasContra,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  await deleteHypothesis(Number(id));
  return NextResponse.json({ ok: true });
}
