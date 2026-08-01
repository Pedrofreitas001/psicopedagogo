import { NextResponse } from "next/server";
import { getParticipant } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { gerarResumoEvolucao } from "@/lib/assistente";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora gera o resumo pré-encontro." }, { status: 403 });

  const { id } = await params;
  const existe = await getParticipant(Number(id));
  if (!existe) return NextResponse.json({ error: "Participante não encontrada." }, { status: 404 });

  const resumo = await gerarResumoEvolucao(Number(id));
  return NextResponse.json({ resumo });
}
