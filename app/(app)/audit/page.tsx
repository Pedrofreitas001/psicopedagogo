import { getDb } from "@/lib/db";

const ACAO_COR: Record<string, string> = {
  "vault.read": "bg-amber-50 text-amber-800",
  "agent.execucao": "bg-violet-50 text-violet-800",
  "agent.recusa": "bg-red-50 text-red-700",
  "connector.sync": "bg-blue-50 text-blue-800",
  "catalog.update": "bg-emerald-50 text-emerald-800",
  "catalog.ownership": "bg-emerald-50 text-emerald-800",
};

export default function AuditPage() {
  const db = getDb();
  const logs = db.prepare(
    "SELECT * FROM audit_logs WHERE workspace_id = 1 ORDER BY timestamp DESC, id DESC LIMIT 200"
  ).all() as { id: number; ator: string; acao: string; alvo: string; detalhe: string; timestamp: string }[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Auditoria</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Toda ação sensível fica registrada: acesso a credenciais, execuções e recusas de agentes, sincronizações e mudanças de governança.
        </p>
      </header>

      <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[var(--ink-muted)] border-b border-black/5">
              <th className="px-4 py-2.5 font-medium">Quando</th>
              <th className="px-4 py-2.5 font-medium">Ator</th>
              <th className="px-4 py-2.5 font-medium">Ação</th>
              <th className="px-4 py-2.5 font-medium">Alvo / detalhe</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-black/4 last:border-0 align-top hover:bg-black/2">
                <td className="px-4 py-2.5 whitespace-nowrap text-[var(--ink-muted)] tabular-nums">{l.timestamp.slice(0, 16)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{l.ator}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${ACAO_COR[l.acao] ?? "bg-black/5 text-[var(--ink-2)]"}`}>
                    {l.acao}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-medium">{l.alvo}</span>
                  {l.detalhe && <span className="text-[var(--ink-muted)]"> — {l.detalhe}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
