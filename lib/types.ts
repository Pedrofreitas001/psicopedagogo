/**
 * Contrato do Dynamic UI Engine (Módulo 9 do PRD).
 * Agentes devolvem blocos deste tipo; o frontend renderiza sem código
 * específico por caso de uso. É o mesmo JSON gravado em Dashboard.spec_json.
 */

export type KpiSpec = {
  type: "kpi";
  title?: string;
  items: { label: string; value: string; hint?: string }[];
};

export type TableSpec = {
  type: "table";
  title?: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number | null>[];
};

export type ChartSpec = {
  type: "chart";
  chartType: "bar" | "line";
  title?: string;
  unit?: string; // ex.: "R$", "tickets"
  data: { label: string; value: number }[];
};

export type KanbanSpec = {
  type: "kanban";
  title?: string;
  columns: { title: string; cards: { title: string; subtitle?: string; badge?: string }[] }[];
};

export type UISpec = KpiSpec | TableSpec | ChartSpec | KanbanSpec;

export type ChatSource = { asset: string; connection: string };

export type ChatResponse = {
  answer: string;
  blocks: UISpec[];
  agents: { id: number; nome: string }[];
  sources: ChatSource[];
  masked: boolean;
  custo: number;
  duracao_ms: number;
  refused?: boolean;
};
