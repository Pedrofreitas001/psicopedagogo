import Link from "next/link";
import { getDb } from "@/lib/db";

const ACAO_LABEL: Record<string, string> = {
  "connector.sync": "🔄 Sincronização",
  "agent.execucao": "🤖 Execução de agente",
  "agent.recusa": "🚫 Recusa por escopo",
  "agent.create": "🤖 Agente criado",
  "agent.update": "🤖 Agente atualizado",
  "catalog.update": "📚 Catálogo editado",
  "catalog.ownership": "👤 Ownership alterado",
  "vault.read": "🔐 Acesso a credencial",
  "dashboard.create": "📊 Dashboard salvo",
  "query.explain": "✨ Query explicada",
};

export default function Home() {
  const db = getDb();
  const stats = {
    conexoes: (db.prepare("SELECT COUNT(*) c FROM connections WHERE workspace_id=1 AND status='conectado'").get() as { c: number }).c,
    ativos: (db.prepare("SELECT COUNT(*) c FROM data_assets WHERE workspace_id=1").get() as { c: number }).c,
    agentes: (db.prepare("SELECT COUNT(*) c FROM agents WHERE workspace_id=1").get() as { c: number }).c,
    execucoes: (db.prepare("SELECT COALESCE(SUM(execucoes),0) c FROM agents WHERE workspace_id=1").get() as { c: number }).c,
    custo: (db.prepare("SELECT COALESCE(SUM(custo_acumulado),0) c FROM agents WHERE workspace_id=1").get() as { c: number }).c,
    sensiveis: (db.prepare("SELECT COUNT(*) c FROM data_assets WHERE workspace_id=1 AND sensibilidade_lgpd='alta'").get() as { c: number }).c,
  };
  const atividade = db.prepare("SELECT ator, acao, alvo, detalhe, timestamp FROM audit_logs WHERE workspace_id=1 ORDER BY timestamp DESC, id DESC LIMIT 8").all() as {
    ator: string; acao: string; alvo: string; detalhe: string; timestamp: string;
  }[];

  const cards = [
    { label: "Conexões ativas", value: stats.conexoes, href: "/connections", hint: "VTEX · Zendesk · Power BI · Mídia" },
    { label: "Ativos governados", value: stats.ativos, href: "/catalog", hint: `${stats.sensiveis} com sensibilidade LGPD alta` },
    { label: "Agentes de IA", value: stats.agentes, href: "/agents", hint: `${stats.execucoes} execuções acumuladas` },
    { label: "Custo de IA acumulado", value: `US$ ${stats.custo.toFixed(2)}`, href: "/agents", hint: "soma de todos os agentes" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Visão geral</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Uma camada central que organiza os dados das suas ferramentas SaaS e permite que agentes de IA os usem com confiança.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-xl border border-black/10 bg-white p-4 hover:border-[var(--brand)]/40 transition-colors">
            <div className="text-xs text-[var(--ink-muted)]">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value}</div>
            <div className="text-[11.5px] text-[var(--ink-muted)] mt-1">{c.hint}</div>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/4 p-5">
        <h2 className="font-medium text-[15px]">Pergunte aos seus dados</h2>
        <p className="text-sm text-[var(--ink-2)] mt-1 mb-3">
          O Orchestrator escolhe o agente certo, cruza VTEX × Zendesk × Power BI, responde citando a fonte e gera a visualização.
        </p>
        <Link href="/assistant" className="inline-block rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm font-medium">
          Abrir assistente →
        </Link>
      </div>

      <section>
        <h2 className="font-medium text-[15px] mb-3">Atividade recente (auditoria)</h2>
        <div className="rounded-xl border border-black/10 bg-white divide-y divide-black/5">
          {atividade.map((a, i) => (
            <div key={i} className="px-4 py-2.5 flex items-baseline gap-3 text-[13px]">
              <span className="shrink-0 w-44 text-[var(--ink-2)]">{ACAO_LABEL[a.acao] ?? a.acao}</span>
              <span className="flex-1 min-w-0">
                <span className="font-medium">{a.alvo}</span>
                {a.detalhe && <span className="text-[var(--ink-muted)]"> — {a.detalhe}</span>}
              </span>
              <span className="shrink-0 text-[11.5px] text-[var(--ink-muted)]">{a.ator} · {a.timestamp.slice(5, 16)}</span>
            </div>
          ))}
        </div>
        <Link href="/audit" className="inline-block mt-2 text-[13px] text-[var(--brand)] hover:underline">
          Ver auditoria completa →
        </Link>
      </section>
    </div>
  );
}
