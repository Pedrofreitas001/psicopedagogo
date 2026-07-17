import Link from "next/link";
import { getDb } from "@/lib/db";
import SpecRenderer from "@/components/SpecRenderer";
import CreativeStudio from "@/components/CreativeStudio";
import type { UISpec } from "@/lib/types";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MarketingPage() {
  const db = getDb();
  const camps = db.prepare(
    "SELECT nome, canal, objetivo, status, investimento, impressoes, cliques, conversoes, receita FROM marketing_campaigns ORDER BY receita DESC"
  ).all() as {
    nome: string; canal: string; objetivo: string; status: string;
    investimento: number; impressoes: number; cliques: number; conversoes: number; receita: number;
  }[];
  const produtos = db.prepare("SELECT id, nome, preco FROM vtex_products ORDER BY nome").all() as { id: number; nome: string; preco: number }[];

  const inv = camps.reduce((s, c) => s + c.investimento, 0);
  const rec = camps.reduce((s, c) => s + c.receita, 0);
  const conv = camps.reduce((s, c) => s + c.conversoes, 0);
  const cli = camps.reduce((s, c) => s + c.cliques, 0);
  const imp = camps.reduce((s, c) => s + c.impressoes, 0);

  const canais = Object.values(
    camps.reduce((acc, c) => {
      acc[c.canal] ??= { canal: c.canal, inv: 0, rec: 0 };
      acc[c.canal].inv += c.investimento;
      acc[c.canal].rec += c.receita;
      return acc;
    }, {} as Record<string, { canal: string; inv: number; rec: number }>)
  ).sort((a, b) => b.rec / b.inv - a.rec / a.inv);

  // Insights automáticos (regras de negócio sobre os dados)
  const insights: { tipo: "ok" | "alerta" | "acao"; texto: string }[] = [];
  if (canais.length) {
    const melhor = canais[0];
    insights.push({ tipo: "ok", texto: `${melhor.canal} é o canal mais eficiente: ROAS ${(melhor.rec / melhor.inv).toFixed(2)} — considere realocar verba para ele.` });
  }
  for (const c of camps) {
    const roas = c.receita / c.investimento;
    if (c.status === "ativa" && roas < 1) {
      insights.push({ tipo: "acao", texto: `“${c.nome}” está ativa com ROAS ${roas.toFixed(2)} (queima ${fmtBRL(c.investimento - c.receita)}) — candidata a pausa ou revisão de segmentação.` });
    }
  }
  const ctrMedio = cli / Math.max(imp, 1);
  const piorCtr = [...camps].filter((c) => c.status === "ativa").sort((a, b) => a.cliques / a.impressoes - b.cliques / b.impressoes)[0];
  if (piorCtr && piorCtr.cliques / piorCtr.impressoes < ctrMedio * 0.5) {
    insights.push({ tipo: "alerta", texto: `“${piorCtr.nome}” tem CTR ${((piorCtr.cliques / piorCtr.impressoes) * 100).toFixed(2)}%, bem abaixo da média (${(ctrMedio * 100).toFixed(2)}%) — o criativo pode estar fatigado. Gere variações no estúdio abaixo.` });
  }

  const kpiSpec: UISpec = {
    type: "kpi",
    items: [
      { label: "Investimento", value: fmtBRL(inv), hint: `${camps.length} campanhas` },
      { label: "Receita atribuída", value: fmtBRL(rec), hint: `ROAS ${(rec / Math.max(inv, 1)).toFixed(2)}` },
      { label: "CAC médio", value: fmtBRL(inv / Math.max(conv, 1)), hint: `${conv.toLocaleString("pt-BR")} conversões` },
    ],
  };
  const chartSpec: UISpec = {
    type: "chart",
    chartType: "bar",
    title: "ROAS por canal",
    data: canais.map((c) => ({ label: c.canal, value: Math.round((c.rec / c.inv) * 100) / 100 })),
  };
  const tableSpec: UISpec = {
    type: "table",
    title: "Campanhas (ordenadas por receita)",
    columns: [
      { key: "nome", label: "Campanha" },
      { key: "canal", label: "Canal" },
      { key: "status", label: "Status" },
      { key: "investimento", label: "Investimento", align: "right" },
      { key: "receita", label: "Receita", align: "right" },
      { key: "roas", label: "ROAS", align: "right" },
      { key: "ctr", label: "CTR", align: "right" },
      { key: "cac", label: "CAC", align: "right" },
    ],
    rows: camps.map((c) => ({
      nome: c.nome,
      canal: c.canal,
      status: c.status,
      investimento: fmtBRL(c.investimento),
      receita: fmtBRL(c.receita),
      roas: (c.receita / c.investimento).toFixed(2),
      ctr: `${((c.cliques / Math.max(c.impressoes, 1)) * 100).toFixed(2)}%`,
      cac: c.conversoes ? fmtBRL(c.investimento / c.conversoes) : "—",
    })),
  };

  const INSIGHT_STYLE = { ok: "bg-emerald-50 border-emerald-200 text-emerald-800", alerta: "bg-amber-50 border-amber-200 text-amber-800", acao: "bg-red-50 border-red-200 text-red-800" };
  const INSIGHT_ICON = { ok: "📈", alerta: "⚠️", acao: "✂️" };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Marketing</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Performance de mídia paga sobre os dados sincronizados, insights automáticos e estúdio de criativos.
          Pergunte também no <Link href="/assistant" className="text-[var(--brand)] hover:underline">Assistente</Link>: “qual o ROAS por canal?”.
        </p>
      </header>

      {camps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-[var(--ink-muted)]">
          Nenhuma campanha sincronizada. Sincronize a conexão de Mídia Paga na aba{" "}
          <Link href="/connections" className="text-[var(--brand)] hover:underline">Conexões</Link>.
        </div>
      ) : (
        <>
          <SpecRenderer spec={kpiSpec} />

          <div className="grid grid-cols-2 gap-4 items-start">
            <SpecRenderer spec={chartSpec} />
            <div className="space-y-2">
              <h2 className="text-sm font-medium px-1">Insights automáticos</h2>
              {insights.map((ins, i) => (
                <div key={i} className={`rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed ${INSIGHT_STYLE[ins.tipo]}`}>
                  {INSIGHT_ICON[ins.tipo]} {ins.texto}
                </div>
              ))}
            </div>
          </div>

          <SpecRenderer spec={tableSpec} />
        </>
      )}

      <CreativeStudio produtos={produtos} />
    </div>
  );
}
