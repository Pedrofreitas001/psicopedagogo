import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { authEnabled } from "@/lib/supabase-auth";
import { storageEnabled } from "@/lib/storage";
import MetodologiaForm from "@/components/MetodologiaForm";

export default async function ConfiguracoesPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");
  const db = getDb();
  const notas = db
    .prepare("SELECT id, titulo, conteudo, atualizado_em FROM knowledge WHERE workspace_id = 1 ORDER BY id")
    .all() as { id: number; titulo: string; conteudo: string; atualizado_em: string }[];

  const iaAtiva = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">
          Sua metodologia é a base de tudo: o assistente só responde com o que estiver aqui e na biblioteca.
        </p>
      </div>

      <div className="rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">🧭 Metodologia</h2>
          <MetodologiaForm />
        </div>
        {notas.map((n) => (
          <div key={n.id} className="rounded-xl border border-black/6 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-medium">{n.titulo}</div>
              <MetodologiaForm nota={n} />
            </div>
            <p className="mt-2 text-[13px] text-[var(--ink-2)] leading-relaxed whitespace-pre-wrap">{n.conteudo}</p>
          </div>
        ))}
        {notas.length === 0 && <p className="text-sm text-[var(--ink-muted)]">Cadastre a primeira nota — ela passa a fundamentar o assistente.</p>}
      </div>

      <div className="rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6">
        <h2 className="text-[15px] font-semibold">🔌 Ambiente</h2>
        <ul className="mt-3 space-y-1.5 text-[13px] text-[var(--ink-2)]">
          <li>{authEnabled() ? "✅ Login real (Supabase Auth) ativo" : "🟡 Modo demo — defina SUPABASE_URL e SUPABASE_ANON_KEY para exigir login real"}</li>
          <li>{storageEnabled() ? "✅ Arquivos no Supabase Storage" : "🟡 Arquivos em disco local — defina SUPABASE_SERVICE_ROLE_KEY para usar o Supabase Storage"}</li>
          <li>{iaAtiva ? "✅ Redação das respostas com Claude (ANTHROPIC_API_KEY)" : "🟡 Assistente em modo offline — defina ANTHROPIC_API_KEY para respostas redigidas pelo Claude"}</li>
        </ul>
      </div>
    </div>
  );
}
