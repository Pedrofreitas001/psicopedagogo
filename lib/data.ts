import { getDb } from "./db";
import { supabaseUrl } from "./supabase-auth";

/**
 * Camada de dados única e assíncrona para toda a aplicação.
 *
 * Dois backends:
 *   - Postgres do Supabase via REST/PostgREST (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *     definidos) — é o modo de produção, com persistência real entre requisições.
 *   - SQLite local (fallback quando o Supabase não está configurado) — só para
 *     rodar sem infraestrutura externa; em serverless (Vercel) NÃO persiste de
 *     forma confiável entre instâncias, por isso nunca deve ser usado em produção.
 *
 * Toda a autorização (quem pode ver/editar o quê) continua sendo feita nas
 * rotas de API — aqui usamos a service_role key, que ignora RLS por design;
 * o RLS em supabase/schema.sql é defesa em profundidade, não a fronteira
 * principal de autorização deste app.
 */

export type Role = "mentora" | "cliente";

export function postgresEnabled(): boolean {
  return !!(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------------
// Baixo nível: PostgREST
// ---------------------------------------------------------------------------

function pgHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

async function pgRequest(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${supabaseUrl()}/rest/v1${path}`, { ...init, headers: { ...pgHeaders(), ...(init?.headers as Record<string, string>) }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase REST ${init?.method ?? "GET"} ${path} falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  return res;
}

async function pgSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await pgRequest(`/${table}?${query}`);
  return (await res.json()) as T[];
}

async function pgInsert<T>(table: string, body: Record<string, unknown>): Promise<T> {
  const res = await pgRequest(`/${table}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  const rows = (await res.json()) as T[];
  return rows[0];
}

async function pgUpdate(table: string, id: number, body: Record<string, unknown>): Promise<void> {
  await pgRequest(`/${table}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

async function pgDelete(table: string, id: number): Promise<void> {
  await pgRequest(`/${table}?id=eq.${id}`, { method: "DELETE" });
}

const n = (v: unknown): number => Number(v); // bigint do Postgres pode voltar como string — normaliza
const nOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const b = (v: unknown): boolean => v === true || v === 1 || v === "t";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type UserRow = { id: number; nome: string; email: string; papel: Role };

export type Client = {
  id: number;
  userId: number | null;
  nome: string;
  email: string;
  objetivo: string;
  observacoes: string;
  idade: number | null;
  diagnosticoPreliminar: string;
  escolaSerie: string;
  responsavelNome: string;
  responsavelContato: string;
  queixaPrincipal: string;
  criadoEm: string;
};

export type ClientInput = {
  nome: string;
  email: string;
  objetivo: string;
  observacoes: string;
  idade: number | null;
  diagnosticoPreliminar: string;
  escolaSerie: string;
  responsavelNome: string;
  responsavelContato: string;
  queixaPrincipal: string;
};

export type Category = { id: number; nome: string; parentId: number | null };

export type DocumentRow = {
  id: number;
  categoriaId: number | null;
  clientId: number | null;
  nome: string;
  tipo: string;
  tamanho: number;
  storagePath: string;
  conteudo: string;
  disponivelAssistente: boolean;
  enviadoPor: string;
  criadoEm: string;
};

export type KnowledgeNote = { id: number; titulo: string; conteudo: string; atualizadoEm: string };

export type EventRow = { tipo: string; descricao: string; criadoEm: string };

export type SessionNote = { id: number; clientId: number; dataSessao: string; conteudo: string; criadoPor: string; criadoEm: string };

export type MessageRow = { papel: "usuario" | "assistente"; autor: string; conteudo: string; criadoEm: string };

export type AgentSettings = {
  usaBiblioteca: boolean;
  usaMetodologia: boolean;
  usaHistorico: boolean;
  usaProntuario: boolean;
  instrucoesExtra: string;
  tom: "acolhedor" | "formal" | "direto";
};

// ---------------------------------------------------------------------------
// Usuários & sessão
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<UserRow[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; email: string; papel: Role }>(
      "users",
      "select=id,nome,email,papel&workspace_id=eq.1&order=id.asc"
    );
    return rows.map((r) => ({ ...r, id: n(r.id) }));
  }
  return getDb().prepare("SELECT id, nome, email, papel FROM users WHERE workspace_id = 1 ORDER BY id").all() as UserRow[];
}

export async function getWorkspaceName(): Promise<string> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ nome: string }>("workspaces", "select=nome&id=eq.1&limit=1");
    return rows[0]?.nome ?? "Espaço Aprender";
  }
  return (getDb().prepare("SELECT nome FROM workspaces WHERE id = 1").get() as { nome: string }).nome;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; email: string; papel: Role }>(
      "users",
      `select=id,nome,email,papel&id=eq.${id}&workspace_id=eq.1&limit=1`
    );
    return rows[0] ? { ...rows[0], id: n(rows[0].id) } : null;
  }
  return (getDb().prepare("SELECT id, nome, email, papel FROM users WHERE id = ? AND workspace_id = 1").get(id) as UserRow | undefined) ?? null;
}

export async function getFirstUser(): Promise<UserRow | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; email: string; papel: Role }>(
      "users",
      "select=id,nome,email,papel&workspace_id=eq.1&order=id.asc&limit=1"
    );
    return rows[0] ? { ...rows[0], id: n(rows[0].id) } : null;
  }
  return (getDb().prepare("SELECT id, nome, email, papel FROM users WHERE workspace_id = 1 ORDER BY id LIMIT 1").get() as UserRow | undefined) ?? null;
}

export async function getUserByAuthId(authId: string): Promise<UserRow | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; email: string; papel: Role }>(
      "users",
      `select=id,nome,email,papel&auth_id=eq.${encodeURIComponent(authId)}&workspace_id=eq.1&limit=1`
    );
    return rows[0] ? { ...rows[0], id: n(rows[0].id) } : null;
  }
  return (
    (getDb().prepare("SELECT id, nome, email, papel FROM users WHERE auth_id = ? AND workspace_id = 1").get(authId) as UserRow | undefined) ?? null
  );
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const lower = email.toLowerCase();
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; email: string; papel: Role }>(
      "users",
      `select=id,nome,email,papel&workspace_id=eq.1`
    );
    const match = rows.find((r) => r.email.toLowerCase() === lower);
    return match ? { ...match, id: n(match.id) } : null;
  }
  return (
    (getDb().prepare("SELECT id, nome, email, papel FROM users WHERE lower(email) = lower(?) AND workspace_id = 1").get(lower) as
      | UserRow
      | undefined) ?? null
  );
}

export async function setUserAuthId(id: number, authId: string): Promise<void> {
  if (postgresEnabled()) return void (await pgUpdate("users", id, { auth_id: authId }));
  getDb().prepare("UPDATE users SET auth_id = ? WHERE id = ?").run(authId, id);
}

export async function hasAnyAuthedUser(): Promise<boolean> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("users", "select=id&workspace_id=eq.1&auth_id=not.is.null&limit=1");
    return rows.length > 0;
  }
  return !!getDb().prepare("SELECT 1 FROM users WHERE auth_id IS NOT NULL AND workspace_id = 1 LIMIT 1").get();
}

export async function createUser(input: { nome: string; email: string; papel: Role; authId: string }): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("users", { workspace_id: 1, nome: input.nome, email: input.email, papel: input.papel, auth_id: input.authId });
    return n(row.id);
  }
  const info = getDb()
    .prepare("INSERT INTO users (workspace_id, nome, email, papel, auth_id) VALUES (1, ?, ?, ?, ?)")
    .run(input.nome, input.email, input.papel, input.authId);
  return Number(info.lastInsertRowid);
}

export async function getClientByUserId(userId: number): Promise<{ id: number } | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("clients", `select=id&user_id=eq.${userId}&workspace_id=eq.1&limit=1`);
    return rows[0] ? { id: n(rows[0].id) } : null;
  }
  return (getDb().prepare("SELECT id FROM clients WHERE user_id = ? AND workspace_id = 1").get(userId) as { id: number } | undefined) ?? null;
}

export async function getClientByEmail(email: string): Promise<{ id: number } | null> {
  const lower = email.toLowerCase();
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; email: string }>("clients", "select=id,email&workspace_id=eq.1");
    const match = rows.find((r) => r.email.toLowerCase() === lower);
    return match ? { id: n(match.id) } : null;
  }
  return (getDb().prepare("SELECT id FROM clients WHERE lower(email) = lower(?) AND workspace_id = 1").get(lower) as { id: number } | undefined) ?? null;
}

export async function linkClientUser(clientId: number, userId: number): Promise<void> {
  if (postgresEnabled()) return void (await pgUpdate("clients", clientId, { user_id: userId }));
  getDb().prepare("UPDATE clients SET user_id = ? WHERE id = ?").run(userId, clientId);
}

export async function createClientForUser(input: { userId: number; nome: string; email: string }): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("clients", { workspace_id: 1, user_id: input.userId, nome: input.nome, email: input.email });
    return n(row.id);
  }
  const info = getDb()
    .prepare("INSERT INTO clients (workspace_id, user_id, nome, email) VALUES (1, ?, ?, ?)")
    .run(input.userId, input.nome, input.email);
  return Number(info.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

type ClientDbRow = {
  id: unknown;
  user_id: unknown;
  nome: string;
  email: string;
  objetivo: string;
  observacoes: string;
  idade: unknown;
  diagnostico_preliminar: string;
  escola_serie: string;
  responsavel_nome: string;
  responsavel_contato: string;
  queixa_principal: string;
  criado_em: string;
};

function mapClient(r: ClientDbRow): Client {
  return {
    id: n(r.id),
    userId: nOrNull(r.user_id),
    nome: r.nome,
    email: r.email,
    objetivo: r.objetivo,
    observacoes: r.observacoes,
    idade: nOrNull(r.idade),
    diagnosticoPreliminar: r.diagnostico_preliminar ?? "",
    escolaSerie: r.escola_serie ?? "",
    responsavelNome: r.responsavel_nome ?? "",
    responsavelContato: r.responsavel_contato ?? "",
    queixaPrincipal: r.queixa_principal ?? "",
    criadoEm: r.criado_em,
  };
}

const CLIENT_COLS =
  "id,user_id,nome,email,objetivo,observacoes,idade,diagnostico_preliminar,escola_serie,responsavel_nome,responsavel_contato,queixa_principal,criado_em";

export async function listClients(): Promise<Client[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<ClientDbRow>("clients", `select=${CLIENT_COLS}&workspace_id=eq.1&order=nome.asc`);
    return rows.map(mapClient);
  }
  return (getDb().prepare(`SELECT ${CLIENT_COLS} FROM clients WHERE workspace_id = 1 ORDER BY nome`).all() as ClientDbRow[]).map(mapClient);
}

export async function listClientsWithLastEvent(): Promise<(Client & { ultimoEvento: string | null })[]> {
  const clients = await listClients();
  if (postgresEnabled()) {
    const events = await pgSelect<{ client_id: unknown; criado_em: string }>("events", "select=client_id,criado_em&workspace_id=eq.1");
    const last = new Map<number, string>();
    for (const e of events) {
      const cid = n(e.client_id);
      const prev = last.get(cid);
      if (!prev || e.criado_em > prev) last.set(cid, e.criado_em);
    }
    return clients.map((c) => ({ ...c, ultimoEvento: last.get(c.id) ?? null }));
  }
  const db = getDb();
  return clients.map((c) => {
    const row = db.prepare("SELECT MAX(criado_em) m FROM events WHERE client_id = ?").get(c.id) as { m: string | null };
    return { ...c, ultimoEvento: row.m };
  });
}

export async function getClient(id: number): Promise<Client | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<ClientDbRow>("clients", `select=${CLIENT_COLS}&id=eq.${id}&workspace_id=eq.1&limit=1`);
    return rows[0] ? mapClient(rows[0]) : null;
  }
  const row = getDb().prepare(`SELECT ${CLIENT_COLS} FROM clients WHERE id = ? AND workspace_id = 1`).get(id) as ClientDbRow | undefined;
  return row ? mapClient(row) : null;
}

function clientBody(input: ClientInput) {
  return {
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    objetivo: input.objetivo ?? "",
    observacoes: input.observacoes ?? "",
    idade: input.idade,
    diagnostico_preliminar: input.diagnosticoPreliminar ?? "",
    escola_serie: input.escolaSerie ?? "",
    responsavel_nome: input.responsavelNome ?? "",
    responsavel_contato: input.responsavelContato ?? "",
    queixa_principal: input.queixaPrincipal ?? "",
  };
}

export async function createClient(input: ClientInput): Promise<number> {
  const body = clientBody(input);
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("clients", { workspace_id: 1, ...body });
    return n(row.id);
  }
  const info = getDb()
    .prepare(
      `INSERT INTO clients (workspace_id, nome, email, objetivo, observacoes, idade, diagnostico_preliminar, escola_serie, responsavel_nome, responsavel_contato, queixa_principal)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(body.nome, body.email, body.objetivo, body.observacoes, body.idade, body.diagnostico_preliminar, body.escola_serie, body.responsavel_nome, body.responsavel_contato, body.queixa_principal);
  return Number(info.lastInsertRowid);
}

export async function updateClient(id: number, input: ClientInput): Promise<void> {
  const body = clientBody(input);
  if (postgresEnabled()) return void (await pgUpdate("clients", id, body));
  getDb()
    .prepare(
      `UPDATE clients SET nome=?, email=?, objetivo=?, observacoes=?, idade=?, diagnostico_preliminar=?, escola_serie=?, responsavel_nome=?, responsavel_contato=?, queixa_principal=? WHERE id = ?`
    )
    .run(body.nome, body.email, body.objetivo, body.observacoes, body.idade, body.diagnostico_preliminar, body.escola_serie, body.responsavel_nome, body.responsavel_contato, body.queixa_principal, id);
}

// ---------------------------------------------------------------------------
// Categorias (pastas da biblioteca)
// ---------------------------------------------------------------------------

export async function listCategories(): Promise<Category[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; parent_id: unknown }>("categories", "select=id,nome,parent_id&workspace_id=eq.1&order=nome.asc");
    return rows.map((r) => ({ id: n(r.id), nome: r.nome, parentId: nOrNull(r.parent_id) }));
  }
  return (getDb().prepare("SELECT id, nome, parent_id AS parentId FROM categories WHERE workspace_id = 1 ORDER BY nome").all() as Category[]);
}

export async function getCategory(id: number): Promise<Category | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; parent_id: unknown }>("categories", `select=id,nome,parent_id&id=eq.${id}&workspace_id=eq.1&limit=1`);
    return rows[0] ? { id: n(rows[0].id), nome: rows[0].nome, parentId: nOrNull(rows[0].parent_id) } : null;
  }
  const row = getDb().prepare("SELECT id, nome, parent_id AS parentId FROM categories WHERE id = ? AND workspace_id = 1").get(id) as Category | undefined;
  return row ?? null;
}

