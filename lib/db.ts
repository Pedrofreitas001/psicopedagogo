import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import { encrypt } from "./vault";

/**
 * Camada de persistência do MVP.
 *
 * SQLite no MVP para rodar sem infraestrutura externa; o schema espelha a
 * seção 3 do PRD (todas as entidades com workspace_id) para que a migração
 * para PostgreSQL + RLS seja 1:1. As tabelas vtex_, zendesk_ e powerbi_
 * simulam os dados sincronizados pelos conectores em modo demo.
 */

let _db: Database.Database | null = null;

/**
 * Escolhe um diretório gravável para o arquivo SQLite. Em ambientes
 * serverless (Vercel/Lambda) o filesystem do projeto é somente leitura,
 * então caímos para /tmp — o banco demo é ressemeado a cada cold start,
 * o que é aceitável para o MVP (para persistência real: Postgres).
 */
function resolveDataDir(): string {
  if (process.env.DB_DIR) {
    fs.mkdirSync(process.env.DB_DIR, { recursive: true });
    return process.env.DB_DIR;
  }
  const local = path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(local, { recursive: true });
    fs.accessSync(local, fs.constants.W_OK);
    return local;
  } catch {
    const tmp = path.join(os.tmpdir(), "governance-hub");
    fs.mkdirSync(tmp, { recursive: true });
    return tmp;
  }
}

/** Versão do schema. DBs demo antigos são recriados; a partir daqui, migrações preservam dados. */
const SCHEMA_VERSION = 5;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dir = resolveDataDir();
  const file = path.join(dir, "hub.db");
  _db = new Database(file);
  _db.pragma("journal_mode = WAL");

  const version = _db.pragma("user_version", { simple: true }) as number;
  const hasTables = !!_db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'")
    .get();
  if (hasTables && version < SCHEMA_VERSION) wipe(_db); // DB demo de versão antiga: recria

  migrate(_db);
  const seeded = (_db.prepare("SELECT COUNT(*) c FROM workspaces").get() as { c: number }).c > 0;
  if (!seeded) seed(_db);
  _db.pragma(`user_version = ${SCHEMA_VERSION}`);
  return _db;
}

