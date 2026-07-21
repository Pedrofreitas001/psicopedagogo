import { NextResponse } from "next/server";
import { getClient, createSessionNote, logEvent } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora registra notas de sessão." }, { status: 403 });

  const { id } = await params;
  const clientId = Number(id);
  const cliente = await getClient(clientId);
  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const { dataSessao, conteudo } = (await req.json()) as { dataSessao?: string; conteudo?: string };
  if (!conteudo?.trim()) return NextResponse.json({ error: "Escreva o conteúdo da sessão." }, { status: 400 });
  const data = dataSessao?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  const noteId = await createSessionNote({ clientId, dataSessao: data, conteudo: conteudo.trim(), criadoPor: user.nome });
  await logEvent(clientId, "sessao", `Mentora registrou uma nota de sessão (${data.split("-").reverse().join("/")}).`);
  return NextResponse.json({ ok: true, id: noteId });
}
