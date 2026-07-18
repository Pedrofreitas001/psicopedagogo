import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
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
  if (user.papel === "cliente") {
    clientId = user.clientId;
  } else if (body.clientId) {
    const db = getDb();
    const existe = db.prepare("SELECT id FROM clients WHERE id = ? AND workspace_id = 1").get(body.clientId);
    if (!existe) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    clientId = body.clientId;
  }

  const db = getDb();
  const nomeCliente = clientId
    ? ((db.prepare("SELECT nome FROM clients WHERE id = ?").get(clientId) as { nome: string })?.nome ?? user.nome)
    : user.nome;

  const resposta = await responder(pergunta, clientId, nomeCliente);

  // Toda conversa é armazenada para consulta futura (regra do produto)
  let conversationId = body.conversationId;
  if (clientId) {
    if (conversationId) {
      const pertence = db
        .prepare("SELECT id FROM conversations WHERE id = ? AND client_id = ?")
        .get(conversationId, clientId);
      if (!pertence) conversationId = undefined;
    }
    conversationId = salvarConversa(clientId, user.nome, pergunta, resposta, conversationId);
  }

  return NextResponse.json({ ...resposta, conversationId });
}
