"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_CLIENTE = [
  { href: "/", label: "Início", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/materiais", label: "Materiais", icon: "M4 19V5a2 2 0 012-2h13v18H6a2 2 0 01-2-2zm0 0a2 2 0 012-2h13" },
  { href: "/assistente", label: "Assistente", icon: "M8 10h8M8 14h5M21 12a9 9 0 11-4.6-7.9L21 3l-.9 4.6A8.96 8.96 0 0121 12z" },
  { href: "/historico", label: "Meu Histórico", icon: "M12 8v4l3 3M21 12a9 9 0 11-9-9 9 9 0 019 9z" },
  { href: "/documentos", label: "Documentos", icon: "M13 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V10zM13 3v7h7" },
];

const NAV_MENTORA = [
  { href: "/", label: "Início", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/clientes", label: "Clientes", icon: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8zM21 21v-2a4 4 0 00-3-3.9M15 3.1a4 4 0 010 7.8" },
  { href: "/biblioteca", label: "Biblioteca", icon: "M4 19V5a2 2 0 012-2h13v18H6a2 2 0 01-2-2zm0 0a2 2 0 012-2h13" },
  { href: "/assistente", label: "Assistente", icon: "M8 10h8M8 14h5M21 12a9 9 0 11-4.6-7.9L21 3l-.9 4.6A8.96 8.96 0 0121 12z" },
  { href: "/configuracoes", label: "Configurações", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" },
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
    <aside className="w-60 shrink-0 border-r border-black/8 bg-[var(--surface-1)] flex flex-col">
      <div className="px-5 py-5 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-[var(--brand)] text-white grid place-items-center">🌱</div>
          <div>
            <div className="font-semibold text-[15px] leading-tight">{workspaceName}</div>
            <div className="text-xs text-[var(--ink-muted)]">Acompanhamento psicopedagógico</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                active ? "bg-[var(--brand)]/10 text-[var(--brand-deep)] font-medium" : "text-[var(--ink-2)] hover:bg-black/4"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-black/5 space-y-2">
        {authMode ? (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[var(--brand)]/12 text-[var(--brand-deep)] grid place-items-center text-[13px] font-semibold shrink-0">
              {(current?.nome ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{current?.nome}</div>
              <div className="text-[11px] text-[var(--ink-muted)] capitalize">{currentUserPapel}</div>
            </div>
            <button onClick={logout} title="Sair" className="text-[12px] text-[var(--ink-muted)] hover:text-red-600 shrink-0">
              Sair
            </button>
          </div>
        ) : (
          <label className="block text-xs text-[var(--ink-muted)]">
            Entrar como (demo)
            <select
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-2 py-1.5 text-[13px] text-[var(--ink-1)]"
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
