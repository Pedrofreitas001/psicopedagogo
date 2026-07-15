import Link from "next/link";
import ConnectionForm from "@/components/ConnectionForm";
import { CONNECTOR_FIELDS } from "@/lib/connectors";

export default function NewConnectionPage() {
  return (
    <div className="space-y-6">
      <header>
        <Link href="/connections" className="text-[13px] text-[var(--brand)] hover:underline">← Conexões</Link>
        <h1 className="text-2xl font-semibold mt-1">Nova conexão real</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1 max-w-2xl">
          Informe as credenciais da sua conta. O sistema testa contra a API real antes de salvar, guarda o segredo no Vault e,
          após a sincronização, os dados aparecem no Data Catalog e ficam disponíveis para os agentes.
        </p>
      </header>
      <ConnectionForm connectors={CONNECTOR_FIELDS} />
      <div className="rounded-xl border border-dashed border-black/15 p-4 max-w-2xl text-[12.5px] text-[var(--ink-muted)] space-y-1">
        <p><strong>VTEX:</strong> gere o par AppKey/AppToken no Admin → Configurações da conta → Chaves de aplicação (perfil com acesso a OMS).</p>
        <p><strong>Zendesk:</strong> prefira OAuth 2.0 (Admin Center → Apps e integrações → APIs → OAuth). API tokens legados estão sendo descontinuados.</p>
        <p><strong>Power BI:</strong> app registration no Entra ID + client secret; adicione o service principal como membro do workspace.</p>
      </div>
    </div>
  );
}
