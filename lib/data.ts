import { getDb } from "./db";
import { supabaseUrl } from "./supabase-auth";
import { PROTOCOLOS_BUILTIN, type CampoTipo, type TabelaConfig } from "./protocolos-builtin";

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
 * Modelo do domínio: uma "participante" é a psicopedagoga em formação na
 * mentoria; cada participante acompanha um ou mais "casos clínicos" (as
 * crianças que ela atende fora da plataforma); protocolo, hipóteses e
 * registros de raciocínio clínico pertencem ao caso, não à participante.
 *
 * Toda a autorização (quem pode ver/editar o quê) continua sendo feita nas
 * rotas de API — aqui usamos a service_role key, que ignora RLS por design;
 * o RLS em supabase/schema.sql é defesa em profundidade, não a fronteira
 * principal de autorização deste app.
 */

export type Role = "mentora" | "participante";

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

export type Participant = {
  id: number;
  userId: number | null;
  nome: string;
  email: string;
  estagioMentoria: string;
  observacoesMentora: string;
  criadoEm: string;
};

export type ParticipantInput = { nome: string; email: string; estagioMentoria: string; observacoesMentora: string };

export type ClinicalCase = {
  id: number;
  participantId: number;
  nome: string;
  idade: number | null;
  diagnosticoPreliminar: string;
  escolaSerie: string;
  responsavelNome: string;
  responsavelContato: string;
  queixaPrincipal: string;
  objetivo: string;
  observacoes: string;
  status: "ativo" | "encerrado";
  criadoEm: string;
};

export type ClinicalCaseInput = {
  nome: string;
  idade: number | null;
  diagnosticoPreliminar: string;
  escolaSerie: string;
  responsavelNome: string;
  responsavelContato: string;
  queixaPrincipal: string;
  objetivo: string;
  observacoes: string;
};

export type Category = { id: number; nome: string; parentId: number | null };

export type DocumentRow = {
  id: number;
  categoriaId: number | null;
  caseId: number | null;
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

export type CaseNote = { id: number; caseId: number; dataSessao: string; conteudo: string; criadoPor: string; criadoEm: string };

export type MessageRow = { papel: "usuario" | "assistente"; autor: string; conteudo: string; criadoEm: string };

export type Hypothesis = {
  id: number;
  caseId: number;
  texto: string;
  status: "ativa" | "confirmada" | "descartada";
  evidenciasFavor: string;
  evidenciasContra: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type AgentSettings = {
  usaBiblioteca: boolean;
  usaMetodologia: boolean;
  usaHistorico: boolean;
  usaProntuario: boolean;
  usaProtocolos: boolean;
  instrucoesExtra: string;
  tom: "acolhedor" | "formal" | "direto";
  modelo: string;
};

// ---------------------------------------------------------------------------
// Protocolos
// ---------------------------------------------------------------------------

export type ProtocolField = { id: number; chave: string; label: string; tipo: CampoTipo; opcoes: string[] | TabelaConfig | null };
export type ProtocolSection = { id: number; titulo: string; campos: ProtocolField[] };
export type Protocol = { id: number; nome: string; descricao: string; versao: string; secoes: ProtocolSection[] };
export type ProtocolSummary = { id: number; nome: string; descricao: string; versao: string };

export type ProtocolAssignment = {
  id: number;
  caseId: number;
  protocolId: number;
  protocolNome: string;
  dataAplicacao: string;
  status: "em_andamento" | "concluido";
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type ProtocolResponseValue = string | number | string[] | Record<string, Record<string, string | number>> | null;
export type ProtocolResponse = { fieldId: number; valor: ProtocolResponseValue };

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
    return rows[0]?.nome ?? "Comunicar & Aprender";
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

export async function getParticipantByUserId(userId: number): Promise<{ id: number } | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("participants", `select=id&user_id=eq.${userId}&workspace_id=eq.1&limit=1`);
    return rows[0] ? { id: n(rows[0].id) } : null;
  }
  return (getDb().prepare("SELECT id FROM participants WHERE user_id = ? AND workspace_id = 1").get(userId) as { id: number } | undefined) ?? null;
}

export async function getParticipantByEmail(email: string): Promise<{ id: number } | null> {
  const lower = email.toLowerCase();
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; email: string }>("participants", "select=id,email&workspace_id=eq.1");
    const match = rows.find((r) => r.email.toLowerCase() === lower);
    return match ? { id: n(match.id) } : null;
  }
  return (
    (getDb().prepare("SELECT id FROM participants WHERE lower(email) = lower(?) AND workspace_id = 1").get(lower) as { id: number } | undefined) ??
    null
  );
}

export async function linkParticipantUser(participantId: number, userId: number): Promise<void> {
  if (postgresEnabled()) return void (await pgUpdate("participants", participantId, { user_id: userId }));
  getDb().prepare("UPDATE participants SET user_id = ? WHERE id = ?").run(userId, participantId);
}