export async function createCategory(nome: string, parentId: number | null): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("categories", { workspace_id: 1, nome, parent_id: parentId });
    return n(row.id);
  }
  const info = getDb().prepare("INSERT INTO categories (workspace_id, nome, parent_id) VALUES (1, ?, ?)").run(nome, parentId);
  return Number(info.lastInsertRowid);
}

export async function countChildCategories(id: number): Promise<number> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("categories", `select=id&parent_id=eq.${id}`);
    return rows.length;
  }
  return (getDb().prepare("SELECT COUNT(*) c FROM categories WHERE parent_id = ?").get(id) as { c: number }).c;
}

export async function countDocsInCategory(id: number): Promise<number> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("documents", `select=id&categoria_id=eq.${id}`);
    return rows.length;
  }
  return (getDb().prepare("SELECT COUNT(*) c FROM documents WHERE categoria_id = ?").get(id) as { c: number }).c;
}

export async function deleteCategory(id: number): Promise<void> {
  if (postgresEnabled()) return void (await pgDelete("categories", id));
  getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

type DocDbRow = {
  id: unknown;
  categoria_id: unknown;
  client_id: unknown;
  nome: string;
  tipo: string;
  tamanho: unknown;
  storage_path: string;
  conteudo: string;
  disponivel_assistente: unknown;
  enviado_por: string;
  criado_em: string;
};

function mapDoc(r: DocDbRow): DocumentRow {
  return {
    id: n(r.id),
    categoriaId: nOrNull(r.categoria_id),
    clientId: nOrNull(r.client_id),
    nome: r.nome,
    tipo: r.tipo,
    tamanho: n(r.tamanho),
    storagePath: r.storage_path,
    conteudo: r.conteudo,
    disponivelAssistente: b(r.disponivel_assistente),
    enviadoPor: r.enviado_por,
    criadoEm: r.criado_em,
  };
}

const DOC_COLS = "id,categoria_id,client_id,nome,tipo,tamanho,storage_path,conteudo,disponivel_assistente,enviado_por,criado_em";

export async function listLibraryDocuments(): Promise<DocumentRow[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<DocDbRow>("documents", `select=${DOC_COLS}&workspace_id=eq.1&categoria_id=not.is.null&order=nome.asc`);
    return rows.map(mapDoc);
  }
  return (getDb().prepare(`SELECT ${DOC_COLS} FROM documents WHERE workspace_id = 1 AND categoria_id IS NOT NULL ORDER BY nome`).all() as DocDbRow[]).map(mapDoc);
}

