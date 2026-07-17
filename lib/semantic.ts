import { getDb } from "./db";

/**
 * Layer 2 — Modelo Semântico (o embrião do Semantic Builder).
 *
 * Para fontes de APIs conhecidas (VTEX, Zendesk...) o significado das
 * colunas já vem do conector. Para fontes genéricas (Supabase, futuramente
 * Excel/CSV) ninguém sabe o que é "tbl_x.col_y" — então o profiler analisa
 * uma amostra dos dados e INFERE o papel de cada coluna:
 *
 *   chave     → identificadores (id, *_id, uuid)
 *   data      → datas/timestamps (viram eixo temporal de KPIs)
 *   medida    → números agregáveis (viram SUM/AVG de KPIs)
 *   dimensao  → categorias (viram quebras de KPIs e filtros)
 *   ignorar   → texto livre sem valor analítico
 *
 * A inferência é uma SUGESTÃO: o steward confirma/corrige na interface
 * (curadoria). É exatamente aqui que a entrevista conduzida por IA pluga
 * no futuro — mesmo contrato, só muda quem faz a pergunta.
 */

export type ColumnProfile = {
  coluna: string;
  tipo_dado: "texto" | "numero" | "moeda" | "data" | "booleano" | "id" | "email";
  papel: "dimensao" | "medida" | "data" | "chave" | "ignorar";
  cardinalidade: number;
  exemplo: string;
  confirmado?: number;
  nome_semantico?: string;
};

export type KpiSuggestion = {
  nome: string;
  agregacao: "sum" | "avg" | "count" | "count_distinct";
  coluna_medida: string | null;
  coluna_data: string | null;
  coluna_dimensao: string | null;
  formato: "numero" | "moeda" | "percentual";
  motivo: string;
};

const MAX_ROWS_ANALISE = 5000;

