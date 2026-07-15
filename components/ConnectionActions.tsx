"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton({ connectionId }: { connectionId: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  async function sync() {
    setState("running");
    await fetch(`/api/connections/${connectionId}/sync`, { method: "POST" });
    setState("done");
    router.refresh();
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <button
      onClick={sync}
      disabled={state === "running"}
      className="rounded-lg bg-[var(--brand)] text-white px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-50"
    >
      {state === "running" ? "Sincronizando…" : state === "done" ? "✓ Sincronizado" : "Sincronizar"}
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