export async function listClientDocuments(clientId: number): Promise<DocumentRow[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<DocDbRow>("documents", `select=${DOC_COLS}&client_id=eq.${clientId}&order=criado_em.desc`);
    return rows.map(mapDoc);
  }
  return (getDb().prepare(`SELECT ${DOC_COLS} FROM documents WHERE client_id = ? ORDER BY criado_em DESC`).all(clientId) as DocDbRow[]).map(mapDoc);
}

export async function getDocument(id: number): Promise<DocumentRow | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<DocDbRow>("documents", `select=${DOC_COLS}&id=eq.${id}&workspace_id=eq.1&limit=1`);
    return rows[0] ? mapDoc(rows[0]) : null;
  }
  const row = getDb().prepare(`SELECT ${DOC_COLS} FROM documents WHERE id = ? AND workspace_id = 1`).get(id) as DocDbRow | undefined;
  return row ? mapDoc(row) : null;
}

export async function createDocument(input: {
  categoriaId: number | null;
  clientId: number | null;
  nome: string;
  tipo: string;
  tamanho: number;
  storagePath: string;
  conteudo: string;
  enviadoPor: string;
}): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("documents", {
      workspace_id: 1,
      categoria_id: input.categoriaId,
      client_id: input.clientId,
      nome: input.nome,
      tipo: input.tipo,
      tamanho: input.tamanho,
      storage_path: input.storagePath,
      conteudo: input.conteudo,
      enviado_por: input.enviadoPor,
    });
    return n(row.id);
  }
  const info = getDb()
    .prepare(
      "INSERT INTO documents (workspace_id, categoria_id, client_id, nome, tipo, tamanho, storage_path, conteudo, enviado_por) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(input.categoriaId, input.clientId, input.nome, input.tipo, input.tamanho, input.storagePath, input.conteudo, input.enviadoPor);
  return Number(info.lastInsertRowid);
}

