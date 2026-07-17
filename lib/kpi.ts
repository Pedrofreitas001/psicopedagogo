import { getDb } from "./db";
import { getRawRows } from "./semantic";
import type { UISpec } from "./types";

/**
 * Layer 3 — Modelo Analítico. Um KPI é uma definição declarativa
 * (agregação + medida + eixo temporal + quebra) sobre um ativo do modelo
 * semântico. O valor é calculado sob demanda a partir dos dados ingeridos
 * — nada é pré-materializado no MVP (os volumes são pequenos); quando o
 * volume crescer, esta função vira uma view materializada no Postgres sem
 * mudar o contrato.
 */

export type KpiRow = {
  id: number;
  nome: string;
  descricao: string;
  asset_id: number;
  agregacao: "sum" | "avg" | "count" | "count_distinct" | "min" | "max";
  coluna_medida: string | null;
  coluna_data: string | null;
  coluna_dimensao: string | null;
  formato: "numero" | "moeda" | "percentual";
  criado_por: string | null;
};

export type KpiResult = {
  kpi: KpiRow;
  assetNome: string;
  conexao: string;
  valor: string;
  linhas: number;
  blocks: UISpec[];
};

function agg(values: number[], tipo: KpiRow["agregacao"], countAll: number, distinct: number): number {
  switch (tipo) {
    case "sum": return values.reduce((s, v) => s + v, 0);
    case "avg": return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    case "min": return values.length ? Math.min(...values) : 0;
    case "max": return values.length ? Math.max(...values) : 0;
    case "count_distinct": return distinct;
    default: return countAll;
  }
}

function fmt(v: number, formato: KpiRow["formato"]): string {
  if (formato === "moeda") return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (formato === "percentual") return `${(v * 100).toFixed(1)}%`;
  return Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function computeKpi(kpi: KpiRow): KpiResult | null {
  const db = getDb();
  const asset = db.prepare(
    `SELECT a.nome, a.connection_id, a.tabela_origem, a.nome_original, c.nome AS conexao
     FROM data_assets a LEFT JOIN connections c ON c.id = a.connection_id
     WHERE a.id = ? AND a.workspace_id = 1`
  ).get(kpi.asset_id) as { nome: string; connection_id: number | null; tabela_origem: string; nome_original: string; conexao: string } | undefined;
  if (!asset) return null;

  const rows = getRawRows(asset);
  const num = (r: Record<string, unknown>) => {
    const v = Number(r[kpi.coluna_medida ?? ""]);
    return Number.isFinite(v) ? v : null;
  };
  const valoresNum = kpi.coluna_medida ? rows.map(num).filter((v): v is number => v !== null) : [];
  const distinct = kpi.coluna_medida ? new Set(rows.map((r) => String(r[kpi.coluna_medida!] ?? ""))).size : 0;
  const valorTotal = agg(valoresNum, kpi.agregacao, rows.length, distinct);

  const blocks: UISpec[] = [];

  // Série temporal (se houver coluna de data)
  if (kpi.coluna_data && rows.length) {
    const buckets = new Map<string, { soma: number; qtd: number; ord: string }>();
    for (const r of rows) {
      const t = Date.parse(String(r[kpi.coluna_data] ?? ""));
      if (Number.isNaN(t)) continue;
      const ord = new Date(t).toISOString().slice(0, 10);
      const b = buckets.get(ord) ?? { soma: 0, qtd: 0, ord };
      const v = kpi.coluna_medida ? num(r) : 1;
      if (v !== null) { b.soma += kpi.coluna_medida ? v : 0; b.qtd += 1; }
      buckets.set(ord, b);
    }
    const serie = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-45)
      .map(([ord, b]) => ({
        label: `${ord.slice(8, 10)}/${ord.slice(5, 7)}`,
        value: Math.round((kpi.agregacao === "avg" ? (b.qtd ? b.soma / b.qtd : 0) : kpi.coluna_medida ? b.soma : b.qtd) * 100) / 100,
      }));
    if (serie.length >= 2) {
      blocks.push({ type: "chart", chartType: "line", title: `${kpi.nome} — evolução diária`, unit: kpi.formato === "moeda" ? "R$" : undefined, data: serie });
    }
  }

  // Quebra por dimensão
  if (kpi.coluna_dimensao && rows.length) {
    const grupos = new Map<string, { soma: number; qtd: number; distintos: Set<string> }>();
    for (const r of rows) {
      const chave = String(r[kpi.coluna_dimensao] ?? "—") || "—";
      const g = grupos.get(chave) ?? { soma: 0, qtd: 0, distintos: new Set<string>() };
      const v = kpi.coluna_medida ? num(r) : null;
      if (kpi.coluna_medida && v !== null) g.soma += v;
      g.qtd += 1;
      if (kpi.coluna_medida) g.distintos.add(String(r[kpi.coluna_medida] ?? ""));
      grupos.set(chave, g);
    }
    const porGrupo = (g: { soma: number; qtd: number; distintos: Set<string> }): number => {
      switch (kpi.agregacao) {
        case "count": return g.qtd;
        case "count_distinct": return g.distintos.size;
        case "avg": return g.qtd ? g.soma / g.qtd : 0;
        default: return g.soma; // sum (min/max por grupo não suportado no MVP)
      }
    };
    const data = [...grupos.entries()]
      .map(([label, g]) => ({ label, value: Math.round(porGrupo(g) * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    blocks.push({ type: "chart", chartType: "bar", title: `${kpi.nome} — por ${kpi.coluna_dimensao}`, unit: kpi.formato === "moeda" ? "R$" : undefined, data });
  }

  return {
    kpi,
    assetNome: asset.nome,
    conexao: asset.conexao ?? "—",
    valor: fmt(valorTotal, kpi.formato),
    linhas: rows.length,
    blocks,
  };
}

export function listKpis(): KpiRow[] {
  return getDb().prepare("SELECT * FROM kpis WHERE workspace_id = 1 ORDER BY id").all() as KpiRow[];
}
