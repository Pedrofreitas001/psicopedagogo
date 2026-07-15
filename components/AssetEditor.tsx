"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CAMPOS_PII = ["cliente_email", "cliente_cpf", "requester_email", "cliente_nome", "telefone"];

export default function AssetEditor({
  asset,
  users,
}: {
  asset: {
    id: number;
    descricao: string;
    area: string;
    sensibilidade_lgpd: string;
    campos_sensiveis: string[];
    owner_id: number | null;
    steward_id: number | null;
  };
  users: { id: number; nome: string; papel: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...asset });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/catalog/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Ativo atualizado — mudança registrada na auditoria." } : { ok: false, text: data.error ?? "Erro." });
    if (res.ok) router.refresh();
  }

  const input = "w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm";

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold">Governança do ativo</h3>
      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">Descrição</span>
        <textarea rows={2} className={`${input} mt-1`} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="text-[var(--ink-2)]">Área</span>
          <input className={`${input} mt-1`} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="text-[var(--ink-2)]">Sensibilidade LGPD</span>
          <select className={`${input} mt-1`} value={form.sensibilidade_lgpd} onChange={(e) => setForm({ ...form, sensibilidade_lgpd: e.target.value })}>
            <option value="baixa">baixa</option>
            <option value="media">média</option>
            <option value="alta">alta</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-[var(--ink-2)]">Owner (dono do dado)</span>
          <select className={`${input} mt-1`} value={form.owner_id ?? ""} onChange={(e) => setForm({ ...form, owner_id: Number(e.target.value) || null })}>
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-[var(--ink-2)]">Steward (curador)</span>
          <select className={`${input} mt-1`} value={form.steward_id ?? ""} onChange={(e) => setForm({ ...form, steward_id: Number(e.target.value) || null })}>
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="text-sm">
        <span className="text-[var(--ink-2)]">Campos sensíveis (mascarados por padrão nas respostas de agentes)</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {CAMPOS_PII.map((campo) => {
            const on = form.campos_sensiveis.includes(campo);
            return (
              <button
                key={campo}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    campos_sensiveis: on ? form.campos_sensiveis.filter((c) => c !== campo) : [...form.campos_sensiveis, campo],
                  })
                }
                className={`rounded-full px-3 py-1 text-[12px] border font-mono ${
                  on ? "border-red-300 bg-red-50 text-red-700" : "border-black/12 text-[var(--ink-muted)] hover:bg-black/4"
                }`}
              >
                {on ? "🔒 " : ""}{campo}
              </button>
            );
          })}
        </div>
      </div>
      {msg && (
        <p className={`text-sm rounded-lg px-3 py-2 border ${msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200"}`}>
          {msg.text}
        </p>
      )}
      <button onClick={save} disabled={saving} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
        {saving ? "Salvando…" : "Salvar governança"}
      </button>
    </div>
  );
}
