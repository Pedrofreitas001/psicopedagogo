"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_PARTICIPANTE = [
  { href: "/", label: "Início", icon: "dashboard" },
  { href: "/casos", label: "Meus Casos", icon: "cases" },
  { href: "/assistente", label: "Assistente", icon: "psychology" },
  { href: "/materiais", label: "Materiais", icon: "auto_stories" },
];

const NAV_MENTORA = [
  { href: "/", label: "Início", icon: "dashboard" },
  { href: "/participantes", label: "Mentores", icon: "group" },
  { href: "/biblioteca", label: "Biblioteca", icon: "auto_stories" },
  { href: "/assistente", label: "Assistente", icon: "psychology" },
  { href: "/configuracoes", label: "Configurações", icon: "settings" },
];

const ROTULO_PAPEL: Record<string, string> = { mentora: "Mentora", participante: "Mentora" };
const CHAVE_COLAPSO = "ea_sidebar_colapsada";

export default function Sidebar({
  users,
  currentUserId,
  currentUserPapel,
  workspaceName,
  authMode,
}: {
  users: { id: number; nome: string; papel: string }[];
  currentUserId: number;
  currentUserPapel: string;
  workspaceName: string;
  authMode: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const current = users.find((u) => u.id === currentUserId) ?? users[0];
  const nav = currentUserPapel === "mentora" ? NAV_MENTORA : NAV_PARTICIPANTE;
  const [colapsada, setColapsada] = useState(false);
  const [abertaMobile, setAbertaMobile] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CHAVE_COLAPSO) === "1") setColapsada(true);
  }, []);

  useEffect(() => {
    setAbertaMobile(false);
  }, [pathname]);

  function alternarColapso() {
    setColapsada((v) => {
      localStorage.setItem(CHAVE_COLAPSO, !v ? "1" : "0");
      return !v;
    });
  }

  async function switchUser(uid: string) {
    await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid }) });
    router.push("/");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setAbertaMobile(true)}
        title="Abrir menu"
        className="md:hidden fixed top-3.5 left-4 z-30 w-9 h-9 rounded-lg bg-[var(--surface-1)] border border-[var(--grid)] shadow-sm grid place-items-center text-[var(--ink-2)] text-[18px] leading-none"
      >
        ☰
      </button>
      {abertaMobile && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setAbertaMobile(false)} />
      )}
      <aside
        className={`${colapsada ? "md:w-[76px]" : "md:w-64"} ${
          abertaMobile ? "translate-x-0" : "-translate-x-full"
        } w-64 fixed inset-y-0 left-0 md:translate-x-0 md:sticky md:top-0 shrink-0 h-screen bg-[var(--surface-container)] border-r border-[var(--grid)] flex flex-col py-6 z-50 transition-[width,transform] duration-200 ease-in-out`}
      >
        <button
          onClick={() => setAbertaMobile(false)}
          title="Fechar menu"
          className="md:hidden absolute right-4 top-4 w-8 h-8 rounded-full grid place-items-center text-[var(--ink-muted)] hover:bg-black/5 text-[16px] leading-none"
        >
          ✕
        </button>
        <button
          onClick={alternarColapso}
          title={colapsada ? "Expandir menu" : "Recolher menu"}
          className="hidden md:grid absolute -right-3 top-8 w-6 h-6 rounded-full bg-[var(--surface-1)] border border-[var(--grid)] shadow-sm place-items-center text-[var(--ink-muted)] hover:text-[var(--brand)] hover:border-[var(--brand)] z-10"
        >
          <span className={`material-symbols-outlined text-[15px] transition-transform duration-200 ${colapsada ? "" : "rotate-180"}`}>arrow_back</span>
        </button>

      <div className={`mb-8 ${colapsada ? "px-3" : "px-6"}`}>
        <div className={`flex items-center gap-3 ${colapsada ? "justify-center" : ""}`}>
          <div className="w-10 h-10 rounded-lg bg-[var(--brand)] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined fill-icon text-[22px]">psychology</span>
          </div>
          {!colapsada && (
            <div className="min-w-0">
              <div className="font-bold text-[15px] leading-tight text-[var(--brand)] truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {workspaceName}
              </div>
              <div className="text-[12px] text-[var(--ink-2)]">Mentoria de raciocínio clínico</div>
            </div>
          )}
        </div>
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar ${colapsada ? "px-2" : "px-3"}`}>
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={colapsada ? item.label : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[13.5px] tracking-wide transition-all ${colapsada ? "justify-center px-0" : ""} ${
                active
                  ? "text-[var(--brand)] font-bold border-r-4 border-[var(--brand)] bg-[var(--brand)]/5 rounded-r-none"
                  : "text-[var(--ink-2)] font-medium hover:bg-[var(--leaf-container)]/25"
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] shrink-0 ${active ? "fill-icon" : ""}`}>{item.icon}</span>
              {!colapsada && item.label}
            </Link>
          );
        })}
      </nav>

      <div className={`pt-5 mt-auto border-t border-[var(--grid)] space-y-2 ${colapsada ? "px-2" : "px-4"}`}>
        {authMode ? (
          <div className={`flex items-center gap-2.5 ${colapsada ? "justify-center" : ""}`}>
            <div className="h-9 w-9 rounded-full bg-[var(--leaf-container)] text-[var(--leaf)] grid place-items-center text-[13px] font-bold shrink-0">
              {(current?.nome ?? "?").slice(0, 1).toUpperCase()}
            </div>
            {!colapsada && (
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate">{current?.nome}</div>
                <div className="text-[11px] text-[var(--ink-muted)]">{ROTULO_PAPEL[currentUserPapel] ?? currentUserPapel}</div>
              </div>
            )}
            {!colapsada && (
              <button
                onClick={logout}
                title="Sair"
                className="w-8 h-8 grid place-items-center rounded-full text-[var(--ink-muted)] hover:bg-black/5 hover:text-red-600 shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            )}
          </div>
        ) : colapsada ? null : (
          <label className="block text-xs text-[var(--ink-muted)]">
            Entrar como (demo)
            <select
              className="mt-1 w-full rounded-md border border-[var(--grid)] bg-white px-2 py-1.5 text-[13px] text-[var(--ink-1)]"
              value={current.id}
              onChange={(e) => switchUser(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} · {u.papel === "mentora" ? "Mentora (equipe)" : "Mentorada"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      </aside>
    </>
  );
}
