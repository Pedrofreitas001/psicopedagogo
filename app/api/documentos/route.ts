import { NextResponse } from "next/server";
import { getDb, logEvent } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { salvarArquivo } from "@/lib/storage";

const TIPOS = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "md"]);
const TEXTO = new Set(["txt", "md"]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const form = await req.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  if (arquivo.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo acima de 20 MB." }, { status: 400 });

  const tipo = (arquivo.name.split(".").pop() ?? "").toLowerCase();
  if (!TIPOS.has(tipo)) {
    return NextResponse.json({ error: "Formato não suportado. Use PDF, Word, PowerPoint, Excel ou texto." }, { status: 400 });
  }

  const categoriaId = form.get("categoriaId") ? Number(form.get("categoriaId")) : null;
  let clientId = form.get("clientId") ? Number(form.get("clientId")) : null;

  // Permissões: biblioteca é só da mentora; cliente só envia para si mesmo
  if (categoriaId && user.papel !== "mentora") {
    return NextResponse.json({ error: "Apenas a mentora publica na biblioteca." }, { status: 403 });
  }
  if (user.papel === "cliente") clientId = user.clientId;
  if (!categoriaId && !clientId) return NextResponse.json({ error: "Escolha uma categoria ou um cliente." }, { status: 400 });

  const db = getDb();
  if (categoriaId && !db.prepare("SELECT id FROM categories WHERE id = ? AND workspace_id = 1").get(categoriaId)) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }
  if (clientId && !db.prepare("SELECT id FROM clients WHERE id = ? AND workspace_id = 1").get(clientId)) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const dados = Buffer.from(await arquivo.arrayBuffer());
  const storagePath = await salvarArquivo(arquivo.name, dados);

  // Base de conhecimento: campo "conteúdo" do formulário; arquivos de texto são lidos direto
  let conteudo = String(form.get("conteudo") ?? "").slice(0, 20000);
  if (!conteudo && TEXTO.has(tipo)) conteudo = dados.toString("utf-8").slice(0, 20000);

  const info = db
    .prepare(
      "INSERT INTO documents (workspace_id, categoria_id, client_id, nome, tipo, tamanho, storage_path, conteudo, enviado_por) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(categoriaId, categoriaId ? null : clientId, arquivo.name, tipo, arquivo.size, storagePath, conteudo, user.nome);

  if (!categoriaId && clientId) {
    logEvent(clientId, "material", `${user.nome} enviou o arquivo “${arquivo.name}”.`);
  }
  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}
