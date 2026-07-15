"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type AgentData = {
  id?: number;
  nome: string;
  objetivo: string;
  prompt_base: string;
  modelo: string;
  ferramentas: string[];
  assets_autorizados: number[];
  pode_exibir_pii: boolean;
  personalidade: { tom?: string; idioma?: string; publico?: string };
  escopo_trabalho: string;
  fora_escopo: string;
  diretrizes: string[];
  restricoes: string[];
};

const MODELOS = ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5"];
const TONS = ["profissional", "amigável", "direto", "técnico"];

/** Compõe o system prompt final a partir de todos os campos — é o que o Agent Runtime envia ao modelo. */
export function composePrompt(a: AgentData): string {
  const p: string[] = [];
  if (a.prompt_base.trim()) p.push(a.prompt_base.trim());
  if (a.objetivo.trim()) p.push(`Objetivo: ${a.objetivo.trim()}`);
  const pers: string[] = [];
  if (a.personalidade.tom) pers.push(`tom ${a.personalidade.tom}`);
  if (a.personalidade.idioma) pers.push(`responda em ${a.personalidade.idioma}`);
  if (a.personalidade.publico) pers.push(`público: ${a.personalidade.publico}`);
  if (pers.length) p.push(`Personalidade: ${pers.join("; ")}.`);
  if (a.escopo_trabalho.trim()) p.push(`Escopo de trabalho: ${a.escopo_trabalho.trim()}`);
  if (a.fora_escopo.trim()) p.push(`Fora do escopo (recuse educadamente): ${a.fora_escopo.trim()}`);
  if (a.diretrizes.length) p.push(`Diretrizes:\n${a.diretrizes.map((d) => `- ${d}`).join("\n")}`);
  if (a.restricoes.length) p.push(`Restrições (invioláveis):\n${a.restricoes.map((r) => `- ${r}`).join("\n")}`);
  p.push(a.pode_exibir_pii ? "Este agente PODE exibir dados pessoais quando pedido." : "NUNCA exiba dados pessoais (email, CPF, telefone) em claro — sempre mascare.");
  return p.join("\n\n");
}

