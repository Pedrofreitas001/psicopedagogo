import Link from "next/link";
import { getDb } from "@/lib/db";
import { listKpis, computeKpi } from "@/lib/kpi";
import SpecRenderer from "@/components/SpecRenderer";
import KpiBuilder from "@/components/KpiBuilder";
import { KpiDeleteButton, KpiToDashboard } from "@/components/KpiActions";

export default function KpisPage() {
  const db = getDb();
  const assets = db.prepare(
    "SELECT id, nome FROM data_assets WHERE workspace_id = 1 AND tabela_origem != '' ORDER BY nome"
  ).all() as { id: number; nome: string }[];
  const resultados = listKpis()
    .map((k) => computeKpi(k))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">KPIs</h1>
          <p className="text-sm text-[var(--ink-2)] mt-1 max-w-2xl">
            O modelo analítico (Layer 3): métricas declaradas sobre o modelo semântico, calculadas sob demanda a partir dos dados
            ingeridos. Agentes e dashboards consomem estes mesmos KPIs.
          </p>
        </div>
        <KpiBuilder assets={assets} />
      </header>

      {resultados.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-[var(--ink-muted)]">
          Nenhum KPI definido. Crie um acima, ou vá a um ativo no{" "}
          <Link href="/catalog" className="text-[var(--brand)] hover:underline">Data Catalog</Link> e use as sugestões do profiler.
        </div>
      )}

      <div className="space-y-8">
        {resultados.map((r) => (
          <section key={r.kpi.id} className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-end gap-5">
                <div>
                  <h2 className="text-sm font-medium text-[var(--ink-2)]">{r.kpi.nome}</h2>
                  <div className="text-3xl font-semibold tracking-tight">{r.valor}</div>
                </div>
                <p className="text-[12px] text-[var(--ink-muted)] pb-1">
                  {r.kpi.agregacao}
                  {r.kpi.coluna_medida && `(${r.kpi.coluna_medida})`} · {r.linhas.toLocaleString("pt-BR")} linhas ·
                  fonte: {r.assetNome} · {r.conexao}
                  {r.kpi.criado_por && ` · por ${r.kpi.criado_por}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <KpiToDashboard nome={r.kpi.nome} valor={r.valor} blocks={r.blocks} />
                <KpiDeleteButton kpiId={r.kpi.id} nome={r.kpi.nome} />
              </div>
            </div>
            {r.kpi.descricao && <p className="text-[12.5px] text-[var(--ink-muted)] -mt-2">{r.kpi.descricao}</p>}
            {r.blocks.map((spec, i) => (
              <SpecRenderer key={i} spec={spec} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