export async function updateDocument(id: number, input: { conteudo?: string; disponivelAssistente?: boolean }): Promise<void> {
  const body: Record<string, unknown> = {};
  if (input.conteudo !== undefined) body.conteudo = input.conteudo;
  if (input.disponivelAssistente !== undefined) body.disponivel_assistente = input.disponivelAssistente;
  if (Object.keys(body).length === 0) return;
  if (postgresEnabled()) return void (await pgUpdate("documents", id, body));
  const db = getDb();
  if (input.conteudo !== undefined) db.prepare("UPDATE documents SET conteudo = ? WHERE id = ?").run(input.conteudo, id);
  if (input.disponivelAssistente !== undefined)
    db.prepare("UPDATE documents SET disponivel_assistente = ? WHERE id = ?").run(input.disponivelAssistente ? 1 : 0, id);
}

export async function deleteDocument(id: number): Promise<void> {
  if (postgresEnabled()) return void (await pgDelete("documents", id));
  getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
}

export async function countLibraryDocuments(): Promise<number> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("documents", "select=id&workspace_id=eq.1&categoria_id=not.is.null");
    return rows.length;
  }
  return (getDb().prepare("SELECT COUNT(*) c FROM documents WHERE workspace_id = 1 AND categoria_id IS NOT NULL").get() as { c: number }).c;
}