export async function createParticipantForUser(input: { userId: number; nome: string; email: string }): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("participants", { workspace_id: 1, user_id: input.userId, nome: input.nome, email: input.email });
    return n(row.id);
  }
  const info = getDb()
    .prepare("INSERT INTO participants (workspace_id, user_id, nome, email) VALUES (1, ?, ?, ?)")
    .run(input.userId, input.nome, input.email);
  return Number(info.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------

type ParticipantDbRow = {
  id: unknown;
  user_id: unknown;
  nome: string;
  email: string;
  estagio_mentoria: string;
  observacoes_mentora: string;
  criado_em: string;
};

function mapParticipant(r: ParticipantDbRow): Participant {
  return {
    id: n(r.id),
    userId: nOrNull(r.user_id),
    nome: r.nome,
    email: r.email,
    estagioMentoria: r.estagio_mentoria ?? "",
    observacoesMentora: r.observacoes_mentora ?? "",
    criadoEm: r.criado_em,
  };
}

const PARTICIPANT_COLS = "id,user_id,nome,email,estagio_mentoria,observacoes_mentora,criado_em";

export async function listParticipants(): Promise<Participant[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<ParticipantDbRow>("participants", `select=${PARTICIPANT_COLS}&workspace_id=eq.1&order=nome.asc`);
    return rows.map(mapParticipant);
  }
  return (getDb().prepare(`SELECT ${PARTICIPANT_COLS} FROM participants WHERE workspace_id = 1 ORDER BY nome`).all() as ParticipantDbRow[]).map(
    mapParticipant
  );
}

export async function listParticipantsWithLastEvent(): Promise<(Participant & { ultimoEvento: string | null })[]> {
  const participantes = await listParticipants();
  if (postgresEnabled()) {
    const events = await pgSelect<{ participant_id: unknown; criado_em: string }>("events", "select=participant_id,criado_em&workspace_id=eq.1");
    const last = new Map<number, string>();
    for (const e of events) {
      const pid = n(e.participant_id);
      const prev = last.get(pid);
      if (!prev || e.criado_em > prev) last.set(pid, e.criado_em);
    }
    return participantes.map((p) => ({ ...p, ultimoEvento: last.get(p.id) ?? null }));
  }
  const db = getDb();
  return participantes.map((p) => {
    const row = db.prepare("SELECT MAX(criado_em) m FROM events WHERE participant_id = ?").get(p.id) as { m: string | null };
    return { ...p, ultimoEvento: row.m };
  });
}

export async function getParticipant(id: number): Promise<Participant | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<ParticipantDbRow>("participants", `select=${PARTICIPANT_COLS}&id=eq.${id}&workspace_id=eq.1&limit=1`);
    return rows[0] ? mapParticipant(rows[0]) : null;
  }
  const row = getDb().prepare(`SELECT ${PARTICIPANT_COLS} FROM participants WHERE id = ? AND workspace_id = 1`).get(id) as
    | ParticipantDbRow
    | undefined;
  return row ? mapParticipant(row) : null;
}

function participantBody(input: ParticipantInput) {
  return {
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    estagio_mentoria: input.estagioMentoria ?? "",
    observacoes_mentora: input.observacoesMentora ?? "",
  };
}

export async function createParticipant(input: ParticipantInput): Promise<number> {
  const body = participantBody(input);
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("participants", { workspace_id: 1, ...body });
    return n(row.id);
  }
  const info = getDb()
    .prepare(`INSERT INTO participants (workspace_id, nome, email, estagio_mentoria, observacoes_mentora) VALUES (1, ?, ?, ?, ?)`)
    .run(body.nome, body.email, body.estagio_mentoria, body.observacoes_mentora);
  return Number(info.lastInsertRowid);
}

export async function updateParticipant(id: number, input: ParticipantInput): Promise<void> {
  const body = participantBody(input);
  if (postgresEnabled()) return void (await pgUpdate("participants", id, body));
  getDb()
    .prepare(`UPDATE participants SET nome=?, email=?, estagio_mentoria=?, observacoes_mentora=? WHERE id = ?`)
    .run(body.nome, body.email, body.estagio_mentoria, body.observacoes_mentora, id);
}

export async function countParticipants(): Promise<number> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("participants", "select=id&workspace_id=eq.1");
    return rows.length;
  }
  return (getDb().prepare("SELECT COUNT(*) c FROM participants WHERE workspace_id = 1").get() as { c: number }).c;
}

// ---------------------------------------------------------------------------
// Casos clínicos
// ---------------------------------------------------------------------------

type CaseDbRow = {
  id: unknown;
  participant_id: unknown;
  nome: string;
  idade: unknown;
  diagnostico_preliminar: string;
  escola_serie: string;
  responsavel_nome: string;
  responsavel_contato: string;
  queixa_principal: string;
  objetivo: string;
  observacoes: string;
  status: "ativo" | "encerrado";
  criado_em: string;
};

function mapCase(r: CaseDbRow): ClinicalCase {
  return {
    id: n(r.id),
    participantId: n(r.participant_id),
    nome: r.nome,
    idade: nOrNull(r.idade),
    diagnosticoPreliminar: r.diagnostico_preliminar ?? "",
    escolaSerie: r.escola_serie ?? "",
    responsavelNome: r.responsavel_nome ?? "",
    responsavelContato: r.responsavel_contato ?? "",
    queixaPrincipal: r.queixa_principal ?? "",
    objetivo: r.objetivo ?? "",
    observacoes: r.observacoes ?? "",
    status: r.status ?? "ativo",
    criadoEm: r.criado_em,
  };
}

const CASE_COLS =
  "id,participant_id,nome,idade,diagnostico_preliminar,escola_serie,responsavel_nome,responsavel_contato,queixa_principal,objetivo,observacoes,status,criado_em";

