import { NextResponse } from "next/server";
import { getConversationContext, logEvent } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

/**
 * Adiciona uma conversa já existente à linha do tempo do caso (ou da
 * participante, se for uma dúvida geral) — ação explícita, para a linha do
 * tempo não ficar poluída com toda conversa automaticamente.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const conversationId = Number(id);
  const contexto = await getConversationContext(conversationId);
  if (!contexto) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  if (user.papel !== "mentora" && contexto.participantId !== user.participantId) {
    return NextResponse.json({ error: "Sem acesso a esta conversa." }, { status: 403 });
  }

  await logEvent(contexto.participantId, contexto.caseId, "conversa", `${user.nome} adicionou uma conversa com o mentor à linha do tempo.`);
  return NextResponse.json({ ok: true });
}
