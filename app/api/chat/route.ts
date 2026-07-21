import { NextResponse } from "next/server";
import { getClient, getConversationClientId } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { responder, salvarConversa } from "@/lib/assistente";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await req.json()) as { pergunta?: string; clientId?: number; conversationId?: number };
  const pergunta = body.pergunta?.trim();
  if (!pergunta) return NextResponse.json({ error: "Escreva uma pergunta." }, { status: 400 });

  // Isolamento: cliente só conversa no próprio contexto; mentora escolhe o cliente
  let clientId: number | null = null;
  let cliente = null;
  if (user.papel === "cliente") {
    clientId = user.clientId;
    cliente = clientId ? await getClient(clientId) : null;
  } else if (body.clientId) {
    cliente = await getClient(body.clientId);
    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    clientId = body.clientId;
  }

  const resposta = await responder(pergunta, clientId, cliente?.nome ?? user.nome);

  // Toda conversa é armazenada para consulta futura (regra do produto)
  let conversationId = body.conversationId;
  if (clientId) {
    if (conversationId) {
      const dono = await getConversationClientId(conversationId);
      if (dono !== clientId) conversationId = undefined;
    }
    conversationId = await salvarConversa(clientId, user.nome, pergunta, resposta, conversationId);
  }

  return NextResponse.json({ ...resposta, conversationId });
}
