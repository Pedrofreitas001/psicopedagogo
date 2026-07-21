"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Settings = {
  usaBiblioteca: boolean;
  usaMetodologia: boolean;
  usaHistorico: boolean;
  usaProntuario: boolean;
  instrucoesExtra: string;
  tom: "acolhedor" | "formal" | "direto";
};

const TOGGLES: { key: keyof Pick<Settings, "usaBiblioteca" | "usaMetodologia" | "usaHistorico" | "usaProntuario">; label: string; descricao: string }[] = [
  { key: "usaMetodologia", label: "Metodologia", descricao: "As notas cadastradas aqui em Configurações." },
  { key: "usaBiblioteca", label: "Biblioteca", descricao: "Documentos publicados e marcados como disponíveis." },
  { key: "usaHistorico", label: "Histórico", descricao: "Objetivo, observações e linha do tempo do cliente." },
  { key: "usaProntuario", label: "Prontuário", descricao: "Notas de sessão datadas de cada cliente." },
];

type TesteResultado = { ok: boolean; modelo?: string; resposta?: string; error?: string };

export default function AgentSettingsForm({ inicial }: { inicial: Settings }) {
  const router = useRouter();
  const [v, setV] = useState<Settings>(inicial);
  const [loading, setLoading] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<TesteResultado | null>(null);

  async function salvar() {
    setLoading(true);
    setSalvo(false);
    await fetch("/api/agente", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    setLoading(false);
    setSalvo(true);
    router.refresh();
  }

  async function testarConexao() {
    setTestando(true);
    setTeste(null);
    const res = await fetch("/api/agente/testar", { method: "POST" });
    const data = (await res.json().catch(() => ({ ok: false, error: "Falha ao chamar o teste." }))) as TesteResultado;
    setTeste(data);
    setTestando(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">O que o assistente acessa</p>
        <div className="grid grid-cols-2 gap-3">
          {TOGGLES.map((t) => (
            <label key={t.key} className="flex items-start gap-2.5 rounded-xl border border-black/8 bg-white p-3 cursor-pointer">
              <input type="checkbox" checked={v[t.key]} onChange={(e) => setV({ ...v, [t.key]: e.target.checked })} className="mt-0.5" />
              <span>
                <span className="block text-[13px] font-medium">{t.label}</span>
                <span className="block text-[11.5px] text-[var(--ink-muted)]">{t.descricao}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">Como ele produz as respostas</p>
        <label className="text-sm block mb-3">
          <span className="text-[var(--ink-2)]">Tom</span>
          <select
            value={v.tom}
            onChange={(e) => setV({ ...v, tom: e.target.value as Settings["tom"] })}
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm"
          >
            <option value="acolhedor">Acolhedor — encorajador e simples</option>
            <option value="formal">Formal — profissional e técnico</option>
            <option value="direto">Direto — objetivo, sem rodeios</option>
          </select>
        </label>
        <label className="text-sm block">
          <span className="text-[var(--ink-2)]">Instruções adicionais (opcional)</span>
          <textarea
            rows={3}
            value={v.instrucoesExtra}
            onChange={(e) => setV({ ...v, instrucoesExtra: e.target.value })}
            placeholder="Ex.: sempre sugira uma atividade lúdica ao final; nunca use termos técnicos com o cliente…"
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm"
          />
        </label>
        <p className="mt-1.5 text-[11.5px] text-[var(--ink-muted)]">Válido quando o assistente está com IA ativa (OpenRouter). No modo offline, apenas as fontes acima são usadas.</p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={loading} className="rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          {loading ? "Salvando…" : "Salvar escopo"}
        </button>
        {salvo && <span className="text-[12.5px] text-emerald-700">Salvo ✓</span>}
      </div>

      <div className="pt-3 border-t border-black/6">
        <button onClick={testarConexao} disabled={testando} className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/4 disabled:opacity-50">
          {testando ? "Testando…" : "🔌 Testar conexão com a IA"}
        </button>
        {teste && (
          <p className={`mt-2 text-[12.5px] rounded-lg px-3 py-2 border ${teste.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}>
            {teste.ok
              ? `✅ Conectado — modelo ${teste.modelo} respondeu: "${teste.resposta}"`
              : `❌ Falhou (modelo ${teste.modelo ?? "?"}): ${teste.error}`}
          </p>
        )}
      </div>
    </div>
  );
}
