import { NextResponse } from "next/server";
import { getDocument, updateDocument, deleteDocument } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { lerArquivoLocal, urlDeDownload } from "@/lib/storage";

function podeAcessar(doc: { categoriaId: number | null; clientId: number | null }, papel: string, clientId: number | null): boolean {
  if (papel === "mentora") return true;
  if (doc.categoriaId) return true; // biblioteca é compartilhada
  return doc.clientId !== null && doc.clientId === clientId; // isolamento por cliente
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const doc = await getDocument(Number(id));
  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  if (!podeAcessar(doc, user.papel, user.clientId)) {
    return NextResponse.json({ error: "Sem acesso a este documento." }, { status: 403 });
  }

  const assinada = await urlDeDownload(doc.storagePath).catch(() => null);
  if (assinada) return NextResponse.redirect(assinada);

  const dados = lerArquivoLocal(doc.storagePath);
  if (!dados) {
    return NextResponse.json({ error: "Arquivo demo sem binário — no ambiente com Supabase Storage o download funciona normalmente." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(dados), {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.nome)}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}

/** Edição pós-upload: completar o resumo de conteúdo e/ou disponibilizar (ou não) para o assistente — a "checagem" antes de virar base. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora edita documentos." }, { status: 403 });

  const { id } = await params;
  const doc = await getDocument(Number(id));
  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

  const { conteudo, disponivelAssistente } = (await req.json()) as { conteudo?: string; disponivelAssistente?: boolean };
  await updateDocument(doc.id, {
    conteudo: conteudo !== undefined ? conteudo.slice(0, 20000) : undefined,
    disponivelAssistente,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora exclui documentos." }, { status: 403 });
  const { id } = await params;
  await deleteDocument(Number(id));
  return NextResponse.json({ ok: true });
}
