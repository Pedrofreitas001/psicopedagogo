"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FieldDef = { key: string; label: string; placeholder?: string; options?: string[] };
type ConnectorDef = { label: string; config: FieldDef[]; secret: { key: string; label: string }[] };

export default function ConnectionForm({ connectors }: { connectors: Record<string, ConnectorDef> }) {
  const router = useRouter();
  const tipos = Object.keys(connectors);
  const [tipo, setTipo] = useState(tipos[0]);
  const [nome, setNome] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  const [connId, setConnId] = useState<number | null>(null);

  const def = connectors[tipo];
  const input = "w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]";

  function switchTipo(t: string) {
    setTipo(t);
    setConfig({});
    setSecret({});
    setResult(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setResult(null);
    setSyncMsg("");
    const cfg = { ...config };
    for (const f of def.config) if (f.options && !cfg[f.key]) cfg[f.key] = f.options[0];
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, nome, config: cfg, secret }),
    });
    const data = await res.json();
    if (!res.ok) {
      setState("idle");
      setResult({ ok: false, message: data.error ?? "Erro ao criar conexão." });
      return;
    }
    setState("done");
    setConnId(data.id);
    setResult(data.test);
    router.refresh();
  }

  async function syncNow() {
    if (!connId) return;
    setSyncMsg("Sincronizando…");
    const res = await fetch(`/api/connections/${connId}/sync`, { method: "POST" });
    const data = await res.json();
    setSyncMsg(res.ok ? `✓ ${data.detalhes.join(" · ")} — ativos criados no Data Catalog.` : `Falhou: ${data.error}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-black/10 bg-white p-5 space-y-4 max-w-2xl">
      <div className="flex gap-2">
        {tipos.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTipo(t)}
            className={`rounded-lg px-3.5 py-2 text-sm border transition-colors ${
              tipo === t ? "border-[var(--brand)]/50 bg-[var(--brand)]/8 text-[var(--brand)] font-medium" : "border-black/12 text-[var(--ink-2)] hover:bg-black/4"
            }`}
          >
            {connectors[t].label}
          </button>
        ))}
      </div>

      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">Nome da conexão</span>
        <input className={`${input} mt-1`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`ex.: ${def.label.split(" ")[0]} — Produção`} required />
      </label>

      <div className="grid grid-cols-2 gap-4">
        {def.config.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="text-[var(--ink-2)]">{f.label}</span>
            {f.options ? (
              <select className={`${input} mt-1`} value={config[f.key] ?? f.options[0]} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input className={`${input} mt-1`} value={config[f.key] ?? ""} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} placeholder={f.placeholder} />
            )}
          </label>
        ))}
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-3">
        <p className="text-[12px] text-amber-800">
          🔐 Os segredos abaixo vão direto para o Credential Vault (AES-256) — nunca aparecem em claro nem em logs.
        </p>
        {def.secret.map((f) => (
          <label key={f.key} className="text-sm block">
            <span className="text-[var(--ink-2)]">{f.label}</span>
            <input
              type="password"
              autoComplete="off"
              className={`${input} mt-1 font-mono`}
              value={secret[f.key] ?? ""}
              onChange={(e) => setSecret({ ...secret, [f.key]: e.target.value })}
              required
            />
          </label>
        ))}
      </div>

      {result && (
        <div className={`text-sm rounded-lg px-3 py-2 border ${result.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}>
          {result.ok ? "✓ " : "✗ "}{result.message}
        </div>
      )}
      {syncMsg && <p className="text-sm text-[var(--ink-2)]">{syncMsg}</p>}

      <div className="flex items-center gap-3">
        {state !== "done" ? (
          <button type="submit" disabled={state === "saving"} className="rounded-lg bg-[var(--brand)] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40">
            {state === "saving" ? "Testando credenciais…" : "Conectar e testar"}
          </button>
        ) : (
          <>
            {result?.ok && (
              <button type="button" onClick={syncNow} className="rounded-lg bg-[var(--brand)] text-white px-5 py-2.5 text-sm font-medium">
                Sincronizar dados agora
              </button>
            )}
            <button type="button" onClick={() => router.push("/connections")} className="rounded-lg border border-black/12 px-4 py-2.5 text-sm">
              Voltar às conexões
            </button>
          </>
        )}
      </div>
    </form>
  );
}