export async function listCasesByParticipant(participantId: number): Promise<ClinicalCase[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<CaseDbRow>("clinical_cases", `select=${CASE_COLS}&participant_id=eq.${participantId}&order=criado_em.desc`);
    return rows.map(mapCase);
  }
  return (
    getDb().prepare(`SELECT ${CASE_COLS} FROM clinical_cases WHERE participant_id = ? ORDER BY criado_em DESC`).all(participantId) as CaseDbRow[]
  ).map(mapCase);
}

export async function getCase(id: number): Promise<ClinicalCase | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<CaseDbRow>("clinical_cases", `select=${CASE_COLS}&id=eq.${id}&workspace_id=eq.1&limit=1`);
    return rows[0] ? mapCase(rows[0]) : null;
  }
  const row = getDb().prepare(`SELECT ${CASE_COLS} FROM clinical_cases WHERE id = ? AND workspace_id = 1`).get(id) as CaseDbRow | undefined;
  return row ? mapCase(row) : null;
}

function caseBody(input: ClinicalCaseInput) {
  return {
    nome: input.nome.trim(),
    idade: input.idade,
    diagnostico_preliminar: input.diagnosticoPreliminar ?? "",
    escola_serie: input.escolaSerie ?? "",
    responsavel_nome: input.responsavelNome ?? "",
    responsavel_contato: input.responsavelContato ?? "",
    queixa_principal: input.queixaPrincipal ?? "",
    objetivo: input.objetivo ?? "",
    observacoes: input.observacoes ?? "",
  };
}