function wipe(db: Database.Database) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t.name}`);
}

function migrate(db: Database.Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY, nome TEXT NOT NULL, plano TEXT NOT NULL DEFAULT 'piloto',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    nome TEXT NOT NULL, email TEXT NOT NULL, papel TEXT NOT NULL CHECK (papel IN ('admin','steward','viewer')),
    auth_id TEXT
  );
  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    tipo TEXT NOT NULL,
    nome TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'conectado',
    ultima_sincronizacao TEXT, config TEXT
  );
  CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY, connection_id INTEGER NOT NULL REFERENCES connections(id),
    tipo TEXT NOT NULL, valor_criptografado TEXT NOT NULL, escopo TEXT, expira_em TEXT
  );
  CREATE TABLE IF NOT EXISTS data_assets (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    connection_id INTEGER REFERENCES connections(id),
    nome TEXT NOT NULL, tipo TEXT NOT NULL, owner_id INTEGER REFERENCES users(id),
    steward_id INTEGER REFERENCES users(id), area TEXT, descricao TEXT,
    sensibilidade_lgpd TEXT NOT NULL DEFAULT 'baixa' CHECK (sensibilidade_lgpd IN ('baixa','media','alta')),
    campos_sensiveis TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'ativo',
    linhas INTEGER NOT NULL DEFAULT 0,
    tabela_origem TEXT NOT NULL DEFAULT '',
    nome_original TEXT NOT NULL DEFAULT '',
    entidade TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Layer 2 (Modelo Semântico): significado de cada coluna de um ativo
  CREATE TABLE IF NOT EXISTS asset_columns (
    id INTEGER PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES data_assets(id),
    coluna TEXT NOT NULL,
    nome_semantico TEXT NOT NULL DEFAULT '',
    tipo_dado TEXT NOT NULL DEFAULT 'texto',
    papel TEXT NOT NULL DEFAULT 'dimensao' CHECK (papel IN ('dimensao','medida','data','chave','ignorar')),
    cardinalidade INTEGER,
    exemplo TEXT,
    confirmado INTEGER NOT NULL DEFAULT 0,
    UNIQUE (asset_id, coluna)
  );
  -- Layer 3 (Modelo Analítico): KPIs definidos sobre o modelo semântico
  CREATE TABLE IF NOT EXISTS kpis (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '',
    asset_id INTEGER NOT NULL REFERENCES data_assets(id),
    agregacao TEXT NOT NULL CHECK (agregacao IN ('sum','avg','count','count_distinct','min','max')),
    coluna_medida TEXT,
    coluna_data TEXT,
    coluna_dimensao TEXT,
    formato TEXT NOT NULL DEFAULT 'numero' CHECK (formato IN ('numero','moeda','percentual')),
    criado_por TEXT, criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS asset_relationships (
    id INTEGER PRIMARY KEY,
    asset_origem_id INTEGER NOT NULL REFERENCES data_assets(id),
    asset_destino_id INTEGER NOT NULL REFERENCES data_assets(id),
    tipo TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    autor_id INTEGER REFERENCES users(id), titulo TEXT NOT NULL, sql TEXT NOT NULL,
    descricao TEXT, tags TEXT NOT NULL DEFAULT '[]', asset_id INTEGER REFERENCES data_assets(id),
    ultima_execucao TEXT, performance_ms INTEGER
  );
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    nome TEXT NOT NULL, objetivo TEXT, prompt_base TEXT, modelo TEXT NOT NULL DEFAULT 'claude-sonnet-5',
    ferramentas TEXT NOT NULL DEFAULT '[]',
    assets_autorizados TEXT NOT NULL DEFAULT '[]',
    pode_exibir_pii INTEGER NOT NULL DEFAULT 0,
    personalidade TEXT NOT NULL DEFAULT '{}',
    escopo_trabalho TEXT NOT NULL DEFAULT '',
    fora_escopo TEXT NOT NULL DEFAULT '',
    diretrizes TEXT NOT NULL DEFAULT '[]',
    restricoes TEXT NOT NULL DEFAULT '[]',
    custo_acumulado REAL NOT NULL DEFAULT 0,
    execucoes INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    nome TEXT NOT NULL, agentes TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    titulo TEXT NOT NULL, descricao TEXT, spec_json TEXT NOT NULL,
    criado_por TEXT, criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    ator TEXT NOT NULL, acao TEXT NOT NULL, alvo TEXT, detalhe TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Dados de origem simulados (o que os conectores sincronizam em modo demo)
  CREATE TABLE IF NOT EXISTS vtex_products (
    id INTEGER PRIMARY KEY, connection_id INTEGER NOT NULL,
    nome TEXT NOT NULL, categoria TEXT NOT NULL, preco REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vtex_orders (
    id INTEGER PRIMARY KEY, connection_id INTEGER NOT NULL,
    cliente_nome TEXT NOT NULL, cliente_email TEXT NOT NULL DEFAULT '', cliente_cpf TEXT NOT NULL DEFAULT '',
    produto_id INTEGER,
    quantidade INTEGER NOT NULL DEFAULT 1, total REAL NOT NULL,
    status TEXT NOT NULL, criado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS zendesk_tickets (
    id INTEGER PRIMARY KEY, connection_id INTEGER NOT NULL,
    assunto TEXT NOT NULL, categoria TEXT NOT NULL, status TEXT NOT NULL,
    prioridade TEXT NOT NULL, requester_email TEXT NOT NULL,
    csat INTEGER, tags TEXT NOT NULL DEFAULT '[]', criado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS powerbi_reports (
    id INTEGER PRIMARY KEY, connection_id INTEGER NOT NULL,
    nome TEXT NOT NULL, dataset TEXT NOT NULL, descricao TEXT NOT NULL, atualizado_em TEXT NOT NULL
  );
  -- Layer 1 (Ingestão): registros brutos de conectores genéricos (Supabase, planilhas...)
  CREATE TABLE IF NOT EXISTS raw_records (
    id INTEGER PRIMARY KEY, connection_id INTEGER NOT NULL,
    tabela TEXT NOT NULL, dados TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_raw_conn_tabela ON raw_records (connection_id, tabela);
  CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id INTEGER PRIMARY KEY, connection_id INTEGER NOT NULL,
    nome TEXT NOT NULL, canal TEXT NOT NULL, objetivo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa',
    investimento REAL NOT NULL, impressoes INTEGER NOT NULL, cliques INTEGER NOT NULL,
    conversoes INTEGER NOT NULL, receita REAL NOT NULL,
    inicio TEXT NOT NULL, fim TEXT
  );
  `);
}