export async function countClients(): Promise<number> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("clients", "select=id&workspace_id=eq.1");
    return rows.length;
  }
  return (getDb().prepare("SELECT COUNT(*) c FROM clients WHERE workspace_id = 1").get() as { c: number }).c;
}

export async function countConversations(): Promise<number> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("conversations", "select=id&workspace_id=eq.1");
    return rows.length;
  }
  return (getDb().prepare("SELECT COUNT(*) c FROM conversations WHERE workspace_id = 1").get() as { c: number }).c;
}

// ---------------------------------------------------------------------------
// Metodologia (knowledge)
// ---------------------------------------------------------------------------

export async function listKnowledge(): Promise<KnowledgeNote[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; titulo: string; conteudo: string; atualizado_em: string }>(
      "knowledge",
      "select=id,titulo,conteudo,atualizado_em&workspace_id=eq.1&order=id.asc"
    );
    return rows.map((r) => ({ id: n(r.id), titulo: r.titulo, conteudo: r.conteudo, atualizadoEm: r.atualizado_em }));
  }
  return getDb().prepare("SELECT id, titulo, conteudo, atualizado_em AS atualizadoEm FROM knowledge WHERE workspace_id = 1 ORDER BY id").all() as KnowledgeNote[];
}

export async function createKnowledge(titulo: string, conteudo: string): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("knowledge", { workspace_id: 1, titulo, conteudo });
    return n(row.id);
  }
  const info = getDb().prepare("INSERT INTO knowledge (workspace_id, titulo, conteudo) VALUES (1, ?, ?)").run(titulo, conteudo);
  return Number(info.lastInsertRowid);
}