export default function AgentEditor({
  initial,
  tools,
  assets,
}: {
  initial: AgentData | null;
  tools: { id: string; label: string; desc: string }[];
  assets: { id: number; nome: string; conexao: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<AgentData>(
    initial ?? {
      nome: "",
      objetivo: "",
      prompt_base: "",
      modelo: "claude-sonnet-5",
      ferramentas: [],
      assets_autorizados: [],
      pode_exibir_pii: false,
      personalidade: { tom: "profissional", idioma: "pt-BR", publico: "" },
      escopo_trabalho: "",
      fora_escopo: "",
      diretrizes: [],
      restricoes: [],
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  const promptComposto = useMemo(() => composePrompt(form), [form]);

  function toggleTool(id: string) {
    setForm((f) => ({
      ...f,
      ferramentas: f.ferramentas.includes(id) ? f.ferramentas.filter((t) => t !== id) : [...f.ferramentas, id],
    }));
  }
  function toggleAsset(id: number) {
    setForm((f) => ({
      ...f,
      assets_autorizados: f.assets_autorizados.includes(id)
        ? f.assets_autorizados.filter((a) => a !== id)
        : [...f.assets_autorizados, id],
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(form.id ? `/api/agents/${form.id}` : "/api/agents", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao salvar.");
      return;
    }
    router.push("/agents");
    router.refresh();
  }

  async function remove() {
    if (!form.id || !window.confirm(`Excluir o agente “${form.nome}”?`)) return;
    const res = await fetch(`/api/agents/${form.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao excluir.");
      return;
    }
    router.push("/agents");
    router.refresh();
  }

  const input = "w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]";
  const label = "text-[var(--ink-2)]";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Identidade */}
      <div className="rounded-xl border border-black/10 bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold">Identidade</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            <span className={label}>Nome do agente</span>
            <input className={`${input} mt-1`} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex.: Agente de Logística" />
          </label>
          <label className="text-sm">
            <span className={label}>Modelo</span>
            <select className={`${input} mt-1`} value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })}>
              {MODELOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-sm block">
          <span className={label}>Objetivo (uma frase)</span>
          <input className={`${input} mt-1`} value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="O que este agente resolve" />
        </label>
        <label className="text-sm block">
          <span className={label}>Prompt base (identidade e contexto)</span>
          <textarea rows={3} className={`${input} mt-1`} value={form.prompt_base} onChange={(e) => setForm({ ...form, prompt_base: e.target.value })} placeholder="Você é um analista de... da empresa..." />
        </label>
      </div>

      {/* Personalidade */}
      <div className="rounded-xl border border-black/10 bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold">Personalidade</h3>
        <div className="grid grid-cols-3 gap-4">
          <label className="text-sm">
            <span className={label}>Tom de voz</span>
            <select className={`${input} mt-1`} value={form.personalidade.tom ?? "profissional"} onChange={(e) => setForm({ ...form, personalidade: { ...form.personalidade, tom: e.target.value } })}>
              {TONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className={label}>Idioma</span>
            <input className={`${input} mt-1`} value={form.personalidade.idioma ?? "pt-BR"} onChange={(e) => setForm({ ...form, personalidade: { ...form.personalidade, idioma: e.target.value } })} />
          </label>
          <label className="text-sm">
            <span className={label}>Público-alvo</span>
            <input className={`${input} mt-1`} value={form.personalidade.publico ?? ""} onChange={(e) => setForm({ ...form, personalidade: { ...form.personalidade, publico: e.target.value } })} placeholder="ex.: diretoria comercial" />
          </label>
        </div>
      </div>

      {/* Escopo de trabalho */}
      <div className="rounded-xl border border-black/10 bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold">Escopo de trabalho</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            <span className={label}>O que este agente FAZ</span>
            <textarea rows={3} className={`${input} mt-1`} value={form.escopo_trabalho} onChange={(e) => setForm({ ...form, escopo_trabalho: e.target.value })} placeholder="ex.: análises de faturamento, ranking de produtos..." />
          </label>
          <label className="text-sm">
            <span className={label}>O que está FORA do escopo</span>
            <textarea rows={3} className={`${input} mt-1`} value={form.fora_escopo} onChange={(e) => setForm({ ...form, fora_escopo: e.target.value })} placeholder="ex.: não responde sobre RH; não altera dados nas origens..." />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            <span className={label}>Diretrizes (uma por linha)</span>
            <textarea
              rows={4}
              className={`${input} mt-1`}
              value={form.diretrizes.join("\n")}
              onChange={(e) => setForm({ ...form, diretrizes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              placeholder={"Sempre citar o período analisado\nExcluir pedidos cancelados"}
            />
          </label>
          <label className="text-sm">
            <span className={label}>Restrições invioláveis (uma por linha)</span>
            <textarea
              rows={4}
              className={`${input} mt-1`}
              value={form.restricoes.join("\n")}
              onChange={(e) => setForm({ ...form, restricoes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              placeholder={"Nunca exibir CPF em claro\nNão citar concorrentes"}
            />
          </label>
        </div>
      </div>

      {/* Skills */}
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <h3 className="text-sm font-semibold mb-1">Skills / ferramentas MCP autorizadas</h3>
        <p className="text-[12.5px] text-[var(--ink-muted)] mb-3">
          O agente só executa o que estiver marcado aqui — perguntas fora do escopo são recusadas (governança por escopo, não por prompt).
        </p>
        <div className="grid grid-cols-2 gap-2">
          {tools.map((t) => (
            <label
              key={t.id}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                form.ferramentas.includes(t.id) ? "border-[var(--brand)]/50 bg-[var(--brand)]/5" : "border-black/10 hover:bg-black/3"
              }`}
            >
              <input type="checkbox" className="mt-0.5 accent-[var(--brand)]" checked={form.ferramentas.includes(t.id)} onChange={() => toggleTool(t.id)} />
              <span>
                <span className="block text-[13px] font-medium">{t.label}</span>
                <span className="block text-[11.5px] text-[var(--ink-muted)]">{t.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Dados autorizados */}
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <h3 className="text-sm font-semibold mb-3">Ativos de dados autorizados (Data Catalog)</h3>
        <div className="flex flex-wrap gap-2">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAsset(a.id)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] border transition-colors ${
                form.assets_autorizados.includes(a.id)
                  ? "border-[var(--brand)]/50 bg-[var(--brand)]/8 text-[var(--brand)] font-medium"
                  : "border-black/12 text-[var(--ink-2)] hover:bg-black/4"
              }`}
            >
              {a.nome} · {a.conexao}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2.5 mt-4 text-sm cursor-pointer">
          <input type="checkbox" className="accent-[var(--brand)]" checked={form.pode_exibir_pii} onChange={(e) => setForm({ ...form, pode_exibir_pii: e.target.checked })} />
          <span>
            Pode exibir dados pessoais em claro (LGPD)
            <span className="block text-[11.5px] text-[var(--ink-muted)]">Desmarcado, emails e CPFs saem mascarados em toda resposta deste agente.</span>
          </span>
        </label>
      </div>

      {/* Preview do prompt composto */}
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <button onClick={() => setShowPrompt(!showPrompt)} className="text-sm font-semibold flex items-center gap-2 w-full text-left">
          <span className="text-[var(--brand)]">{showPrompt ? "▾" : "▸"}</span>
          Prompt composto (o que o Agent Runtime envia ao modelo)
        </button>
        {showPrompt && (
          <pre className="mt-3 rounded-lg bg-[#0f1117] text-[#d5dbe5] text-[12px] leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap">{promptComposto}</pre>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving || !form.nome.trim()} className="rounded-lg bg-[var(--brand)] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40">
          {saving ? "Salvando…" : form.id ? "Salvar alterações" : "Criar agente"}
        </button>
        {form.id && (
          <button onClick={remove} className="rounded-lg border border-red-200 text-red-600 px-4 py-2.5 text-sm hover:bg-red-50">
            Excluir agente
          </button>
        )}
      </div>
    </div>
  );
}
