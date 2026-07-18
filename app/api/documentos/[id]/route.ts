import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { lerArquivoLocal, urlDeDownload } from "@/lib/storage";

type Doc = {
  id: number;
  categoria_id: number | null;
  client_id: number | null;
  nome: string;
  storage_path: string;
};

function podeAcessar(doc: Doc, papel: string, clientId: number | null): boolean {
  if (papel === "mentora") return true;
  if (doc.categoria_id) return true; // biblioteca é compartilhada
  return doc.client_id !== null && doc.client_id === clientId; // isolamento por cliente
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const doc = db
    .prepare("SELECT id, categoria_id, client_id, nome, storage_path FROM documents WHERE id = ? AND workspace_id = 1")
    .get(Number(id)) as Doc | undefined;
  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  if (!podeAcessar(doc, user.papel, user.clientId)) {
    return NextResponse.json({ error: "Sem acesso a este documento." }, { status: 403 });
  }

  const assinada = await urlDeDownload(doc.storage_path).catch(() => null);
  if (assinada) return NextResponse.redirect(assinada);

  const dados = lerArquivoLocal(doc.storage_path);
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora exclui documentos." }, { status: 403 });
  const { id } = await params;
  getDb().prepare("DELETE FROM documents WHERE id = ? AND workspace_id = 1").run(Number(id));
  return NextResponse.json({ ok: true });
}