export async function createCase(participantId: number, input: ClinicalCaseInput): Promise<number> {
  const body = caseBody(input);
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("clinical_cases", { workspace_id: 1, participant_id: participantId, ...body });
    return n(row.id);
  }
  const info = getDb()
    .prepare(
      `INSERT INTO clinical_cases (workspace_id, participant_id, nome, idade, diagnostico_preliminar, escola_serie, responsavel_nome, responsavel_contato, queixa_principal, objetivo, observacoes)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      participantId,
      body.nome,
      body.idade,
      body.diagnostico_preliminar,
      body.escola_serie,
      body.responsavel_nome,
      body.responsavel_contato,
      body.queixa_principal,
      body.objetivo,
      body.observacoes
    );
  return Number(info.lastInsertRowid);
}

export async function updateCase(id: number, input: ClinicalCaseInput): Promise<void> {
  const body = caseBody(input);
  if (postgresEnabled()) return void (await pgUpdate("clinical_cases", id, body));
  getDb()
    .prepare(
      `UPDATE clinical_cases SET nome=?, idade=?, diagnostico_preliminar=?, escola_serie=?, responsavel_nome=?, responsavel_contato=?, queixa_principal=?, objetivo=?, observacoes=? WHERE id = ?`
    )
    .run(
      body.nome,
      body.idade,
      body.diagnostico_preliminar,
      body.escola_serie,
      body.responsavel_nome,
      body.responsavel_contato,
      body.queixa_principal,
      body.objetivo,
      body.observacoes,
      id
    );
}

export async function updateCaseStatus(id: number, status: "ativo" | "encerrado"): Promise<void> {
  if (postgresEnabled()) return void (await pgUpdate("clinical_cases", id, { status }));
  getDb().prepare("UPDATE clinical_cases SET status = ? WHERE id = ?").run(status, id);
}

export async function countActiveCases(): Promise<number> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown }>("clinical_cases", "select=id&workspace_id=eq.1&status=eq.ativo");
    return rows.length;
  }
  return (getDb().prepare("SELECT COUNT(*) c FROM clinical_cases WHERE workspace_id = 1 AND status = 'ativo'").get() as { c: number }).c;
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
  case_id: unknown;
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
    caseId: nOrNull(r.case_id),
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

const DOC_COLS = "id,categoria_id,case_id,nome,tipo,tamanho,storage_path,conteudo,disponivel_assistente,enviado_por,criado_em";

export async function listLibraryDocuments(): Promise<DocumentRow[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<DocDbRow>("documents", `select=${DOC_COLS}&workspace_id=eq.1&categoria_id=not.is.null&order=nome.asc`);
    return rows.map(mapDoc);
  }
  return (getDb().prepare(`SELECT ${DOC_COLS} FROM documents WHERE workspace_id = 1 AND categoria_id IS NOT NULL ORDER BY nome`).all() as DocDbRow[]).map(mapDoc);
}

export async function listCaseDocuments(caseId: number): Promise<DocumentRow[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<DocDbRow>("documents", `select=${DOC_COLS}&case_id=eq.${caseId}&order=criado_em.desc`);
    return rows.map(mapDoc);
  }
  return (getDb().prepare(`SELECT ${DOC_COLS} FROM documents WHERE case_id = ? ORDER BY criado_em DESC`).all(caseId) as DocDbRow[]).map(mapDoc);
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
  caseId: number | null;
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
      case_id: input.caseId,
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
      "INSERT INTO documents (workspace_id, categoria_id, case_id, nome, tipo, tamanho, storage_path, conteudo, enviado_por) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(input.categoriaId, input.caseId, input.nome, input.tipo, input.tamanho, input.storagePath, input.conteudo, input.enviadoPor);
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

export async function listParticipantEvents(participantId: number, limit: number): Promise<EventRow[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ tipo: string; descricao: string; criado_em: string }>(
      "events",
      `select=tipo,descricao,criado_em&participant_id=eq.${participantId}&order=criado_em.desc&limit=${limit}`
    );
    return rows.map((r) => ({ tipo: r.tipo, descricao: r.descricao, criadoEm: r.criado_em }));
  }
  return getDb()
    .prepare("SELECT tipo, descricao, criado_em AS criadoEm FROM events WHERE participant_id = ? ORDER BY criado_em DESC LIMIT ?")
    .all(participantId, limit) as EventRow[];
}

export async function listCaseEvents(caseId: number, limit: number): Promise<EventRow[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ tipo: string; descricao: string; criado_em: string }>(
      "events",
      `select=tipo,descricao,criado_em&case_id=eq.${caseId}&order=criado_em.desc&limit=${limit}`
    );
    return rows.map((r) => ({ tipo: r.tipo, descricao: r.descricao, criadoEm: r.criado_em }));
  }
  return getDb()
    .prepare("SELECT tipo, descricao, criado_em AS criadoEm FROM events WHERE case_id = ? ORDER BY criado_em DESC LIMIT ?")
    .all(caseId, limit) as EventRow[];
}

export type EventTipo = "conversa" | "material" | "observacao" | "resumo" | "sessao" | "protocolo" | "hipotese";

export async function logEvent(participantId: number, caseId: number | null, tipo: EventTipo, descricao: string): Promise<void> {
  if (postgresEnabled()) {
    await pgInsert("events", { workspace_id: 1, participant_id: participantId, case_id: caseId, tipo, descricao });
    return;
  }
  getDb().prepare("INSERT INTO events (workspace_id, participant_id, case_id, tipo, descricao) VALUES (1, ?, ?, ?, ?)").run(participantId, caseId, tipo, descricao);
}

// ---------------------------------------------------------------------------
// Registros de raciocínio clínico por caso (case_notes)
// ---------------------------------------------------------------------------

export async function listCaseNotes(caseId: number): Promise<CaseNote[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; case_id: unknown; data_sessao: string; conteudo: string; criado_por: string; criado_em: string }>(
      "case_notes",
      `select=id,case_id,data_sessao,conteudo,criado_por,criado_em&case_id=eq.${caseId}&order=data_sessao.desc`
    );
    return rows.map((r) => ({ id: n(r.id), caseId: n(r.case_id), dataSessao: r.data_sessao, conteudo: r.conteudo, criadoPor: r.criado_por, criadoEm: r.criado_em }));
  }
  return getDb()
    .prepare("SELECT id, case_id AS caseId, data_sessao AS dataSessao, conteudo, criado_por AS criadoPor, criado_em AS criadoEm FROM case_notes WHERE case_id = ? ORDER BY data_sessao DESC")
    .all(caseId) as CaseNote[];
}

export async function listRecentCaseNotes(caseId: number, limit: number): Promise<{ dataSessao: string; conteudo: string }[]> {
  const notas = await listCaseNotes(caseId);
  return notas.slice(0, limit).map((n2) => ({ dataSessao: n2.dataSessao, conteudo: n2.conteudo }));
}

export async function createCaseNote(input: { caseId: number; dataSessao: string; conteudo: string; criadoPor: string }): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("case_notes", {
      workspace_id: 1,
      case_id: input.caseId,
      data_sessao: input.dataSessao,
      conteudo: input.conteudo,
      criado_por: input.criadoPor,
    });
    return n(row.id);
  }
  const info = getDb()
    .prepare("INSERT INTO case_notes (workspace_id, case_id, data_sessao, conteudo, criado_por) VALUES (1, ?, ?, ?, ?)")
    .run(input.caseId, input.dataSessao, input.conteudo, input.criadoPor);
  return Number(info.lastInsertRowid);
}

export async function deleteCaseNote(id: number): Promise<void> {
  if (postgresEnabled()) return void (await pgDelete("case_notes", id));
  getDb().prepare("DELETE FROM case_notes WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Hipóteses clínicas por caso
// ---------------------------------------------------------------------------

function mapHypothesis(r: {
  id: unknown;
  case_id: unknown;
  texto: string;
  status: "ativa" | "confirmada" | "descartada";
  evidencias_favor: string;
  evidencias_contra: string;
  criado_em: string;
  atualizado_em: string;
}): Hypothesis {
  return {
    id: n(r.id),
    caseId: n(r.case_id),
    texto: r.texto,
    status: r.status,
    evidenciasFavor: r.evidencias_favor ?? "",
    evidenciasContra: r.evidencias_contra ?? "",
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

const HYPOTHESIS_COLS = "id,case_id,texto,status,evidencias_favor,evidencias_contra,criado_em,atualizado_em";

export async function listHypotheses(caseId: number): Promise<Hypothesis[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<Parameters<typeof mapHypothesis>[0]>(
      "hypotheses",
      `select=${HYPOTHESIS_COLS}&case_id=eq.${caseId}&order=criado_em.desc`
    );
    return rows.map(mapHypothesis);
  }
  return (
    getDb().prepare(`SELECT ${HYPOTHESIS_COLS} FROM hypotheses WHERE case_id = ? ORDER BY criado_em DESC`).all(caseId) as Parameters<
      typeof mapHypothesis
    >[0][]
  ).map(mapHypothesis);
}

export async function createHypothesis(input: { caseId: number; texto: string; evidenciasFavor: string; evidenciasContra: string }): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("hypotheses", {
      workspace_id: 1,
      case_id: input.caseId,
      texto: input.texto,
      evidencias_favor: input.evidenciasFavor,
      evidencias_contra: input.evidenciasContra,
    });
    return n(row.id);
  }
  const info = getDb()
    .prepare("INSERT INTO hypotheses (workspace_id, case_id, texto, evidencias_favor, evidencias_contra) VALUES (1, ?, ?, ?, ?)")
    .run(input.caseId, input.texto, input.evidenciasFavor, input.evidenciasContra);
  return Number(info.lastInsertRowid);
}

export async function updateHypothesis(
  id: number,
  input: { status?: "ativa" | "confirmada" | "descartada"; evidenciasFavor?: string; evidenciasContra?: string }
): Promise<void> {
  const body: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (input.status !== undefined) body.status = input.status;
  if (input.evidenciasFavor !== undefined) body.evidencias_favor = input.evidenciasFavor;
  if (input.evidenciasContra !== undefined) body.evidencias_contra = input.evidenciasContra;
  if (postgresEnabled()) {
    await pgRequest(`/hypotheses?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(body) });
    return;
  }
  const db = getDb();
  if (input.status !== undefined) db.prepare("UPDATE hypotheses SET status = ?, atualizado_em = datetime('now') WHERE id = ?").run(input.status, id);
  if (input.evidenciasFavor !== undefined)
    db.prepare("UPDATE hypotheses SET evidencias_favor = ?, atualizado_em = datetime('now') WHERE id = ?").run(input.evidenciasFavor, id);
  if (input.evidenciasContra !== undefined)
    db.prepare("UPDATE hypotheses SET evidencias_contra = ?, atualizado_em = datetime('now') WHERE id = ?").run(input.evidenciasContra, id);
}