export async function updateKnowledge(id: number, titulo: string, conteudo: string): Promise<void> {
  if (postgresEnabled()) return void (await pgUpdate("knowledge", id, { titulo, conteudo, atualizado_em: new Date().toISOString() }));
  getDb().prepare("UPDATE knowledge SET titulo = ?, conteudo = ?, atualizado_em = datetime('now') WHERE id = ? AND workspace_id = 1").run(titulo, conteudo, id);
}

export async function deleteKnowledge(id: number): Promise<void> {
  if (postgresEnabled()) return void (await pgDelete("knowledge", id));
  getDb().prepare("DELETE FROM knowledge WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Linha do tempo (events)
// ---------------------------------------------------------------------------

export async function listClientEvents(clientId: number, limit: number): Promise<EventRow[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ tipo: string; descricao: string; criado_em: string }>(
      "events",
      `select=tipo,descricao,criado_em&client_id=eq.${clientId}&order=criado_em.desc&limit=${limit}`
    );
    return rows.map((r) => ({ tipo: r.tipo, descricao: r.descricao, criadoEm: r.criado_em }));
  }
  return getDb()
    .prepare("SELECT tipo, descricao, criado_em AS criadoEm FROM events WHERE client_id = ? ORDER BY criado_em DESC LIMIT ?")
    .all(clientId, limit) as EventRow[];
}

export async function logEvent(clientId: number, tipo: "conversa" | "material" | "observacao" | "resumo" | "sessao", descricao: string): Promise<void> {
  if (postgresEnabled()) {
    await pgInsert("events", { workspace_id: 1, client_id: clientId, tipo, descricao });
    return;
  }
  getDb().prepare("INSERT INTO events (workspace_id, client_id, tipo, descricao) VALUES (1, ?, ?, ?)").run(clientId, tipo, descricao);
}

// ---------------------------------------------------------------------------
// Prontuário (session_notes)
// ---------------------------------------------------------------------------

export async function listSessionNotes(clientId: number): Promise<SessionNote[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; client_id: unknown; data_sessao: string; conteudo: string; criado_por: string; criado_em: string }>(
      "session_notes",
      `select=id,client_id,data_sessao,conteudo,criado_por,criado_em&client_id=eq.${clientId}&order=data_sessao.desc`
    );
    return rows.map((r) => ({ id: n(r.id), clientId: n(r.client_id), dataSessao: r.data_sessao, conteudo: r.conteudo, criadoPor: r.criado_por, criadoEm: r.criado_em }));
  }
  return getDb()
    .prepare("SELECT id, client_id AS clientId, data_sessao AS dataSessao, conteudo, criado_por AS criadoPor, criado_em AS criadoEm FROM session_notes WHERE client_id = ? ORDER BY data_sessao DESC")
    .all(clientId) as SessionNote[];
}

