import { getDb, maskEmail, maskCpf } from "./db";

/**
 * Amostra dos dados de um DataAsset (Layer 1 — ingestão) para exibição na
 * interface. Campos marcados como sensíveis no catálogo saem mascarados.
 */

const TABELAS_PERMITIDAS = new Set([
  "vtex_orders",
  "vtex_products",
  "zendesk_tickets",
  "powerbi_reports",
  "marketing_campaigns",
  "raw_records",
]);

const OCULTAR = new Set(["id", "connection_id"]);
const MAX_COLS = 8;
const MAX_ROWS = 50;

export type DataSample = { columns: string[]; rows: Record<string, string>[]; total: number; masked: boolean };

function maskValue(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes("@")) return maskEmail(s);
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(s)) return maskCpf(s);
  return s ? "•••" : "";
}

export function getAssetSample(asset: {
  connection_id: number | null;
  tabela_origem: string;
  nome_original: string;
  campos_sensiveis: string;
}): DataSample | null {
  if (!asset.tabela_origem || !TABELAS_PERMITIDAS.has(asset.tabela_origem) || !asset.connection_id) return null;
  const db = getDb();
  const sensiveis = new Set(JSON.parse(asset.campos_sensiveis || "[]") as string[]);

  let raw: Record<string, unknown>[];
  let total: number;
  if (asset.tabela_origem === "raw_records") {
    total = (db.prepare("SELECT COUNT(*) c FROM raw_records WHERE connection_id = ? AND tabela = ?").get(asset.connection_id, asset.nome_original) as { c: number }).c;
    raw = (db.prepare("SELECT dados FROM raw_records WHERE connection_id = ? AND tabela = ? LIMIT ?").all(asset.connection_id, asset.nome_original, MAX_ROWS) as { dados: string }[])
      .map((r) => {
        try { return JSON.parse(r.dados) as Record<string, unknown>; } catch { return { dados: r.dados }; }
      });
  } else {
    total = (db.prepare(`SELECT COUNT(*) c FROM ${asset.tabela_origem} WHERE connection_id = ?`).get(asset.connection_id) as { c: number }).c;
    raw = db.prepare(`SELECT * FROM ${asset.tabela_origem} WHERE connection_id = ? LIMIT ?`).all(asset.connection_id, MAX_ROWS) as Record<string, unknown>[];
  }
  if (!raw.length) return { columns: [], rows: [], total, masked: false };

  const columns = Object.keys(raw[0]).filter((c) => !OCULTAR.has(c)).slice(0, MAX_COLS);
  let masked = false;
  const rows = raw.map((r) => {
    const out: Record<string, string> = {};
    for (const c of columns) {
      const v = r[c];
      if (sensiveis.has(c)) {
        out[c] = maskValue(v);
        masked = true;
      } else {
        const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
        out[c] = s.length > 80 ? s.slice(0, 77) + "…" : s;
      }
    }
    return out;
  });
  return { columns, rows, total, masked };
}
