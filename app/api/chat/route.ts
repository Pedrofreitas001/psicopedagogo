import { NextResponse } from "next/server";
import { getCase, getConversationContext } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { responder, salvarConversa } from "@/lib/assistente";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await req.json()) as { pergunta?: string; caseId?: number; conversationId?: number };
  const pergunta = body.pergunta?.trim();
  if (!pergunta) return NextResponse.json({ error: "Escreva sua mensagem." }, { status: 400 });

  // Isolamento: participante só conversa no próprio contexto; mentora escolhe a participante/caso
  let participantId: number | null = null;
  if (user.papel === "participante") {
    participantId = user.participantId;
  } else {
    // Mentora precisa indicar o caso (que já resolve a participante dona dele)
    if (!body.caseId) return NextResponse.json({ error: "Selecione um caso para conversar." }, { status: 400 });
  }

  let caseId: number | null = body.caseId ?? null;
  let nomeCaso: string | null = null;
  if (caseId) {
    const caso = await getCase(caseId);
    if (!caso) return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });
    if (user.papel === "participante" && caso.participantId !== user.participantId) {
      return NextResponse.json({ error: "Sem acesso a este caso." }, { status: 403 });
    }
    if (user.papel === "mentora") participantId = caso.participantId;
    nomeCaso = caso.nome;
  }

  if (!participantId) return NextResponse.json({ error: "Não foi possível identificar a participante." }, { status: 400 });

  const resposta = await responder(pergunta, participantId, caseId, user.nome, nomeCaso);

  // Toda conversa é armazenada para consulta futura (regra do produto)
  let conversationId = body.conversationId;
  if (conversationId) {
    const contexto = await getConversationContext(conversationId);
    if (!contexto || contexto.participantId !== participantId || contexto.caseId !== caseId) conversationId = undefined;
  }
  conversationId = await salvarConversa(participantId, caseId, user.nome, pergunta, resposta, conversationId);

  return NextResponse.json({ ...resposta, conversationId });
}