export async function listRecentSessionNotes(clientId: number, limit: number): Promise<{ dataSessao: string; conteudo: string }[]> {
  const notas = await listSessionNotes(clientId);
  return notas.slice(0, limit).map((n2) => ({ dataSessao: n2.dataSessao, conteudo: n2.conteudo }));
}

export async function createSessionNote(input: { clientId: number; dataSessao: string; conteudo: string; criadoPor: string }): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("session_notes", {
      workspace_id: 1,
      client_id: input.clientId,
      data_sessao: input.dataSessao,
      conteudo: input.conteudo,
      criado_por: input.criadoPor,
    });
    return n(row.id);
  }
  const info = getDb()
    .prepare("INSERT INTO session_notes (workspace_id, client_id, data_sessao, conteudo, criado_por) VALUES (1, ?, ?, ?, ?)")
    .run(input.clientId, input.dataSessao, input.conteudo, input.criadoPor);
  return Number(info.lastInsertRowid);
}

export async function deleteSessionNote(id: number): Promise<void> {
  if (postgresEnabled()) return void (await pgDelete("session_notes", id));
  getDb().prepare("DELETE FROM session_notes WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Conversas / mensagens (assistente)
// ---------------------------------------------------------------------------

export async function createConversation(clientId: number, titulo: string): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("conversations", { workspace_id: 1, client_id: clientId, titulo });
    return n(row.id);
  }
  const info = getDb().prepare("INSERT INTO conversations (workspace_id, client_id, titulo) VALUES (1, ?, ?)").run(clientId, titulo);
  return Number(info.lastInsertRowid);
}

export async function getConversationClientId(conversationId: number): Promise<number | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ client_id: unknown }>("conversations", `select=client_id&id=eq.${conversationId}&workspace_id=eq.1&limit=1`);
    return rows[0] ? n(rows[0].client_id) : null;
  }
  const row = getDb().prepare("SELECT client_id FROM conversations WHERE id = ? AND workspace_id = 1").get(conversationId) as { client_id: number } | undefined;
  return row?.client_id ?? null;
}

export async function createMessage(input: { conversationId: number; papel: "usuario" | "assistente"; autor: string; conteudo: string; fontes: unknown[] }): Promise<void> {
  if (postgresEnabled()) {
    // `fontes` é jsonb no Postgres — passa o array puro, não uma string já serializada
    // (senão JSON.stringify(body) escaparia tudo de novo e o jsonb guardaria uma string).
    await pgInsert("messages", { conversation_id: input.conversationId, papel: input.papel, autor: input.autor, conteudo: input.conteudo, fontes: input.fontes });
    return;
  }
  getDb()
    .prepare("INSERT INTO messages (conversation_id, papel, autor, conteudo, fontes) VALUES (?, ?, ?, ?, ?)")
    .run(input.conversationId, input.papel, input.autor, input.conteudo, JSON.stringify(input.fontes));
}

export async function listRecentMessages(clientId: number, limit: number): Promise<MessageRow[]> {
  if (postgresEnabled()) {
    const convs = await pgSelect<{ id: unknown }>("conversations", `select=id&client_id=eq.${clientId}`);
    if (convs.length === 0) return [];
    const ids = convs.map((c) => n(c.id)).join(",");
    const rows = await pgSelect<{ papel: "usuario" | "assistente"; autor: string; conteudo: string; criado_em: string; id: unknown }>(
      "messages",
      `select=id,papel,autor,conteudo,criado_em&conversation_id=in.(${ids})&order=id.desc&limit=${limit}`
    );
    return rows.reverse().map((r) => ({ papel: r.papel, autor: r.autor, conteudo: r.conteudo, criadoEm: r.criado_em }));
  }
  return (
    getDb()
      .prepare(
        `SELECT m.papel, m.autor, m.conteudo, m.criado_em AS criadoEm FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.client_id = ? ORDER BY m.id DESC LIMIT ?`
      )
      .all(clientId, limit) as MessageRow[]
  ).reverse();
}

