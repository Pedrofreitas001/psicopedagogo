"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton({ connectionId }: { connectionId: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function sync() {
    setState("running");
    setErr("");
    const res = await fetch(`/api/connections/${connectionId}/sync`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Falha na sincronização");
      setState("error");
    } else {
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    }
    router.refresh();
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        onClick={sync}
        disabled={state === "running"}
        className="rounded-lg bg-[var(--brand)] text-white px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-50"
      >
        {state === "running" ? "Sincronizando…" : state === "done" ? "✓ Sincronizado" : "Sincronizar"}
      </button>
      {state === "error" && <span className="text-[11.5px] text-red-600 max-w-56 text-right">{err}</span>}
    </span>
  );
}

export function TestButton({ connectionId }: { connectionId: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function test() {
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/connections/${connectionId}/test`, { method: "POST" });
    const data = await res.json();
    setMsg({ ok: !!data.ok, text: data.message ?? data.error ?? "Erro" });
    setLoading(false);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={test} disabled={loading} className="rounded-lg border border-black/12 px-3 py-1.5 text-[13px] hover:bg-black/4 disabled:opacity-50">
        {loading ? "Testando…" : "Testar"}
      </button>
      {msg && <span className={`text-[12px] ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
    </span>
  );
}

export function DeleteConnectionButton({ connectionId, nome }: { connectionId: number; nome: string }) {
  const router = useRouter();

  async function remove() {
    if (!window.confirm(`Excluir a conexão “${nome}”? Os dados sincronizados e os ativos do catálogo serão removidos.`)) return;
    const res = await fetch(`/api/connections/${connectionId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Erro ao excluir.");
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={remove} className="text-[12.5px] text-red-500 hover:underline">
      excluir
    </button>
  );
}

export function CredentialReveal({ credentialId, tipo }: { credentialId: number; tipo: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reveal() {
    setError("");
    const res = await fetch(`/api/credentials/${credentialId}/access`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Acesso negado");
      return;
    }
    setPreview(data.preview);
  }

  return (
    <div className="text-[12.5px]">
      <span className="text-[var(--ink-muted)]">Credencial ({tipo}): </span>
      {preview ? (
        <code className="rounded bg-black/5 px-1.5 py-0.5">{preview}</code>
      ) : (
        <button onClick={reveal} className="text-[var(--brand)] underline underline-offset-2">
          ver (acesso auditado)
        </button>
      )}
      {error && <span className="text-red-600 ml-2">{error}</span>}
    </div>
  );
}
