"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_CLIENTE = [
  { href: "/", label: "Início", icon: "dashboard" },
  { href: "/materiais", label: "Materiais", icon: "auto_stories" },
  { href: "/assistente", label: "Assistente", icon: "psychology" },
  { href: "/historico", label: "Meu Histórico", icon: "timeline" },
  { href: "/documentos", label: "Documentos", icon: "description" },
];

const NAV_MENTORA = [
  { href: "/", label: "Início", icon: "dashboard" },
  { href: "/clientes", label: "Clientes", icon: "group" },
  { href: "/biblioteca", label: "Biblioteca", icon: "auto_stories" },
  { href: "/assistente", label: "Assistente", icon: "psychology" },
  { href: "/configuracoes", label: "Configurações", icon: "settings" },
];

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
  const nav = currentUserPapel === "mentora" ? NAV_MENTORA : NAV_CLIENTE;

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
    <aside className="w-64 shrink-0 sticky top-0 h-screen bg-[var(--surface-container)] border-r border-[var(--grid)] flex flex-col py-6 z-40">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--brand)] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined fill-icon text-[22px]">psychology</span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[15px] leading-tight text-[var(--brand)] truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {workspaceName}
            </div>
            <div className="text-[12px] text-[var(--ink-2)]">Acompanhamento psicopedagógico</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[13.5px] tracking-wide transition-all ${
                active
                  ? "text-[var(--brand)] font-bold border-r-4 border-[var(--brand)] bg-[var(--brand)]/5 rounded-r-none"
                  : "text-[var(--ink-2)] font-medium hover:bg-[var(--leaf-container)]/25"
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${active ? "fill-icon" : ""}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pt-5 mt-auto border-t border-[var(--grid)] space-y-2">
        {authMode ? (
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-[var(--leaf-container)] text-[var(--leaf)] grid place-items-center text-[13px] font-bold shrink-0">
              {(current?.nome ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{current?.nome}</div>
              <div className="text-[11px] text-[var(--ink-muted)] capitalize">{currentUserPapel}</div>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="w-8 h-8 grid place-items-center rounded-full text-[var(--ink-muted)] hover:bg-black/5 hover:text-red-600 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        ) : (
          <label className="block text-xs text-[var(--ink-muted)]">
            Entrar como (demo)
            <select
              className="mt-1 w-full rounded-md border border-[var(--grid)] bg-white px-2 py-1.5 text-[13px] text-[var(--ink-1)]"
              value={current.id}
              onChange={(e) => switchUser(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} · {u.papel === "mentora" ? "Mentora" : "Cliente"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </aside>
  );
}