export async function listAllMessages(clientId: number): Promise<MessageRow[]> {
  if (postgresEnabled()) {
    const convs = await pgSelect<{ id: unknown }>("conversations", `select=id&client_id=eq.${clientId}`);
    if (convs.length === 0) return [];
    const ids = convs.map((c) => n(c.id)).join(",");
    const rows = await pgSelect<{ papel: "usuario" | "assistente"; autor: string; conteudo: string; criado_em: string; id: unknown }>(
      "messages",
      `select=id,papel,autor,conteudo,criado_em&conversation_id=in.(${ids})&order=id.asc&limit=200`
    );
    return rows.map((r) => ({ papel: r.papel, autor: r.autor, conteudo: r.conteudo, criadoEm: r.criado_em }));
  }
  return getDb()
    .prepare(
      `SELECT m.papel, m.autor, m.conteudo, m.criado_em AS criadoEm FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.client_id = ? ORDER BY m.id ASC LIMIT 200`
    )
    .all(clientId) as MessageRow[];
}

// ---------------------------------------------------------------------------
// Escopo do assistente (agent_settings) — cria com valores padrão se não existir
// ---------------------------------------------------------------------------

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  usaBiblioteca: true,
  usaMetodologia: true,
  usaHistorico: true,
  usaProntuario: true,
  instrucoesExtra: "",
  tom: "acolhedor",
};

export async function getAgentSettings(): Promise<AgentSettings> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{
      usa_biblioteca: unknown;
      usa_metodologia: unknown;
      usa_historico: unknown;
      usa_prontuario: unknown;
      instrucoes_extra: string;
      tom: string;
    }>("agent_settings", "select=usa_biblioteca,usa_metodologia,usa_historico,usa_prontuario,instrucoes_extra,tom&workspace_id=eq.1&limit=1");
    if (rows.length === 0) {
      await pgInsert("agent_settings", { workspace_id: 1 });
      return DEFAULT_AGENT_SETTINGS;
    }
    const r = rows[0];
    return {
      usaBiblioteca: b(r.usa_biblioteca),
      usaMetodologia: b(r.usa_metodologia),
      usaHistorico: b(r.usa_historico),
      usaProntuario: b(r.usa_prontuario),
      instrucoesExtra: r.instrucoes_extra ?? "",
      tom: (r.tom as AgentSettings["tom"]) ?? "acolhedor",
    };
  }
  const db = getDb();
  const row = db
    .prepare("SELECT usa_biblioteca, usa_metodologia, usa_historico, usa_prontuario, instrucoes_extra, tom FROM agent_settings WHERE workspace_id = 1 LIMIT 1")
    .get() as { usa_biblioteca: number; usa_metodologia: number; usa_historico: number; usa_prontuario: number; instrucoes_extra: string; tom: string } | undefined;
  if (!row) {
    db.prepare("INSERT INTO agent_settings (workspace_id) VALUES (1)").run();
    return DEFAULT_AGENT_SETTINGS;
  }
  return {
    usaBiblioteca: !!row.usa_biblioteca,
    usaMetodologia: !!row.usa_metodologia,
    usaHistorico: !!row.usa_historico,
    usaProntuario: !!row.usa_prontuario,
    instrucoesExtra: row.instrucoes_extra ?? "",
    tom: (row.tom as AgentSettings["tom"]) ?? "acolhedor",
  };
}

export async function updateAgentSettings(input: AgentSettings): Promise<void> {
  const body = {
    usa_biblioteca: input.usaBiblioteca,
    usa_metodologia: input.usaMetodologia,
    usa_historico: input.usaHistorico,
    usa_prontuario: input.usaProntuario,
    instrucoes_extra: input.instrucoesExtra,
    tom: input.tom,
  };
  if (postgresEnabled()) {
    await pgRequest(`/agent_settings?workspace_id=eq.1`, { method: "PATCH", body: JSON.stringify(body) });
    return;
  }
  getDb()
    .prepare("UPDATE agent_settings SET usa_biblioteca=?, usa_metodologia=?, usa_historico=?, usa_prontuario=?, instrucoes_extra=?, tom=? WHERE workspace_id = 1")
    .run(body.usa_biblioteca ? 1 : 0, body.usa_metodologia ? 1 : 0, body.usa_historico ? 1 : 0, body.usa_prontuario ? 1 : 0, body.instrucoes_extra, body.tom);
}
