"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch(modo === "login" ? "/api/auth/login" : "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, nome }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? "Erro." });
      return;
    }
    if (data.pendingConfirmation) {
      setMsg({ ok: true, text: data.message });
      setModo("login");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const input = "w-full rounded-lg border border-black/12 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand)]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--page)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="h-10 w-10 rounded-xl bg-[var(--brand)] text-white grid place-items-center font-bold">GH</div>
          <div>
            <div className="font-semibold text-lg leading-tight">Governance Hub</div>
            <div className="text-xs text-[var(--ink-muted)]">Dados & Agentes de IA</div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-black/10 bg-white p-6 space-y-4 shadow-sm">
          <h1 className="font-semibold text-[15px]">{modo === "login" ? "Entrar no workspace" : "Criar conta"}</h1>
          {modo === "signup" && (
            <label className="text-sm block">
              <span className="text-[var(--ink-2)]">Nome</span>
              <input className={`${input} mt-1`} value={nome} onChange={(e) => setNome(e.target.value)} required />
            </label>
          )}
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Email</span>
            <input type="email" className={`${input} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Senha</span>
            <input type="password" className={`${input} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete={modo === "login" ? "current-password" : "new-password"} minLength={modo === "signup" ? 8 : undefined} />
          </label>
          {msg && (
            <p className={`text-[13px] rounded-lg px-3 py-2 border ${msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200"}`}>
              {msg.text}
            </p>
          )}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-[var(--brand)] text-white py-2.5 text-sm font-medium disabled:opacity-50">
            {loading ? "Aguarde…" : modo === "login" ? "Entrar" : "Criar conta"}
          </button>
          <button
            type="button"
            onClick={() => { setModo(modo === "login" ? "signup" : "login"); setMsg(null); }}
            className="w-full text-[13px] text-[var(--brand)] hover:underline"
          >
            {modo === "login" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </form>
        <p className="text-center text-[11.5px] text-[var(--ink-muted)] mt-4">
          Sessão protegida por Supabase Auth · cookies httpOnly · acesso auditado
        </p>
      </div>
    </div>
  );
}
