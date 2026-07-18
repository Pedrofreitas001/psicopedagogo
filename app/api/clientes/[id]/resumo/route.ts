import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { gerarResumoEvolucao } from "@/lib/assistente";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora gera resumos." }, { status: 403 });

  const { id } = await params;
  const existe = getDb().prepare("SELECT id FROM clients WHERE id = ? AND workspace_id = 1").get(Number(id));
  if (!existe) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const resumo = await gerarResumoEvolucao(Number(id));
  return NextResponse.json({ resumo });
}
