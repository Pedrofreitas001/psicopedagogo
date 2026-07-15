import { getDb } from "@/lib/db";
import { SyncButton, CredentialReveal } from "@/components/ConnectionActions";

const TIPO_META: Record<string, { logo: string; cor: string; auth: string }> = {
  vtex: { logo: "V", cor: "bg-pink-600", auth: "AppKey + AppToken (Orders e Catalog API, leitura)" },
  zendesk: { logo: "Z", cor: "bg-emerald-700", auth: "OAuth 2.0 — Tickets API (tokens legados descontinuados)" },
  powerbi: { logo: "P", cor: "bg-amber-500", auth: "Service Principal (Entra ID) — metadados via REST, 200 req/h" },
};

export default function ConnectionsPage() {
  const db = getDb();
  const conns = db.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM data_assets a WHERE a.connection_id = c.id) AS ativos
     FROM connections c WHERE c.workspace_id = 1 ORDER BY c.id`
  ).all() as { id: number; tipo: string; nome: string; status: string; ultima_sincronizacao: string; ativos: number }[];
  const creds = db.prepare("SELECT id, connection_id, tipo FROM credentials").all() as { id: number; connection_id: number; tipo: string }[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Conexões</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Cada conector implementa a interface padrão <code className="text-[12px] bg-black/5 rounded px-1">connect / sync / getMetadata / health</code> e
          é exposto como servidor MCP — o mesmo contrato para agentes internos e clientes MCP externos. Credenciais ficam no Vault (AES-256, acesso auditado).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {conns.map((c) => {
          const meta = TIPO_META[c.tipo];
          const cred = creds.find((cr) => cr.connection_id === c.id);
          return (
            <div key={c.id} className="rounded-xl border border-black/10 bg-white p-5 flex items-center gap-5">
              <div className={`h-12 w-12 rounded-xl ${meta.cor} text-white grid place-items-center text-xl font-bold shrink-0`}>
                {meta.logo}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{c.nome}</h2>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${c.status === "conectado" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    ● {c.status}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--ink-muted)] mt-0.5">{meta.auth}</p>
                <div className="flex items-center gap-4 mt-1.5 text-[12.5px] text-[var(--ink-2)]">
                  <span>{c.ativos} ativos no catálogo</span>
                  <span className="text-[var(--ink-muted)]">última sincronização: {c.ultima_sincronizacao?.slice(0, 16).replace("T", " ") ?? "nunca"}</span>
                </div>
                {cred && <div className="mt-1.5"><CredentialReveal credentialId={cred.id} tipo={cred.tipo} /></div>}
              </div>
              <SyncButton connectionId={c.id} />
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-black/15 p-5 text-sm text-[var(--ink-muted)]">
        Próximos conectores do roadmap: ERP (TOTVS/SAP B1), CRM (Pipedrive/HubSpot) e planilhas — todos sobre a mesma interface Connector/MCP.
      </div>
    </div>
  );
}