/** Linhas brutas de um ativo, sem mascaramento (uso interno do servidor). */
export function getRawRows(asset: { connection_id: number | null; tabela_origem: string; nome_original: string }): Record<string, unknown>[] {
  if (!asset.connection_id || !asset.tabela_origem) return [];
  const db = getDb();
  if (asset.tabela_origem === "raw_records") {
    const rows = db.prepare("SELECT dados FROM raw_records WHERE connection_id = ? AND tabela = ? LIMIT ?")
      .all(asset.connection_id, asset.nome_original, MAX_ROWS_ANALISE) as { dados: string }[];
    return rows.map((r) => {
      try { return JSON.parse(r.dados) as Record<string, unknown>; } catch { return {}; }
    });
  }
  const permitidas = new Set(["vtex_orders", "vtex_products", "zendesk_tickets", "powerbi_reports", "marketing_campaigns"]);
  if (!permitidas.has(asset.tabela_origem)) return [];
  return db.prepare(`SELECT * FROM ${asset.tabela_origem} WHERE connection_id = ? LIMIT ?`)
    .all(asset.connection_id, MAX_ROWS_ANALISE) as Record<string, unknown>[];
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?/;
const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NOMES_MOEDA = /(valor|total|preco|preço|receita|custo|invest|fatur|price|amount|revenue|cost)/i;

function inferColumn(coluna: string, valores: unknown[]): Omit<ColumnProfile, "cardinalidade" | "exemplo"> {
  const amostra = valores.filter((v) => v !== null && v !== undefined && v !== "").slice(0, 200);
  const distintos = new Set(amostra.map((v) => String(v)));
  const nome = coluna.toLowerCase();

  if (nome === "id" || nome.endsWith("_id") || nome === "uuid" || nome.endsWith("_uuid"))
    return { coluna, tipo_dado: "id", papel: "chave" };
  if (amostra.length && amostra.every((v) => RE_EMAIL.test(String(v))))
    return { coluna, tipo_dado: "email", papel: "dimensao" };
  if (amostra.length && amostra.every((v) => RE_DATA.test(String(v))))
    return { coluna, tipo_dado: "data", papel: "data" };
  if (nome.includes("data") || nome.includes("date") || nome.endsWith("_em") || nome.endsWith("_at")) {
    if (amostra.some((v) => !Number.isNaN(Date.parse(String(v))))) return { coluna, tipo_dado: "data", papel: "data" };
  }
  const numericos = amostra.filter((v) => typeof v === "number" || (!Number.isNaN(Number(v)) && String(v).trim() !== ""));
  if (amostra.length && numericos.length === amostra.length) {
    if (amostra.every((v) => v === 0 || v === 1 || v === true || v === false || v === "0" || v === "1"))
      return { coluna, tipo_dado: "booleano", papel: "dimensao" };
    // inteiro com quase tudo distinto parece identificador
    const inteiros = numericos.every((v) => Number.isInteger(Number(v)));
    if (inteiros && distintos.size > amostra.length * 0.95 && !NOMES_MOEDA.test(nome))
      return { coluna, tipo_dado: "id", papel: "chave" };
    return { coluna, tipo_dado: NOMES_MOEDA.test(nome) ? "moeda" : "numero", papel: "medida" };
  }
  if (typeof amostra[0] === "boolean") return { coluna, tipo_dado: "booleano", papel: "dimensao" };
  if (distintos.size <= Math.max(20, amostra.length * 0.2)) return { coluna, tipo_dado: "texto", papel: "dimensao" };
  return { coluna, tipo_dado: "texto", papel: "ignorar" }; // texto livre (assuntos, descrições)
}

/** Analisa a amostra do ativo e grava/atualiza o perfil das colunas (preservando curadoria já confirmada). */
export function profileAsset(assetId: number): ColumnProfile[] {
  const db = getDb();
  const asset = db.prepare("SELECT id, connection_id, tabela_origem, nome_original FROM data_assets WHERE id = ? AND workspace_id = 1").get(assetId) as
    | { id: number; connection_id: number | null; tabela_origem: string; nome_original: string }
    | undefined;
  if (!asset) return [];
  const rows = getRawRows(asset);
  if (!rows.length) return listColumns(assetId);

  const colunas = Object.keys(rows[0]).filter((c) => c !== "connection_id");
  const upsert = db.prepare(
    `INSERT INTO asset_columns (asset_id, coluna, tipo_dado, papel, cardinalidade, exemplo)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (asset_id, coluna) DO UPDATE SET
       cardinalidade = excluded.cardinalidade,
       exemplo = excluded.exemplo,
       tipo_dado = CASE WHEN asset_columns.confirmado = 1 THEN asset_columns.tipo_dado ELSE excluded.tipo_dado END,
       papel = CASE WHEN asset_columns.confirmado = 1 THEN asset_columns.papel ELSE excluded.papel END`
  );
  for (const coluna of colunas) {
    const valores = rows.map((r) => r[coluna]);
    const inferido = inferColumn(coluna, valores);
    const distintos = new Set(valores.filter((v) => v !== null && v !== undefined).map((v) => String(v)));
    const exemplo = String(valores.find((v) => v !== null && v !== undefined && v !== "") ?? "").slice(0, 60);
    upsert.run(assetId, coluna, inferido.tipo_dado, inferido.papel, distintos.size, exemplo);
  }
  return listColumns(assetId);
}

export function listColumns(assetId: number): ColumnProfile[] {
  return getDb().prepare("SELECT coluna, nome_semantico, tipo_dado, papel, cardinalidade, exemplo, confirmado FROM asset_columns WHERE asset_id = ? ORDER BY id").all(assetId) as ColumnProfile[];
}

/** Sugestões de KPI derivadas do modelo semântico (Layer 2 → Layer 3). */
export function suggestKpis(assetId: number, assetNome: string): KpiSuggestion[] {
  const cols = listColumns(assetId);
  const medidas = cols.filter((c) => c.papel === "medida");
  const datas = cols.filter((c) => c.papel === "data");
  const dims = cols.filter((c) => c.papel === "dimensao" && c.tipo_dado !== "email");
  const data0 = datas[0]?.coluna ?? null;
  const dim0 = dims[0]?.coluna ?? null;
  const out: KpiSuggestion[] = [];

  for (const m of medidas.slice(0, 3)) {
    const nomeCol = m.nome_semantico || m.coluna;
    out.push({
      nome: `${m.tipo_dado === "moeda" ? "Total de" : "Soma de"} ${nomeCol} (${assetNome})`,
      agregacao: "sum",
      coluna_medida: m.coluna,
      coluna_data: data0,
      coluna_dimensao: data0 ? null : dim0,
      formato: m.tipo_dado === "moeda" ? "moeda" : "numero",
      motivo: `“${m.coluna}” foi identificada como medida${m.tipo_dado === "moeda" ? " monetária" : ""}.`,
    });
  }
  if (dim0) {
    out.push({
      nome: `Contagem por ${dims[0].nome_semantico || dim0} (${assetNome})`,
      agregacao: "count",
      coluna_medida: null,
      coluna_data: null,
      coluna_dimensao: dim0,
      formato: "numero",
      motivo: `“${dim0}” é uma dimensão com ${dims[0].cardinalidade} valores distintos — boa para quebra.`,
    });
  }
  if (!out.length) {
    out.push({
      nome: `Total de registros (${assetNome})`,
      agregacao: "count",
      coluna_medida: null,
      coluna_data: data0,
      coluna_dimensao: null,
      formato: "numero",
      motivo: "Nenhuma medida identificada; contagem simples de linhas.",
    });
  }
  return out;
}
