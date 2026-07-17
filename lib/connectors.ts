import type Database from "better-sqlite3";
import { audit } from "./db";

/**
 * Connection Hub — conectores REAIS (Módulo 3 do PRD).
 *
 * Cada conector implementa o mesmo contrato: `test()` valida as credenciais
 * contra a API externa e `sync()` puxa os dados e grava nas tabelas de
 * origem, atualizando os DataAssets do catálogo. Conexões com
 * `config.demo === true` continuam usando os dados semeados.
 *
 * Segredos chegam já decifrados pelo Vault (a rota audita a leitura) e
 * NUNCA são logados ou devolvidos ao cliente.
 */

export type TestResult = { ok: boolean; message: string };
export type SyncResult = { detalhes: string[] };

const TIMEOUT = 20_000;

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
}

function httpError(res: Response, contexto: string): string {
  const map: Record<number, string> = {
    401: "credenciais inválidas ou expiradas",
    403: "credencial válida, mas sem permissão para este recurso",
    404: "conta/recurso não encontrado — confira o identificador informado",
    429: "rate limit atingido — tente novamente em alguns minutos",
  };
  return `${contexto}: HTTP ${res.status} (${map[res.status] ?? res.statusText})`;
}

// ── VTEX ─────────────────────────────────────────────────────────────────
// Config: { account, environment }  Secret: { appKey, appToken }

type VtexSecret = { appKey: string; appToken: string };

function vtexHeaders(secret: VtexSecret) {
  return {
    "X-VTEX-API-AppKey": secret.appKey,
    "X-VTEX-API-AppToken": secret.appToken,
    Accept: "application/json",
  };
}

function vtexBase(config: { account: string; environment?: string }) {
  return `https://${config.account}.${config.environment || "vtexcommercestable"}.com.br`;
}

export async function testVtex(config: { account: string; environment?: string }, secret: VtexSecret): Promise<TestResult> {
  try {
    const res = await apiFetch(`${vtexBase(config)}/api/oms/pvt/orders?page=1&per_page=1`, { headers: vtexHeaders(secret) });
    if (!res.ok) return { ok: false, message: httpError(res, "VTEX Orders API") };
    const data = (await res.json()) as { paging?: { total?: number } };
    return { ok: true, message: `Conexão OK — ${data.paging?.total ?? "?"} pedidos visíveis na conta ${config.account}.` };
  } catch (e) {
    return { ok: false, message: `Falha de rede ao chamar a VTEX: ${(e as Error).message}` };
  }
}

export async function syncVtex(db: Database.Database, connectionId: number, config: { account: string; environment?: string }, secret: VtexSecret): Promise<SyncResult> {
  const detalhes: string[] = [];
  const base = vtexBase(config);

  // Pedidos (100 mais recentes — leitura, sem escrita)
  const ordRes = await apiFetch(`${base}/api/oms/pvt/orders?page=1&per_page=100&orderBy=creationDate,desc`, { headers: vtexHeaders(secret) });
  if (!ordRes.ok) throw new Error(httpError(ordRes, "VTEX Orders API"));
  const ordData = (await ordRes.json()) as {
    list: { orderId: string; creationDate: string; clientName: string | null; totalValue: number; status: string; statusDescription?: string }[];
  };
  db.prepare("DELETE FROM vtex_orders WHERE connection_id = ?").run(connectionId);
  const insOrder = db.prepare(
    "INSERT INTO vtex_orders (connection_id, cliente_nome, cliente_email, cliente_cpf, produto_id, quantidade, total, status, criado_em) VALUES (?, ?, '', '', NULL, 1, ?, ?, ?)"
  );
  for (const o of ordData.list ?? []) {
    insOrder.run(connectionId, o.clientName ?? "—", (o.totalValue ?? 0) / 100, o.statusDescription || o.status, o.creationDate.slice(0, 19).replace("T", " "));
  }
  detalhes.push(`Pedidos: ${ordData.list?.length ?? 0} linhas`);

  // Produtos (busca pública do catálogo, 50 primeiros)
  try {
    const prodRes = await apiFetch(`${base}/api/catalog_system/pub/products/search?_from=0&_to=49`, { headers: vtexHeaders(secret) });
    if (prodRes.ok) {
      const prods = (await prodRes.json()) as {
        productId: string; productName: string; categories?: string[];
        items?: { sellers?: { commertialOffer?: { Price?: number } }[] }[];
      }[];
      db.prepare("DELETE FROM vtex_products WHERE connection_id = ?").run(connectionId);
      const insProd = db.prepare("INSERT INTO vtex_products (connection_id, nome, categoria, preco) VALUES (?, ?, ?, ?)");
      for (const p of prods) {
        const categoria = p.categories?.[0]?.split("/").filter(Boolean).pop() ?? "Sem categoria";
        const preco = p.items?.[0]?.sellers?.[0]?.commertialOffer?.Price ?? 0;
        insProd.run(connectionId, p.productName, categoria, preco);
      }
      detalhes.push(`Produtos: ${prods.length} linhas`);
    }
  } catch {
    detalhes.push("Produtos: catálogo indisponível (seguindo só com pedidos)");
  }
  return { detalhes };
}