// PRNG determinístico para o seed ser reproduzível
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysAgo(n: number, hour = 12): string {
  const d = new Date(Date.now() - n * 86400000);
  d.setHours(hour, Math.floor(n * 7) % 60, 0, 0);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function seed(db: Database.Database) {
  const rnd = mulberry32(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  db.prepare("INSERT INTO workspaces (id, nome, plano) VALUES (1, 'Acme Comércio LTDA', 'piloto')").run();

  const users = [
    [1, "Pedro Freitas", "pedrofreitas@usp.br", "admin"],
    [2, "Ana Souza", "ana.souza@acme.com.br", "steward"],
    [3, "Carlos Lima", "carlos.lima@acme.com.br", "viewer"],
  ];
  const insUser = db.prepare("INSERT INTO users (id, workspace_id, nome, email, papel) VALUES (?, 1, ?, ?, ?)");
  for (const u of users) insUser.run(...u);

  // ── Connections + credenciais (criptografadas via Vault) ───────────────
  const insConn = db.prepare(
    "INSERT INTO connections (id, workspace_id, tipo, nome, status, ultima_sincronizacao, config) VALUES (?, 1, ?, ?, 'conectado', ?, ?)"
  );
  insConn.run(1, "vtex", "VTEX — Loja Acme (demo)", daysAgo(0, 8), JSON.stringify({ demo: true, account: "acmestore", environment: "vtexcommercestable" }));
  insConn.run(2, "zendesk", "Zendesk — Suporte Acme (demo)", daysAgo(0, 8), JSON.stringify({ demo: true, subdomain: "acmesuporte", authType: "oauth_bearer" }));
  insConn.run(3, "powerbi", "Power BI — Workspace Comercial (demo)", daysAgo(0, 8), JSON.stringify({ demo: true, tenantId: "acme.onmicrosoft.com", workspaceId: "demo" }));
  insConn.run(4, "ads", "Mídia Paga — Meta & Google (demo)", daysAgo(0, 8), JSON.stringify({ demo: true, contas: ["act_demo_meta", "google-123-456"] }));

  const insCred = db.prepare(
    "INSERT INTO credentials (connection_id, tipo, valor_criptografado, escopo, expira_em) VALUES (?, ?, ?, ?, ?)"
  );
  insCred.run(1, "api_key", encrypt("vtexappkey-acmestore-DEMO1234:AppTokenDemoXYZ"), "orders:read catalog:read", null);
  insCred.run(2, "oauth", encrypt("zd_oauth_demo_token_abc123"), "tickets:read", daysAgo(-90));
  insCred.run(3, "service_principal", encrypt("client_secret_demo_pbi_456"), "Report.Read.All Dataset.Read.All", daysAgo(-180));

  // ── Dados de origem: VTEX ──────────────────────────────────────────────
  const produtos: [string, string, number][] = [
    ["Notebook Vector 14\"", "Eletrônicos", 3899.9],
    ["Smartphone Orbit X", "Eletrônicos", 2299.0],
    ["Fone Bluetooth Pulse", "Acessórios", 349.9],
    ["Monitor UltraWide 29\"", "Eletrônicos", 1499.0],
    ["Teclado Mecânico K7", "Acessórios", 459.9],
    ["Mouse Sem Fio M3", "Acessórios", 129.9],
    ["Cadeira Ergo Pro", "Escritório", 1899.0],
    ["Mesa Ajustável Lift", "Escritório", 2450.0],
    ["Webcam FullHD W2", "Acessórios", 289.9],
    ["Hub USB-C 8em1", "Acessórios", 219.9],
  ];
  const insProd = db.prepare("INSERT INTO vtex_products (id, connection_id, nome, categoria, preco) VALUES (?, 1, ?, ?, ?)");
  produtos.forEach((p, i) => insProd.run(i + 1, ...p));

  const clientes: [string, string, string][] = [
    ["Mariana Alves", "mariana.alves@gmail.com", "412.558.901-22"],
    ["João Pereira", "joao.pereira@hotmail.com", "318.204.667-05"],
    ["Fernanda Costa", "fernanda.costa@empresa.com.br", "225.910.443-80"],
    ["Ricardo Santos", "ricardo.santos@gmail.com", "104.372.558-91"],
    ["Beatriz Rocha", "bia.rocha@outlook.com", "507.226.184-33"],
    ["Lucas Martins", "lucas.martins@gmail.com", "689.415.302-77"],
    ["Camila Ferreira", "camila.f@yahoo.com.br", "830.194.526-14"],
    ["Gustavo Nunes", "gustavo.nunes@empresa.com.br", "271.683.049-58"],
    ["Patrícia Ramos", "patricia.ramos@gmail.com", "946.502.817-26"],
    ["André Oliveira", "andre.oliveira@outlook.com", "153.847.290-63"],
    ["Juliana Dias", "juliana.dias@gmail.com", "728.361.495-09"],
    ["Rafael Barbosa", "rafael.barbosa@hotmail.com", "364.925.108-47"],
  ];

  const statusPedido = ["faturado", "faturado", "faturado", "entregue", "entregue", "entregue", "entregue", "cancelado", "em transporte"];
  const insOrder = db.prepare(
    "INSERT INTO vtex_orders (connection_id, cliente_nome, cliente_email, cliente_cpf, produto_id, quantidade, total, status, criado_em) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (let i = 0; i < 95; i++) {
    const c = pick(clientes);
    const prodIdx = Math.floor(rnd() * produtos.length);
    const qtd = rnd() < 0.75 ? 1 : 2;
    const total = Math.round(produtos[prodIdx][2] * qtd * 100) / 100;
    insOrder.run(c[0], c[1], c[2], prodIdx + 1, qtd, total, pick(statusPedido), daysAgo(Math.floor(rnd() * 60), Math.floor(rnd() * 14) + 8));
  }

  // ── Dados de origem: Zendesk ───────────────────────────────────────────
  const categorias: [string, string[]][] = [
    ["Entrega atrasada", ["Pedido não chegou no prazo", "Rastreamento sem atualização há dias", "Transportadora não localiza o endereço"]],
    ["Troca / Devolução", ["Solicitação de troca por tamanho errado", "Produto veio diferente do anunciado", "Como devolver um item do pedido"]],
    ["Defeito do produto", ["Produto chegou com defeito", "Item parou de funcionar após 1 semana", "Tela do produto veio trincada"]],
    ["Pagamento / Cobrança", ["Cobrança duplicada no cartão", "Estorno não caiu na fatura", "Erro ao aplicar cupom de desconto"]],
    ["Dúvida de uso", ["Como configurar o produto", "Dúvida sobre compatibilidade", "Onde encontro o manual"]],
  ];
  const statusTicket = ["aberto", "aberto", "pendente", "resolvido", "resolvido", "resolvido"];
  const prioridades = ["baixa", "normal", "normal", "alta"];
  const insTicket = db.prepare(
    "INSERT INTO zendesk_tickets (connection_id, assunto, categoria, status, prioridade, requester_email, csat, tags, criado_em) VALUES (2, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (let i = 0; i < 60; i++) {
    const cat = pick(categorias);
    const st = pick(statusTicket);
    const c = pick(clientes);
    const csat = st === "resolvido" ? (rnd() < 0.7 ? Math.floor(rnd() * 2) + 4 : Math.floor(rnd() * 3) + 1) : null;
    const dias = rnd() < 0.25 ? 0 : Math.floor(rnd() * 45);
    insTicket.run(pick(cat[1]), cat[0], st, pick(prioridades), c[1], csat, JSON.stringify([cat[0].toLowerCase().split(" ")[0]]), daysAgo(dias, Math.floor(rnd() * 12) + 8));
  }

  // ── Dados de origem: Power BI ──────────────────────────────────────────
  const reports: [string, string, string][] = [
    ["Painel Executivo de Vendas", "ds_vendas_consolidado", "Receita, ticket médio e conversão por canal, atualizado diariamente a partir do ERP e da VTEX."],
    ["Funil Comercial B2B", "ds_crm_oportunidades", "Pipeline de oportunidades por estágio e vendedor, com taxa de ganho mensal."],
    ["Painel de Logística", "ds_logistica_entregas", "SLA de entrega por transportadora e região; base para o indicador de atraso."],
    ["Satisfação do Cliente (CSAT/NPS)", "ds_suporte_csat", "Consolida CSAT do Zendesk e NPS trimestral por segmento de cliente."],
    ["Estoque & Ruptura", "ds_estoque_sku", "Cobertura de estoque por SKU e alertas de ruptura para o time de compras."],
    ["DRE Gerencial", "ds_financeiro_dre", "Demonstrativo de resultados mensal por centro de custo (visão CFO)."],
  ];
  const insRep = db.prepare("INSERT INTO powerbi_reports (connection_id, nome, dataset, descricao, atualizado_em) VALUES (3, ?, ?, ?, ?)");
  reports.forEach((r, i) => insRep.run(r[0], r[1], r[2], daysAgo(i % 3, 6)));

  // ── Dados de origem: Mídia Paga (campanhas) ────────────────────────────
  const campanhas: [string, string, string, string, number, number, number, number, number, number][] = [
    // nome, canal, objetivo, status, investimento, impressões, cliques, conversões, receita, início (dias atrás)
    ["Remarketing Eletrônicos", "meta", "conversão", "ativa", 12500, 890000, 21400, 512, 98400, 45],
    ["Prospecção Lookalike 2%", "meta", "conversão", "ativa", 18200, 1450000, 26800, 388, 61300, 60],
    ["Search Marca", "google", "conversão", "ativa", 6400, 210000, 15800, 402, 84500, 90],
    ["Search Genérico Eletrônicos", "google", "conversão", "ativa", 22800, 980000, 19200, 231, 39800, 60],
    ["YouTube Awareness Q3", "google", "alcance", "pausada", 9500, 2100000, 8400, 41, 6900, 30],
    ["TikTok Ofertas Julho", "tiktok", "conversão", "ativa", 7800, 1650000, 31200, 154, 21700, 15],
    ["Email Recompra 60d", "email", "retenção", "ativa", 1200, 145000, 9800, 236, 47300, 60],
    ["Display Retargeting", "google", "conversão", "encerrada", 4300, 760000, 5100, 38, 5200, 90],
  ];
  const insCamp = db.prepare(
    `INSERT INTO marketing_campaigns (connection_id, nome, canal, objetivo, status, investimento, impressoes, cliques, conversoes, receita, inicio, fim)
     VALUES (4, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const c of campanhas) insCamp.run(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], daysAgo(c[9]), c[3] === "encerrada" ? daysAgo(10) : null);

  // ── Data Catalog (o que o sync() dos conectores popula) ────────────────
  const insAsset = db.prepare(
    `INSERT INTO data_assets (id, workspace_id, connection_id, nome, tipo, owner_id, steward_id, area, descricao, sensibilidade_lgpd, campos_sensiveis, linhas, tabela_origem, nome_original, entidade)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insAsset.run(1, 1, "Pedidos", "tabela", 1, 2, "Vendas", "Pedidos da loja VTEX (Orders API): cliente, itens, total, status e data.", "alta", JSON.stringify(["cliente_email", "cliente_cpf"]), 95, "vtex_orders", "orders", "Pedidos");
  insAsset.run(2, 1, "Produtos", "tabela", 1, 2, "Vendas", "Catálogo de produtos da VTEX (Catalog API): nome, categoria e preço.", "baixa", "[]", 10, "vtex_products", "products", "Produtos");
  insAsset.run(3, 2, "Tickets", "tabela", 1, 2, "Atendimento", "Tickets do Zendesk (Tickets API): assunto, categoria, status, prioridade, CSAT e solicitante.", "media", JSON.stringify(["requester_email"]), 60, "zendesk_tickets", "tickets", "Tickets");
  insAsset.run(4, 3, "Relatórios Power BI", "dataset", 1, 2, "Analytics", "Metadados de relatórios e datasets do workspace Power BI (REST API, leitura).", "baixa", "[]", 6, "powerbi_reports", "reports", "Relatórios");
  insAsset.run(5, 4, "Campanhas de Mídia", "tabela", 1, 2, "Marketing", "Campanhas de mídia paga (Meta, Google, TikTok, email): investimento, cliques, conversões e receita atribuída.", "baixa", "[]", 8, "marketing_campaigns", "campaigns", "Campanhas");

  // ── Layer 3: KPIs de exemplo sobre o modelo semântico ─────────────────
  const insKpi = db.prepare(
    `INSERT INTO kpis (workspace_id, nome, descricao, asset_id, agregacao, coluna_medida, coluna_data, coluna_dimensao, formato, criado_por)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 'sistema')`
  );
  insKpi.run("Faturamento", "Receita total dos pedidos (todos os status, exceto quando filtrado).", 1, "sum", "total", "criado_em", null, "moeda");
  insKpi.run("Tickets por status", "Volume da fila de suporte quebrado por status.", 3, "count", null, null, "status", "numero");
  insKpi.run("Investimento em mídia", "Total investido em campanhas, por canal.", 5, "sum", "investimento", null, "canal", "moeda");

  const insRel = db.prepare("INSERT INTO asset_relationships (asset_origem_id, asset_destino_id, tipo) VALUES (?, ?, ?)");
  insRel.run(1, 2, "referencia (produto_id)");
  insRel.run(1, 3, "cruza por email do cliente");
  insRel.run(4, 1, "consome dados de");
  insRel.run(5, 1, "atribui receita a");

  // ── Biblioteca de Queries ──────────────────────────────────────────────
  const insQuery = db.prepare(
    `INSERT INTO queries (workspace_id, autor_id, titulo, sql, descricao, tags, asset_id, ultima_execucao, performance_ms)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insQuery.run(
    1, "Clientes acima de R$500 no último mês",
    "SELECT cliente_nome, SUM(total) AS total\nFROM vtex_orders\nWHERE criado_em >= date('now','-30 days')\n  AND status != 'cancelado'\nGROUP BY cliente_email\nHAVING SUM(total) > 500\nORDER BY total DESC;",
    "Base de clientes de alto valor usada no cruzamento com tickets de suporte.",
    JSON.stringify(["vendas", "clientes", "vip"]), 1, daysAgo(1), 12
  );
  insQuery.run(
    2, "Tickets abertos por categoria",
    "SELECT categoria, COUNT(*) AS qtd\nFROM zendesk_tickets\nWHERE status = 'aberto'\nGROUP BY categoria\nORDER BY qtd DESC;",
    "Visão diária da fila de suporte para o time de atendimento.",
    JSON.stringify(["suporte", "fila"]), 3, daysAgo(0), 8
  );

  // ── Agentes ────────────────────────────────────────────────────────────
  const insAgent = db.prepare(
    `INSERT INTO agents (id, workspace_id, nome, objetivo, prompt_base, modelo, ferramentas, assets_autorizados, pode_exibir_pii,
                         personalidade, escopo_trabalho, fora_escopo, diretrizes, restricoes, custo_acumulado, execucoes)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insAgent.run(
    1, "Agente de Vendas",
    "Responder perguntas sobre pedidos, produtos, faturamento e clientes da loja VTEX.",
    "Você é um analista de vendas da Acme. Responda com números exatos, sempre citando a fonte (tabela e conector).",
    "claude-sonnet-5",
    JSON.stringify(["vtex.pedidos", "vtex.produtos", "analitico.kpis", "catalogo.busca"]),
    JSON.stringify([1, 2]), 0,
    JSON.stringify({ tom: "direto", idioma: "pt-BR", publico: "diretoria comercial" }),
    "Análises de faturamento, ticket médio, ranking de produtos e clientes da loja VTEX.",
    "Não responde sobre suporte, marketing ou dados que não venham da VTEX.",
    JSON.stringify(["Sempre excluir pedidos cancelados dos números de receita", "Citar o período analisado em toda resposta"]),
    JSON.stringify(["Nunca exibir CPF ou email em claro"]),
    4.21, 37
  );
  insAgent.run(
    2, "Agente de Suporte",
    "Responder perguntas sobre tickets, fila de atendimento e satisfação (CSAT) do Zendesk.",
    "Você é um analista de atendimento da Acme. Priorize visão de fila (abertos/pendentes) e aponte categorias recorrentes.",
    "claude-haiku-4-5",
    JSON.stringify(["zendesk.tickets", "catalogo.busca"]),
    JSON.stringify([3]), 0,
    JSON.stringify({ tom: "amigável", idioma: "pt-BR", publico: "time de atendimento" }),
    "Visão de fila (abertos/pendentes), categorias recorrentes e CSAT do Zendesk.",
    "Não responde sobre vendas, faturamento ou campanhas de marketing.",
    JSON.stringify(["Destacar tickets de prioridade alta primeiro", "Sugerir a categoria com pior CSAT como foco da semana"]),
    JSON.stringify(["Não expor o email completo dos solicitantes"]),
    1.87, 52
  );
  insAgent.run(
    3, "Analista Cross (Vendas × Suporte)",
    "Cruzar dados de vendas e atendimento e explicar relatórios existentes do Power BI.",
    "Você cruza dados de VTEX e Zendesk para achar padrões (ex.: clientes de alto valor com problemas recorrentes) e aponta o relatório Power BI certo para aprofundar.",
    "claude-sonnet-5",
    JSON.stringify(["vtex.pedidos", "zendesk.tickets", "cross.vendas_suporte", "powerbi.relatorios", "analitico.kpis", "catalogo.busca"]),
    JSON.stringify([1, 2, 3, 4]), 0,
    JSON.stringify({ tom: "técnico", idioma: "pt-BR", publico: "analistas de dados e gestores" }),
    "Cruzamentos entre vendas (VTEX) e suporte (Zendesk); indicação do relatório Power BI certo para cada análise.",
    "Não recria dashboards que já existem no Power BI; não altera dados nas origens.",
    JSON.stringify(["Explicitar a chave de cruzamento usada (email do cliente)", "Indicar o relatório Power BI relacionado quando existir"]),
    JSON.stringify(["Nunca exibir PII em claro", "Não extrapolar conclusões sem dado que sustente"]),
    9.63, 21
  );
  insAgent.run(
    4, "Agente de Marketing",
    "Analisar performance de campanhas de mídia paga e gerar criativos alinhados à marca.",
    "Você é um estrategista de growth da Acme. Analisa ROAS, CAC e CTR por canal e campanha, recomenda otimizações de verba e escreve copies para Meta, Google, TikTok e email.",
    "claude-sonnet-5",
    JSON.stringify(["marketing.campanhas", "marketing.criativos", "vtex.produtos", "analitico.kpis", "catalogo.busca"]),
    JSON.stringify([2, 5]), 0,
    JSON.stringify({ tom: "amigável", idioma: "pt-BR", publico: "time de growth e mídia" }),
    "Análises de ROAS/CAC/CTR por canal e campanha; recomendações de realocação de verba; geração de criativos (copy) por canal e objetivo.",
    "Não altera campanhas nas plataformas; não promete resultados; não cria peças visuais finais (apenas copy e conceito).",
    JSON.stringify(["Sempre reportar ROAS e CAC juntos", "Recomendar pausar campanhas com ROAS < 1", "Copies nunca prometem desconto que não existe na loja"]),
    JSON.stringify(["Não usar dados pessoais de clientes em criativos", "Não citar concorrentes nominalmente"]),
    2.34, 12
  );

  db.prepare("INSERT INTO projects (id, workspace_id, nome, agentes) VALUES (1, 1, 'Operação Comercial', ?)").run(JSON.stringify([1, 2, 3, 4]));

  const insLog = db.prepare("INSERT INTO audit_logs (workspace_id, ator, acao, alvo, detalhe, timestamp) VALUES (1, ?, ?, ?, ?, ?)");
  insLog.run("sistema", "connector.sync", "VTEX — Loja Acme (demo)", "95 pedidos e 10 produtos sincronizados; DataAssets atualizados no catálogo.", daysAgo(0, 8));
  insLog.run("sistema", "connector.sync", "Zendesk — Suporte Acme (demo)", "60 tickets sincronizados via OAuth 2.0.", daysAgo(0, 8));
  insLog.run("sistema", "connector.sync", "Power BI — Workspace Comercial (demo)", "6 relatórios catalogados (service principal, rate limit ok).", daysAgo(0, 8));
  insLog.run("sistema", "connector.sync", "Mídia Paga — Meta & Google (demo)", "8 campanhas sincronizadas com métricas de investimento e receita.", daysAgo(0, 8));
  insLog.run("Ana Souza", "catalog.update", "Pedidos", "Campos cliente_email e cliente_cpf marcados como sensíveis (LGPD).", daysAgo(1, 15));
  insLog.run("Pedro Freitas", "vault.read", "Credencial VTEX (api_key)", "Leitura de credencial para health-check do conector.", daysAgo(1, 9));
}

// ── Helpers usados pelas rotas/páginas ───────────────────────────────────

export type Role = "admin" | "steward" | "viewer";

export function audit(ator: string, acao: string, alvo: string, detalhe?: string) {
  getDb()
    .prepare("INSERT INTO audit_logs (workspace_id, ator, acao, alvo, detalhe) VALUES (1, ?, ?, ?, ?)")
    .run(ator, acao, alvo, detalhe ?? null);
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

export function maskCpf(cpf: string): string {
  return `***.${cpf.slice(4, 7)}.***-**`;
}