export async function deleteHypothesis(id: number): Promise<void> {
  if (postgresEnabled()) return void (await pgDelete("hypotheses", id));
  getDb().prepare("DELETE FROM hypotheses WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Conversas / mensagens (assistente)
// ---------------------------------------------------------------------------

export async function createConversation(participantId: number, caseId: number | null, titulo: string): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("conversations", { workspace_id: 1, participant_id: participantId, case_id: caseId, titulo });
    return n(row.id);
  }
  const info = getDb()
    .prepare("INSERT INTO conversations (workspace_id, participant_id, case_id, titulo) VALUES (1, ?, ?, ?)")
    .run(participantId, caseId, titulo);
  return Number(info.lastInsertRowid);
}

export async function getConversationContext(conversationId: number): Promise<{ participantId: number; caseId: number | null } | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ participant_id: unknown; case_id: unknown }>(
      "conversations",
      `select=participant_id,case_id&id=eq.${conversationId}&workspace_id=eq.1&limit=1`
    );
    return rows[0] ? { participantId: n(rows[0].participant_id), caseId: nOrNull(rows[0].case_id) } : null;
  }
  const row = getDb().prepare("SELECT participant_id, case_id FROM conversations WHERE id = ? AND workspace_id = 1").get(conversationId) as
    | { participant_id: number; case_id: number | null }
    | undefined;
  return row ? { participantId: row.participant_id, caseId: row.case_id ?? null } : null;
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

/** Mensagens recentes da conversa no mesmo escopo (geral da participante quando caseId=null, ou de um caso específico). */
export async function listRecentMessages(participantId: number, caseId: number | null, limit: number): Promise<MessageRow[]> {
  if (postgresEnabled()) {
    const filtroCaso = caseId === null ? "case_id=is.null" : `case_id=eq.${caseId}`;
    const convs = await pgSelect<{ id: unknown }>("conversations", `select=id&participant_id=eq.${participantId}&${filtroCaso}`);
    if (convs.length === 0) return [];
    const ids = convs.map((c) => n(c.id)).join(",");
    const rows = await pgSelect<{ papel: "usuario" | "assistente"; autor: string; conteudo: string; criado_em: string; id: unknown }>(
      "messages",
      `select=id,papel,autor,conteudo,criado_em&conversation_id=in.(${ids})&order=id.desc&limit=${limit}`
    );
    return rows.reverse().map((r) => ({ papel: r.papel, autor: r.autor, conteudo: r.conteudo, criadoEm: r.criado_em }));
  }
  const filtroCaso = caseId === null ? "c.case_id IS NULL" : "c.case_id = ?";
  const params = caseId === null ? [participantId, limit] : [participantId, caseId, limit];
  return (
    getDb()
      .prepare(
        `SELECT m.papel, m.autor, m.conteudo, m.criado_em AS criadoEm FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.participant_id = ? AND ${filtroCaso} ORDER BY m.id DESC LIMIT ?`
      )
      .all(...params) as MessageRow[]
  ).reverse();
}

/** Todas as mensagens da participante (qualquer caso), usadas para montar o resumo pré-encontro. */
export async function listAllMessagesForParticipant(participantId: number): Promise<MessageRow[]> {
  if (postgresEnabled()) {
    const convs = await pgSelect<{ id: unknown }>("conversations", `select=id&participant_id=eq.${participantId}`);
    if (convs.length === 0) return [];
    const ids = convs.map((c) => n(c.id)).join(",");
    const rows = await pgSelect<{ papel: "usuario" | "assistente"; autor: string; conteudo: string; criado_em: string; id: unknown }>(
      "messages",
      `select=id,papel,autor,conteudo,criado_em&conversation_id=in.(${ids})&order=id.asc&limit=400`
    );
    return rows.map((r) => ({ papel: r.papel, autor: r.autor, conteudo: r.conteudo, criadoEm: r.criado_em }));
  }
  return getDb()
    .prepare(
      `SELECT m.papel, m.autor, m.conteudo, m.criado_em AS criadoEm FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.participant_id = ? ORDER BY m.id ASC LIMIT 400`
    )
    .all(participantId) as MessageRow[];
}