// ── Zendesk ──────────────────────────────────────────────────────────────
// Config: { subdomain, authType: 'oauth_bearer' | 'api_token', email? }
// Secret: { token }

type ZendeskConfig = { subdomain: string; authType: "oauth_bearer" | "api_token"; email?: string };

function zendeskAuth(config: ZendeskConfig, secret: { token: string }): string {
  if (config.authType === "api_token") {
    return "Basic " + Buffer.from(`${config.email}/token:${secret.token}`).toString("base64");
  }
  return `Bearer ${secret.token}`;
}

export async function testZendesk(config: ZendeskConfig, secret: { token: string }): Promise<TestResult> {
  try {
    const res = await apiFetch(`https://${config.subdomain}.zendesk.com/api/v2/tickets/count.json`, {
      headers: { Authorization: zendeskAuth(config, secret), Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, message: httpError(res, "Zendesk Tickets API") };
    const data = (await res.json()) as { count?: { value?: number } };
    return { ok: true, message: `Conexão OK — ${data.count?.value ?? "?"} tickets na conta ${config.subdomain}.` };
  } catch (e) {
    return { ok: false, message: `Falha de rede ao chamar o Zendesk: ${(e as Error).message}` };
  }
}

export async function syncZendesk(db: Database.Database, connectionId: number, config: ZendeskConfig, secret: { token: string }): Promise<SyncResult> {
  const res = await apiFetch(`https://${config.subdomain}.zendesk.com/api/v2/tickets.json?include=users&page[size]=100&sort=-updated_at`, {
    headers: { Authorization: zendeskAuth(config, secret), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(httpError(res, "Zendesk Tickets API"));
  const data = (await res.json()) as {
    tickets: {
      subject: string | null; status: string; priority: string | null; tags: string[];
      requester_id: number; created_at: string;
      satisfaction_rating?: { score?: string } | null;
    }[];
    users?: { id: number; email: string | null }[];
  };
  const emailById = new Map((data.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const statusMap: Record<string, string> = { new: "aberto", open: "aberto", pending: "pendente", hold: "pendente", solved: "resolvido", closed: "resolvido" };

  db.prepare("DELETE FROM zendesk_tickets WHERE connection_id = ?").run(connectionId);
  const ins = db.prepare(
    "INSERT INTO zendesk_tickets (connection_id, assunto, categoria, status, prioridade, requester_email, csat, tags, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const t of data.tickets ?? []) {
    const csat = t.satisfaction_rating?.score === "good" ? 5 : t.satisfaction_rating?.score === "bad" ? 1 : null;
    ins.run(
      connectionId,
      t.subject ?? "(sem assunto)",
      t.tags?.[0] ?? "sem categoria",
      statusMap[t.status] ?? t.status,
      t.priority ?? "normal",
      emailById.get(t.requester_id) ?? "",
      csat,
      JSON.stringify(t.tags ?? []),
      t.created_at.slice(0, 19).replace("T", " ")
    );
  }
  return { detalhes: [`Tickets: ${data.tickets?.length ?? 0} linhas`] };
}

// ── Power BI ─────────────────────────────────────────────────────────────
// Config: { tenantId, clientId, workspaceId }  Secret: { clientSecret }

type PowerBiConfig = { tenantId: string; clientId: string; workspaceId: string };

async function powerbiToken(config: PowerBiConfig, secret: { clientSecret: string }): Promise<string> {
  const res = await apiFetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: secret.clientSecret,
      scope: "https://analysis.windows.net/powerbi/api/.default",
    }),
  });
  if (!res.ok) throw new Error(httpError(res, "Microsoft Entra ID (token)"));
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function testPowerBi(config: PowerBiConfig, secret: { clientSecret: string }): Promise<TestResult> {
  try {
    const token = await powerbiToken(config, secret);
    const res = await apiFetch(`https://api.powerbi.com/v1.0/myorg/groups/${config.workspaceId}/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, message: httpError(res, "Power BI REST API (o service principal é membro do workspace?)") };
    const data = (await res.json()) as { value: unknown[] };
    return { ok: true, message: `Conexão OK — ${data.value.length} relatórios no workspace.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function syncPowerBi(db: Database.Database, connectionId: number, config: PowerBiConfig, secret: { clientSecret: string }): Promise<SyncResult> {
  const token = await powerbiToken(config, secret);
  const headers = { Authorization: `Bearer ${token}` };

  const [repRes, dsRes] = await Promise.all([
    apiFetch(`https://api.powerbi.com/v1.0/myorg/groups/${config.workspaceId}/reports`, { headers }),
    apiFetch(`https://api.powerbi.com/v1.0/myorg/groups/${config.workspaceId}/datasets`, { headers }),
  ]);
  if (!repRes.ok) throw new Error(httpError(repRes, "Power BI Reports API"));
  const reports = ((await repRes.json()) as { value: { name: string; datasetId?: string; webUrl?: string }[] }).value;
  const datasets = dsRes.ok ? ((await dsRes.json()) as { value: { id: string; name: string }[] }).value : [];
  const dsById = new Map(datasets.map((d) => [d.id, d.name]));

  db.prepare("DELETE FROM powerbi_reports WHERE connection_id = ?").run(connectionId);
  const ins = db.prepare("INSERT INTO powerbi_reports (connection_id, nome, dataset, descricao, atualizado_em) VALUES (?, ?, ?, ?, datetime('now'))");
  for (const r of reports) {
    ins.run(connectionId, r.name, dsById.get(r.datasetId ?? "") ?? r.datasetId ?? "—", r.webUrl ?? "Relatório do workspace conectado.");
  }
  return { detalhes: [`Relatórios: ${reports.length} linhas`, `Datasets: ${datasets.length}`] };
}

// ── Supabase ─────────────────────────────────────────────────────────────
// Config: { url }  Secret: { apiKey } (service_role para ler tudo, ou anon
// se as policies permitirem). Usa o PostgREST do próprio projeto: o schema
// OpenAPI lista as tabelas expostas e cada tabela é lida via REST.

type SupabaseConfig = { url: string };

function supabaseHeaders(secret: { apiKey: string }) {
  return { apikey: secret.apiKey, Authorization: `Bearer ${secret.apiKey}`, Accept: "application/json" };
}

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function supabaseTables(config: SupabaseConfig, secret: { apiKey: string }): Promise<string[]> {
  const res = await apiFetch(`${normalizeSupabaseUrl(config.url)}/rest/v1/`, { headers: supabaseHeaders(secret) });
  if (!res.ok) throw new Error(httpError(res, "Supabase REST (PostgREST)"));
  const spec = (await res.json()) as { definitions?: Record<string, unknown>; paths?: Record<string, unknown> };
  const names = spec.definitions
    ? Object.keys(spec.definitions)
    : Object.keys(spec.paths ?? {}).filter((p) => p !== "/").map((p) => p.replace(/^\//, ""));
  return names.filter((n) => !n.startsWith("rpc/"));
}

export async function testSupabase(config: SupabaseConfig, secret: { apiKey: string }): Promise<TestResult> {
  try {
    const tables = await supabaseTables(config, secret);
    if (!tables.length) return { ok: true, message: "Conexão OK, mas nenhuma tabela exposta no schema public (verifique policies/API)." };
    return { ok: true, message: `Conexão OK — ${tables.length} tabelas visíveis: ${tables.slice(0, 6).join(", ")}${tables.length > 6 ? "…" : ""}.` };
  } catch (e) {
    return { ok: false, message: `Falha ao conectar no Supabase: ${(e as Error).message}` };
  }
}

const SUPABASE_MAX_TABLES = 20;
const SUPABASE_MAX_ROWS = 200;

export async function syncSupabase(db: Database.Database, connectionId: number, config: SupabaseConfig, secret: { apiKey: string }): Promise<SyncResult> {
  const base = normalizeSupabaseUrl(config.url);
  const tables = (await supabaseTables(config, secret)).slice(0, SUPABASE_MAX_TABLES);
  const detalhes: string[] = [];

  db.prepare("DELETE FROM raw_records WHERE connection_id = ?").run(connectionId);
  const ins = db.prepare("INSERT INTO raw_records (connection_id, tabela, dados) VALUES (?, ?, ?)");

  for (const tabela of tables) {
    try {
      const res = await apiFetch(`${base}/rest/v1/${encodeURIComponent(tabela)}?select=*&limit=${SUPABASE_MAX_ROWS}`, {
        headers: supabaseHeaders(secret),
      });
      if (!res.ok) {
        detalhes.push(`${tabela}: sem acesso (HTTP ${res.status})`);
        continue;
      }
      const rows = (await res.json()) as Record<string, unknown>[];
      const insMany = db.transaction((items: Record<string, unknown>[]) => {
        for (const r of items) ins.run(connectionId, tabela, JSON.stringify(r));
      });
      insMany(rows);
      detalhes.push(`${tabela}: ${rows.length} linhas`);

      // Layer 1 → catálogo: cada tabela vira um ativo bruto aguardando curadoria semântica
      const existing = db.prepare("SELECT id FROM data_assets WHERE connection_id = ? AND nome_original = ?").get(connectionId, tabela) as
        | { id: number }
        | undefined;
      if (existing) {
        db.prepare("UPDATE data_assets SET linhas = ?, status = 'ativo' WHERE id = ?").run(rows.length, existing.id);
      } else {
        db.prepare(
          `INSERT INTO data_assets (workspace_id, connection_id, nome, tipo, area, descricao, sensibilidade_lgpd, campos_sensiveis, linhas, tabela_origem, nome_original)
           VALUES (1, ?, ?, 'tabela', 'Ingestão', ?, 'baixa', '[]', ?, 'raw_records', ?)`
        ).run(connectionId, tabela, `Tabela “${tabela}” ingerida do Supabase (dados brutos, aguardando curadoria semântica).`, rows.length, tabela);
        audit("sistema", "catalog.create", tabela, `Ativo bruto criado pela ingestão Supabase (conexão #${connectionId}).`);
      }
    } catch (e) {
      detalhes.push(`${tabela}: falhou (${(e as Error).message})`);
    }
  }
  return { detalhes };
}

// ── Registry + upsert de DataAssets ─────────────────────────────────────

export const CONNECTOR_FIELDS: Record<
  string,
  { label: string; config: { key: string; label: string; placeholder?: string; options?: string[] }[]; secret: { key: string; label: string }[] }
> = {
  vtex: {
    label: "VTEX (e-commerce)",
    config: [
      { key: "account", label: "Account name da loja", placeholder: "minhaloja" },
      { key: "environment", label: "Ambiente", options: ["vtexcommercestable", "myvtex"] },
    ],
    secret: [
      { key: "appKey", label: "X-VTEX-API-AppKey" },
      { key: "appToken", label: "X-VTEX-API-AppToken" },
    ],
  },
  zendesk: {
    label: "Zendesk (suporte)",
    config: [
      { key: "subdomain", label: "Subdomínio", placeholder: "minhaempresa (de minhaempresa.zendesk.com)" },
      { key: "authType", label: "Autenticação", options: ["oauth_bearer", "api_token"] },
      { key: "email", label: "Email do agente (só para api_token)", placeholder: "voce@empresa.com" },
    ],
    secret: [{ key: "token", label: "Token (OAuth access token ou API token)" }],
  },
  powerbi: {
    label: "Power BI (relatórios)",
    config: [
      { key: "tenantId", label: "Tenant ID (Entra ID)", placeholder: "00000000-0000-0000-0000-000000000000" },
      { key: "clientId", label: "Client ID (app registration)" },
      { key: "workspaceId", label: "Workspace ID do Power BI" },
    ],
    secret: [{ key: "clientSecret", label: "Client Secret" }],
  },
  supabase: {
    label: "Supabase (banco de dados)",
    config: [{ key: "url", label: "URL do projeto", placeholder: "https://xxxx.supabase.co" }],
    secret: [{ key: "apiKey", label: "API key (service_role para leitura completa)" }],
  },
};

/** Garante que os DataAssets da conexão existem no catálogo e atualiza a contagem de linhas. */
export function upsertAssets(db: Database.Database, connectionId: number, tipo: string) {
  const defs: Record<string, { nome: string; tipoAsset: string; area: string; descricao: string; lgpd: string; campos: string[]; table: string }[]> = {
    vtex: [
      { nome: "Pedidos", tipoAsset: "tabela", area: "Vendas", descricao: "Pedidos da loja VTEX (Orders API): cliente, total, status e data.", lgpd: "alta", campos: ["cliente_email", "cliente_cpf"], table: "vtex_orders" },
      { nome: "Produtos", tipoAsset: "tabela", area: "Vendas", descricao: "Catálogo de produtos da VTEX: nome, categoria e preço.", lgpd: "baixa", campos: [], table: "vtex_products" },
    ],
    zendesk: [
      { nome: "Tickets", tipoAsset: "tabela", area: "Atendimento", descricao: "Tickets do Zendesk: assunto, categoria, status, prioridade, CSAT e solicitante.", lgpd: "media", campos: ["requester_email"], table: "zendesk_tickets" },
    ],
    powerbi: [
      { nome: "Relatórios Power BI", tipoAsset: "dataset", area: "Analytics", descricao: "Metadados de relatórios e datasets do workspace Power BI (leitura).", lgpd: "baixa", campos: [], table: "powerbi_reports" },
    ],
    ads: [
      { nome: "Campanhas de Mídia", tipoAsset: "tabela", area: "Marketing", descricao: "Campanhas de mídia paga: investimento, cliques, conversões e receita atribuída.", lgpd: "baixa", campos: [], table: "marketing_campaigns" },
    ],
  };
  for (const def of defs[tipo] ?? []) {
    const { qtd } = db.prepare(`SELECT COUNT(*) qtd FROM ${def.table} WHERE connection_id = ?`).get(connectionId) as { qtd: number };
    const existing = db.prepare("SELECT id FROM data_assets WHERE connection_id = ? AND nome = ?").get(connectionId, def.nome) as { id: number } | undefined;
    if (existing) {
      db.prepare("UPDATE data_assets SET linhas = ?, status = 'ativo', tabela_origem = ? WHERE id = ?").run(qtd, def.table, existing.id);
    } else {
      db.prepare(
        `INSERT INTO data_assets (workspace_id, connection_id, nome, tipo, area, descricao, sensibilidade_lgpd, campos_sensiveis, linhas, tabela_origem, nome_original)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(connectionId, def.nome, def.tipoAsset, def.area, def.descricao, def.lgpd, JSON.stringify(def.campos), qtd, def.table, def.table);
      audit("sistema", "catalog.create", def.nome, `DataAsset criado automaticamente pelo sync da conexão #${connectionId}.`);
    }
  }
}
