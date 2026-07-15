import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import AssetEditor from "@/components/AssetEditor";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const asset = db.prepare(
    `SELECT a.*, c.nome AS conexao FROM data_assets a
     LEFT JOIN connections c ON c.id = a.connection_id
     WHERE a.id = ? AND a.workspace_id = 1`
  ).get(Number(id)) as
    | {
        id: number; nome: string; tipo: string; area: string; descricao: string; sensibilidade_lgpd: string;
        campos_sensiveis: string; linhas: number; conexao: string; owner_id: number | null; steward_id: number | null;
      }
    | undefined;
  if (!asset) notFound();

  const users = db.prepare("SELECT id, nome, papel FROM users WHERE workspace_id = 1").all() as { id: number; nome: string; papel: string }[];
  const rels = db.prepare(
    `SELECT r.tipo, a1.nome AS origem, a2.nome AS destino, a2.id AS destino_id, a1.id AS origem_id
     FROM asset_relationships r
     JOIN data_assets a1 ON a1.id = r.asset_origem_id
     JOIN data_assets a2 ON a2.id = r.asset_destino_id
     WHERE r.asset_origem_id = ? OR r.asset_destino_id = ?`
  ).all(asset.id, asset.id) as { tipo: string; origem: string; destino: string; origem_id: number; destino_id: number }[];
  const queries = db.prepare("SELECT id, titulo FROM queries WHERE asset_id = ?").all(asset.id) as { id: number; titulo: string }[];
  const agentes = db.prepare("SELECT id, nome, assets_autorizados FROM agents WHERE workspace_id = 1").all() as {
    id: number; nome: string; assets_autorizados: string;
  }[];
  const agentesComAcesso = agentes.filter((ag) => (JSON.parse(ag.assets_autorizados) as number[]).includes(asset.id));

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <Link href="/catalog" className="text-[13px] text-[var(--brand)] hover:underline">← Data Catalog</Link>
        <h1 className="text-2xl font-semibold mt-1">{asset.nome}</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          {asset.tipo} · {asset.conexao} · {asset.linhas.toLocaleString("pt-BR")} linhas sincronizadas
        </p>
      </header>

      <AssetEditor
        asset={{
          id: asset.id,
          descricao: asset.descricao,
          area: asset.area,
          sensibilidade_lgpd: asset.sensibilidade_lgpd,
          campos_sensiveis: JSON.parse(asset.campos_sensiveis),
          owner_id: asset.owner_id,
          steward_id: asset.steward_id,
        }}
        users={users}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <h3 className="text-sm font-semibold mb-2">Relacionamentos</h3>
          {rels.length === 0 && <p className="text-[13px] text-[var(--ink-muted)]">Nenhum relacionamento mapeado.</p>}
          <ul className="space-y-1.5 text-[13px]">
            {rels.map((r, i) => (
              <li key={i} className="text-[var(--ink-2)]">
                <Link className="font-medium text-[var(--brand)] hover:underline" href={`/catalog/${r.origem_id === asset.id ? r.destino_id : r.origem_id}`}>
                  {r.origem_id === asset.id ? r.destino : r.origem}
                </Link>{" "}
                <span className="text-[var(--ink-muted)]">— {r.tipo}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <h3 className="text-sm font-semibold mb-2">Uso</h3>
          <p className="text-[12.5px] text-[var(--ink-muted)] mb-1">Queries ligadas</p>
          <ul className="space-y-1 text-[13px] mb-3">
            {queries.length === 0 && <li className="text-[var(--ink-muted)]">nenhuma</li>}
            {queries.map((q) => (
              <li key={q.id}><Link href="/queries" className="text-[var(--brand)] hover:underline">{q.titulo}</Link></li>
            ))}
          </ul>
          <p className="text-[12.5px] text-[var(--ink-muted)] mb-1">Agentes com acesso autorizado</p>
          <div className="flex flex-wrap gap-1.5">
            {agentesComAcesso.length === 0 && <span className="text-[13px] text-[var(--ink-muted)]">nenhum</span>}
            {agentesComAcesso.map((ag) => (
              <Link key={ag.id} href={`/agents/${ag.id}`} className="text-[12px] rounded-full bg-violet-100 text-violet-800 px-2 py-0.5 hover:bg-violet-200">
                🤖 {ag.nome}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