// ---------------------------------------------------------------------------
// Escopo do assistente (agent_settings) — cria com valores padrão se não existir
// ---------------------------------------------------------------------------

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  usaBiblioteca: true,
  usaMetodologia: true,
  usaHistorico: true,
  usaProntuario: true,
  usaProtocolos: true,
  instrucoesExtra: "",
  tom: "acolhedor",
  modelo: "",
};

export async function getAgentSettings(): Promise<AgentSettings> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{
      usa_biblioteca: unknown;
      usa_metodologia: unknown;
      usa_historico: unknown;
      usa_prontuario: unknown;
      usa_protocolos: unknown;
      instrucoes_extra: string;
      tom: string;
      modelo: string;
    }>("agent_settings", "select=usa_biblioteca,usa_metodologia,usa_historico,usa_prontuario,usa_protocolos,instrucoes_extra,tom,modelo&workspace_id=eq.1&limit=1");
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
      usaProtocolos: r.usa_protocolos === null || r.usa_protocolos === undefined ? true : b(r.usa_protocolos),
      instrucoesExtra: r.instrucoes_extra ?? "",
      tom: (r.tom as AgentSettings["tom"]) ?? "acolhedor",
      modelo: r.modelo ?? "",
    };
  }
  const db = getDb();
  const row = db
    .prepare("SELECT usa_biblioteca, usa_metodologia, usa_historico, usa_prontuario, usa_protocolos, instrucoes_extra, tom, modelo FROM agent_settings WHERE workspace_id = 1 LIMIT 1")
    .get() as
    | { usa_biblioteca: number; usa_metodologia: number; usa_historico: number; usa_prontuario: number; usa_protocolos: number; instrucoes_extra: string; tom: string; modelo: string }
    | undefined;
  if (!row) {
    db.prepare("INSERT INTO agent_settings (workspace_id) VALUES (1)").run();
    return DEFAULT_AGENT_SETTINGS;
  }
  return {
    usaBiblioteca: !!row.usa_biblioteca,
    usaMetodologia: !!row.usa_metodologia,
    usaHistorico: !!row.usa_historico,
    usaProntuario: !!row.usa_prontuario,
    usaProtocolos: !!row.usa_protocolos,
    instrucoesExtra: row.instrucoes_extra ?? "",
    tom: (row.tom as AgentSettings["tom"]) ?? "acolhedor",
    modelo: row.modelo ?? "",
  };
}

export async function updateAgentSettings(input: AgentSettings): Promise<void> {
  const body = {
    usa_biblioteca: input.usaBiblioteca,
    usa_metodologia: input.usaMetodologia,
    usa_historico: input.usaHistorico,
    usa_prontuario: input.usaProntuario,
    usa_protocolos: input.usaProtocolos,
    instrucoes_extra: input.instrucoesExtra,
    tom: input.tom,
    modelo: input.modelo ?? "",
  };
  if (postgresEnabled()) {
    await pgRequest(`/agent_settings?workspace_id=eq.1`, { method: "PATCH", body: JSON.stringify(body) });
    return;
  }
  getDb()
    .prepare(
      "UPDATE agent_settings SET usa_biblioteca=?, usa_metodologia=?, usa_historico=?, usa_prontuario=?, usa_protocolos=?, instrucoes_extra=?, tom=?, modelo=? WHERE workspace_id = 1"
    )
    .run(
      body.usa_biblioteca ? 1 : 0,
      body.usa_metodologia ? 1 : 0,
      body.usa_historico ? 1 : 0,
      body.usa_prontuario ? 1 : 0,
      body.usa_protocolos ? 1 : 0,
      body.instrucoes_extra,
      body.tom,
      body.modelo
    );
}

// ---------------------------------------------------------------------------
// Protocolos: CRUD + sincronização dos protocolos internalizados no código
// ---------------------------------------------------------------------------

export async function listProtocolSummaries(): Promise<ProtocolSummary[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; descricao: string; versao: string }>(
      "protocols",
      "select=id,nome,descricao,versao&workspace_id=eq.1&order=nome.asc"
    );
    return rows.map((r) => ({ id: n(r.id), nome: r.nome, descricao: r.descricao, versao: r.versao }));
  }
  return getDb().prepare("SELECT id, nome, descricao, versao FROM protocols WHERE workspace_id = 1 ORDER BY nome").all() as ProtocolSummary[];
}

