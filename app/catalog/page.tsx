import Link from "next/link";
import { getDb } from "@/lib/db";

const LGPD_BADGE: Record<string, string> = {
  alta: "bg-red-50 text-red-700 border-red-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  baixa: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function CatalogPage() {
  const db = getDb();
  const assets = db.prepare(
    `SELECT a.*, c.nome AS conexao, uo.nome AS owner, us.nome AS steward
     FROM data_assets a
     LEFT JOIN connections c ON c.id = a.connection_id
     LEFT JOIN users uo ON uo.id = a.owner_id
     LEFT JOIN users us ON us.id = a.steward_id
     WHERE a.workspace_id = 1 ORDER BY a.id`
  ).all() as {
    id: number; nome: string; tipo: string; area: string; descricao: string; sensibilidade_lgpd: string;
    campos_sensiveis: string; linhas: number; conexao: string; owner: string; steward: string;
  }[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Data Catalog</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Todo ativo sincronizado vira um card governado: owner, steward, sensibilidade LGPD e relacionamentos. Agentes só enxergam ativos autorizados.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {assets.map((a) => {
          const sensiveis = JSON.parse(a.campos_sensiveis) as string[];
          return (
            <Link key={a.id} href={`/catalog/${a.id}`} className="rounded-xl border border-black/10 bg-white p-5 hover:border-[var(--brand)]/40 transition-colors block">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{a.nome}</h2>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${LGPD_BADGE[a.sensibilidade_lgpd]}`}>
                  LGPD {a.sensibilidade_lgpd}
                </span>
              </div>
              <p className="text-[12.5px] text-[var(--ink-muted)] mt-0.5">
                {a.tipo} · {a.conexao} · {a.linhas.toLocaleString("pt-BR")} linhas
              </p>
              <p className="text-[13px] text-[var(--ink-2)] mt-2 line-clamp-2">{a.descricao}</p>
              <div className="flex items-center gap-4 mt-3 text-[12px] text-[var(--ink-muted)]">
                <span>👤 Owner: <span className="text-[var(--ink-2)]">{a.owner ?? "—"}</span></span>
                <span>🛡 Steward: <span className="text-[var(--ink-2)]">{a.steward ?? "—"}</span></span>
                {sensiveis.length > 0 && <span>🔒 {sensiveis.length} {sensiveis.length === 1 ? "campo sensível" : "campos sensíveis"}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
