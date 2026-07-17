import Link from "next/link";
import { getDb } from "@/lib/db";
import ExplainButton from "@/components/ExplainButton";

export default function QueriesPage() {
  const db = getDb();
  const queries = db.prepare(
    `SELECT q.*, u.nome AS autor, a.nome AS asset, a.id AS asset_id
     FROM queries q
     LEFT JOIN users u ON u.id = q.autor_id
     LEFT JOIN data_assets a ON a.id = q.asset_id
     WHERE q.workspace_id = 1 ORDER BY q.id`
  ).all() as {
    id: number; titulo: string; sql: string; descricao: string; tags: string;
    autor: string; asset: string; asset_id: number; ultima_execucao: string; performance_ms: number;
  }[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Biblioteca de Queries</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Consultas versionadas e ligadas aos ativos do catálogo — a mesma base que os agentes reutilizam como ferramenta.
        </p>
      </header>

      <div className="space-y-4">
        {queries.map((q) => (
          <div key={q.id} className="rounded-xl border border-black/10 bg-white p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{q.titulo}</h2>
                <p className="text-[13px] text-[var(--ink-2)] mt-0.5">{q.descricao}</p>
              </div>
              <div className="text-right text-[11.5px] text-[var(--ink-muted)] shrink-0">
                <div>por {q.autor}</div>
                {q.performance_ms != null && <div>{q.performance_ms}ms na última execução</div>}
              </div>
            </div>
            <pre className="rounded-lg bg-[#0f1117] text-[#d5dbe5] text-[12px] leading-relaxed p-4 overflow-x-auto">{q.sql}</pre>
            <div className="flex items-center gap-2 flex-wrap">
              {(JSON.parse(q.tags) as string[]).map((t) => (
                <span key={t} className="text-[11.5px] rounded-full bg-black/5 text-[var(--ink-2)] px-2 py-0.5">#{t}</span>
              ))}
              {q.asset && (
                <Link href={`/catalog/${q.asset_id}`} className="text-[11.5px] rounded-full bg-blue-50 text-blue-800 px-2 py-0.5 hover:bg-blue-100">
                  📚 {q.asset}
                </Link>
              )}
              <div className="ml-auto"><ExplainButton queryId={q.id} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