export async function getProtocol(id: number): Promise<Protocol | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ id: unknown; nome: string; descricao: string; versao: string }>(
      "protocols",
      `select=id,nome,descricao,versao&id=eq.${id}&workspace_id=eq.1&limit=1`
    );
    if (rows.length === 0) return null;
    const secoes = await pgSelect<{ id: unknown; titulo: string; ordem: unknown }>(
      "protocol_sections",
      `select=id,titulo,ordem&protocol_id=eq.${id}&order=ordem.asc`
    );
    const secaoIds = secoes.map((s) => n(s.id));
    const campos = secaoIds.length
      ? await pgSelect<{ id: unknown; section_id: unknown; chave: string; label: string; tipo: CampoTipo; opcoes: string; ordem: unknown }>(
          "protocol_fields",
          `select=id,section_id,chave,label,tipo,opcoes,ordem&section_id=in.(${secaoIds.join(",")})&order=ordem.asc`
        )
      : [];
    return {
      id: n(rows[0].id),
      nome: rows[0].nome,
      descricao: rows[0].descricao,
      versao: rows[0].versao,
      secoes: secoes.map((s) => ({
        id: n(s.id),
        titulo: s.titulo,
        campos: campos
          .filter((c) => n(c.section_id) === n(s.id))
          .map((c) => ({ id: n(c.id), chave: c.chave, label: c.label, tipo: c.tipo, opcoes: c.opcoes ? JSON.parse(c.opcoes) : null })),
      })),
    };
  }
  const db = getDb();
  const row = db.prepare("SELECT id, nome, descricao, versao FROM protocols WHERE id = ? AND workspace_id = 1").get(id) as
    | { id: number; nome: string; descricao: string; versao: string }
    | undefined;
  if (!row) return null;
  const secoes = db.prepare("SELECT id, titulo FROM protocol_sections WHERE protocol_id = ? ORDER BY ordem").all(id) as { id: number; titulo: string }[];
  return {
    ...row,
    secoes: secoes.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      campos: (
        db.prepare("SELECT id, chave, label, tipo, opcoes FROM protocol_fields WHERE section_id = ? ORDER BY ordem").all(s.id) as {
          id: number;
          chave: string;
          label: string;
          tipo: CampoTipo;
          opcoes: string;
        }[]
      ).map((c) => ({ id: c.id, chave: c.chave, label: c.label, tipo: c.tipo, opcoes: c.opcoes ? JSON.parse(c.opcoes) : null })),
    })),
  };
}

async function createProtocol(def: (typeof PROTOCOLOS_BUILTIN)[number]): Promise<void> {
  if (postgresEnabled()) {
    const protocol = await pgInsert<{ id: unknown }>("protocols", { workspace_id: 1, nome: def.nome, descricao: def.descricao, versao: def.versao });
    const protocolId = n(protocol.id);
    for (let i = 0; i < def.secoes.length; i++) {
      const secao = def.secoes[i];
      const s = await pgInsert<{ id: unknown }>("protocol_sections", { protocol_id: protocolId, ordem: i, titulo: secao.titulo });
      const sectionId = n(s.id);
      for (let j = 0; j < secao.campos.length; j++) {
        const campo = secao.campos[j];
        await pgInsert("protocol_fields", {
          section_id: sectionId,
          ordem: j,
          chave: campo.chave,
          label: campo.label,
          tipo: campo.tipo,
          opcoes: JSON.stringify(campo.opcoes ?? null),
        });
      }
    }
    return;
  }
  const db = getDb();
  const tx = db.transaction(() => {
    const protocolId = Number(
      db.prepare("INSERT INTO protocols (workspace_id, nome, descricao, versao) VALUES (1, ?, ?, ?)").run(def.nome, def.descricao, def.versao)
        .lastInsertRowid
    );
    def.secoes.forEach((secao, i) => {
      const sectionId = Number(
        db.prepare("INSERT INTO protocol_sections (protocol_id, ordem, titulo) VALUES (?, ?, ?)").run(protocolId, i, secao.titulo).lastInsertRowid
      );
      secao.campos.forEach((campo, j) => {
        db.prepare("INSERT INTO protocol_fields (section_id, ordem, chave, label, tipo, opcoes) VALUES (?, ?, ?, ?, ?, ?)").run(
          sectionId,
          j,
          campo.chave,
          campo.label,
          campo.tipo,
          JSON.stringify(campo.opcoes ?? null)
        );
      });
    });
  });
  tx();
}

/** Idempotente por nome — roda sempre que a lista de protocolos é aberta; cria os que faltam, não mexe nos existentes. */
export async function syncBuiltinProtocols(): Promise<void> {
  const existentes = await listProtocolSummaries();
  const nomesExistentes = new Set(existentes.map((p) => p.nome));
  for (const def of PROTOCOLOS_BUILTIN) {
    if (!nomesExistentes.has(def.nome)) await createProtocol(def);
  }
}

// ---------------------------------------------------------------------------
// Protocolos: aplicações (assignments) e respostas por caso clínico
// ---------------------------------------------------------------------------

