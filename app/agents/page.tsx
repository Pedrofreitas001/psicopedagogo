import Link from "next/link";
import { getDb } from "@/lib/db";
import { TOOL_LABELS } from "@/lib/engine";

export default function AgentsPage() {
  const db = getDb();
  const agents = db.prepare("SELECT * FROM agents WHERE workspace_id = 1 ORDER BY id").all() as {
    id: number; nome: string; objetivo: string; modelo: string; ferramentas: string;
    pode_exibir_pii: number; custo_acumulado: number; execucoes: number;
  }[];
  const project = db.prepare("SELECT nome FROM projects WHERE id = 1").get() as { nome: string } | undefined;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hub de Agentes</h1>
          <p className="text-sm text-[var(--ink-2)] mt-1">
            Cada agente tem escopo explícito: skills (ferramentas MCP), ativos autorizados e política de PII.
            {project && <> Todos participam do projeto <span className="font-medium">“{project.nome}”</span>, onde o Orchestrator roteia as perguntas.</>}
          </p>
        </div>
        <Link href="/agents/new" className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm font-medium shrink-0">
          + Novo agente
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {agents.map((a) => {
          const tools = JSON.parse(a.ferramentas) as string[];
          return (
            <Link key={a.id} href={`/agents/${a.id}`} className="rounded-xl border border-black/10 bg-white p-5 hover:border-[var(--brand)]/40 transition-colors block">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-700 grid place-items-center text-lg">🤖</div>
                  <div>
                    <h2 className="font-semibold">{a.nome}</h2>
                    <p className="text-[12.5px] text-[var(--ink-muted)]">{a.objetivo}</p>
                  </div>
                </div>
                <div className="text-right text-[12px] text-[var(--ink-muted)] shrink-0">
                  <div><code className="bg-black/5 rounded px-1.5 py-0.5 text-[11px]">{a.modelo}</code></div>
                  <div className="mt-1">{a.execucoes} execuções · US$ {a.custo_acumulado.toFixed(2)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tools.map((t) => (
                  <span key={t} className="text-[11.5px] rounded-full bg-[var(--brand)]/8 text-[var(--brand)] px-2 py-0.5">
                    {TOOL_LABELS[t] ?? t}
                  </span>
                ))}
                <span className={`text-[11.5px] rounded-full px-2 py-0.5 ${a.pode_exibir_pii ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {a.pode_exibir_pii ? "PII em claro" : "🔒 PII mascarado"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
