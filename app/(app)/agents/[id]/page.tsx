import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import AgentEditor from "@/components/AgentEditor";
import { TOOLS_META } from "@/lib/tools-meta";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const agent = db.prepare("SELECT * FROM agents WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | {
        id: number; nome: string; objetivo: string; prompt_base: string; modelo: string;
        ferramentas: string; assets_autorizados: string; pode_exibir_pii: number;
        personalidade: string; escopo_trabalho: string; fora_escopo: string;
        diretrizes: string; restricoes: string;
        custo_acumulado: number; execucoes: number;
      }
    | undefined;
  if (!agent) notFound();

  const assets = db.prepare(
    "SELECT a.id, a.nome, c.nome AS conexao FROM data_assets a LEFT JOIN connections c ON c.id = a.connection_id WHERE a.workspace_id = 1"
  ).all() as { id: number; nome: string; conexao: string }[];

  return (
    <div className="space-y-6">
      <header>
        <Link href="/agents" className="text-[13px] text-[var(--brand)] hover:underline">← Hub de Agentes</Link>
        <div className="flex items-baseline gap-4 mt-1">
          <h1 className="text-2xl font-semibold">{agent.nome}</h1>
          <span className="text-[13px] text-[var(--ink-muted)]">{agent.execucoes} execuções · custo acumulado US$ {agent.custo_acumulado.toFixed(2)}</span>
        </div>
      </header>
      <AgentEditor
        initial={{
          id: agent.id,
          nome: agent.nome,
          objetivo: agent.objetivo ?? "",
          prompt_base: agent.prompt_base ?? "",
          modelo: agent.modelo,
          ferramentas: JSON.parse(agent.ferramentas),
          assets_autorizados: JSON.parse(agent.assets_autorizados),
          pode_exibir_pii: !!agent.pode_exibir_pii,
          personalidade: JSON.parse(agent.personalidade || "{}"),
          escopo_trabalho: agent.escopo_trabalho ?? "",
          fora_escopo: agent.fora_escopo ?? "",
          diretrizes: JSON.parse(agent.diretrizes || "[]"),
          restricoes: JSON.parse(agent.restricoes || "[]"),
        }}
        tools={TOOLS_META}
        assets={assets}
      />
    </div>
  );
}