function mapAssignment(r: {
  id: unknown;
  case_id: unknown;
  protocol_id: unknown;
  protocol_nome?: string;
  data_aplicacao: string;
  status: "em_andamento" | "concluido";
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}): ProtocolAssignment {
  return {
    id: n(r.id),
    caseId: n(r.case_id),
    protocolId: n(r.protocol_id),
    protocolNome: r.protocol_nome ?? "",
    dataAplicacao: r.data_aplicacao,
    status: r.status,
    criadoPor: r.criado_por,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

export async function listCaseAssignments(caseId: number): Promise<ProtocolAssignment[]> {
  const protocolos = await listProtocolSummaries();
  const nomeById = new Map(protocolos.map((p) => [p.id, p.nome]));
  if (postgresEnabled()) {
    const rows = await pgSelect<{
      id: unknown;
      case_id: unknown;
      protocol_id: unknown;
      data_aplicacao: string;
      status: "em_andamento" | "concluido";
      criado_por: string;
      criado_em: string;
      atualizado_em: string;
    }>(
      "protocol_assignments",
      `select=id,case_id,protocol_id,data_aplicacao,status,criado_por,criado_em,atualizado_em&case_id=eq.${caseId}&order=data_aplicacao.desc`
    );
    return rows.map((r) => mapAssignment({ ...r, protocol_nome: nomeById.get(n(r.protocol_id)) }));
  }
  const rows = getDb()
    .prepare(
      "SELECT id, case_id, protocol_id, data_aplicacao, status, criado_por, criado_em, atualizado_em FROM protocol_assignments WHERE case_id = ? ORDER BY data_aplicacao DESC"
    )
    .all(caseId) as {
    id: number;
    case_id: number;
    protocol_id: number;
    data_aplicacao: string;
    status: "em_andamento" | "concluido";
    criado_por: string;
    criado_em: string;
    atualizado_em: string;
  }[];
  return rows.map((r) => mapAssignment({ ...r, protocol_nome: nomeById.get(r.protocol_id) }));
}

export async function getAssignment(id: number): Promise<ProtocolAssignment | null> {
  const all = await pgOrDbSelectAssignment(id);
  if (!all) return null;
  const protocolos = await listProtocolSummaries();
  const nome = protocolos.find((p) => p.id === all.protocolId)?.nome ?? "";
  return { ...all, protocolNome: nome };
}

async function pgOrDbSelectAssignment(id: number): Promise<ProtocolAssignment | null> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{
      id: unknown;
      case_id: unknown;
      protocol_id: unknown;
      data_aplicacao: string;
      status: "em_andamento" | "concluido";
      criado_por: string;
      criado_em: string;
      atualizado_em: string;
    }>(
      "protocol_assignments",
      `select=id,case_id,protocol_id,data_aplicacao,status,criado_por,criado_em,atualizado_em&id=eq.${id}&limit=1`
    );
    return rows[0] ? mapAssignment(rows[0]) : null;
  }
  const row = getDb()
    .prepare("SELECT id, case_id, protocol_id, data_aplicacao, status, criado_por, criado_em, atualizado_em FROM protocol_assignments WHERE id = ?")
    .get(id) as
    | {
        id: number;
        case_id: number;
        protocol_id: number;
        data_aplicacao: string;
        status: "em_andamento" | "concluido";
        criado_por: string;
        criado_em: string;
        atualizado_em: string;
      }
    | undefined;
  return row ? mapAssignment(row) : null;
}

export async function createAssignment(input: { caseId: number; protocolId: number; dataAplicacao: string; criadoPor: string }): Promise<number> {
  if (postgresEnabled()) {
    const row = await pgInsert<{ id: unknown }>("protocol_assignments", {
      workspace_id: 1,
      case_id: input.caseId,
      protocol_id: input.protocolId,
      data_aplicacao: input.dataAplicacao,
      criado_por: input.criadoPor,
    });
    return n(row.id);
  }
  const info = getDb()
    .prepare("INSERT INTO protocol_assignments (workspace_id, case_id, protocol_id, data_aplicacao, criado_por) VALUES (1, ?, ?, ?, ?)")
    .run(input.caseId, input.protocolId, input.dataAplicacao, input.criadoPor);
  return Number(info.lastInsertRowid);
}

export async function updateAssignmentStatus(id: number, status: "em_andamento" | "concluido"): Promise<void> {
  if (postgresEnabled()) {
    await pgRequest(`/protocol_assignments?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, atualizado_em: new Date().toISOString() }) });
    return;
  }
  getDb().prepare("UPDATE protocol_assignments SET status = ?, atualizado_em = datetime('now') WHERE id = ?").run(status, id);
}

export async function deleteAssignment(id: number): Promise<void> {
  if (postgresEnabled()) {
    await pgRequest(`/protocol_responses?assignment_id=eq.${id}`, { method: "DELETE" });
    await pgRequest(`/protocol_assignments?id=eq.${id}`, { method: "DELETE" });
    return;
  }
  const db = getDb();
  db.prepare("DELETE FROM protocol_responses WHERE assignment_id = ?").run(id);
  db.prepare("DELETE FROM protocol_assignments WHERE id = ?").run(id);
}

export async function getResponses(assignmentId: number): Promise<ProtocolResponse[]> {
  if (postgresEnabled()) {
    const rows = await pgSelect<{ field_id: unknown; valor: string }>("protocol_responses", `select=field_id,valor&assignment_id=eq.${assignmentId}`);
    return rows.map((r) => ({ fieldId: n(r.field_id), valor: r.valor ? JSON.parse(r.valor) : null }));
  }
  const rows = getDb().prepare("SELECT field_id, valor FROM protocol_responses WHERE assignment_id = ?").all(assignmentId) as {
    field_id: number;
    valor: string;
  }[];
  return rows.map((r) => ({ fieldId: r.field_id, valor: r.valor ? JSON.parse(r.valor) : null }));
}

export async function saveResponses(assignmentId: number, respostas: ProtocolResponse[]): Promise<void> {
  if (postgresEnabled()) {
    for (const r of respostas) {
      await pgRequest(`/protocol_responses`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ assignment_id: assignmentId, field_id: r.fieldId, valor: JSON.stringify(r.valor) }),
      });
    }
    await pgRequest(`/protocol_assignments?id=eq.${assignmentId}`, { method: "PATCH", body: JSON.stringify({ atualizado_em: new Date().toISOString() }) });
    return;
  }
  const db = getDb();
  const tx = db.transaction(() => {
    for (const r of respostas) {
      db.prepare(
        "INSERT INTO protocol_responses (assignment_id, field_id, valor) VALUES (?, ?, ?) ON CONFLICT(assignment_id, field_id) DO UPDATE SET valor = excluded.valor"
      ).run(assignmentId, r.fieldId, JSON.stringify(r.valor));
    }
    db.prepare("UPDATE protocol_assignments SET atualizado_em = datetime('now') WHERE id = ?").run(assignmentId);
  });
  tx();
}
