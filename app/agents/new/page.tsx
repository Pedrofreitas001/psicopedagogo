import Link from "next/link";
import { getDb } from "@/lib/db";
import AgentEditor from "@/components/AgentEditor";
import { TOOLS_META } from "@/lib/tools-meta";

export default function NewAgentPage() {
  const db = getDb();
  const assets = db.prepare(
    "SELECT a.id, a.nome, c.nome AS conexao FROM data_assets a LEFT JOIN connections c ON c.id = a.connection_id WHERE a.workspace_id = 1"
  ).all() as { id: number; nome: string; conexao: string }[];

  return (
    <div className="space-y-6">
      <header>
        <Link href="/agents" className="text-[13px] text-[var(--brand)] hover:underline">← Hub de Agentes</Link>
        <h1 className="text-2xl font-semibold mt-1">Novo agente</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">Defina objetivo, modelo e — principalmente — o escopo: skills e ativos que ele pode usar.</p>
      </header>
      <AgentEditor initial={null} tools={TOOLS_META} assets={assets} />
    </div>
  );
}
