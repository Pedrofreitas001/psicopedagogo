"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "Visão geral", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/assistant", label: "Assistente", icon: "M8 10h8M8 14h5M21 12a9 9 0 11-4.6-7.9L21 3l-.9 4.6A8.96 8.96 0 0121 12z" },
  { href: "/agents", label: "Agentes", icon: "M12 2v3M8 21v-2a4 4 0 014-4 4 4 0 014 4v2M12 13a4 4 0 100-8 4 4 0 000 8zM4 9h2M18 9h2" },
  { href: "/connections", label: "Conexões", icon: "M9 12h6M7 8l-4 4 4 4M17 8l4 4-4 4" },
  { href: "/catalog", label: "Data Catalog", icon: "M4 6c0-1.5 3.6-3 8-3s8 1.5 8 3-3.6 3-8 3-8-1.5-8-3zM4 6v12c0 1.5 3.6 3 8 3s8-1.5 8-3V6M4 12c0 1.5 3.6 3 8 3s8-1.5 8-3" },
  { href: "/queries", label: "Queries", icon: "M8 9l-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" },
  { href: "/dashboards", label: "Dashboards", icon: "M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z" },
  { href: "/audit", label: "Auditoria", icon: "M9 12l2 2 4-5M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" },
];

const ROLE_LABEL: Record<string, string> = { admin: "Admin", steward: "Steward", viewer: "Viewer" };

export default function Sidebar({
  users,
  currentUserId,
  workspaceName,
  plano,
}: {
  users: { id: number; nome: string; papel: string }[];
  currentUserId: number;
  workspaceName: string;
  plano: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const current = users.find((u) => u.id === currentUserId) ?? users[0];

  async function switchUser(uid: string) {
    await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid }) });
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 border-r border-black/10 bg-white flex flex-col">
      <div className="px-5 py-5 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[var(--brand)] text-white grid place-items-center font-bold text-sm">GH</div>
          <div>
            <div className="font-semibold text-[15px] leading-tight">Governance Hub</div>
            <div className="text-xs text-[var(--ink-muted)]">Dados & Agentes de IA</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${
                active ? "bg-[var(--brand)]/8 text-[var(--brand)] font-medium" : "text-[var(--ink-2)] hover:bg-black/4"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-black/5 space-y-2">
        <div className="text-xs text-[var(--ink-muted)]">
          Workspace
          <div className="text-[13px] text-[var(--ink-1)] font-medium">{workspaceName}</div>
          <span className="inline-block mt-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium capitalize">
            plano {plano}
          </span>
        </div>
        <label className="block text-xs text-[var(--ink-muted)] pt-1">
          Usuário atual (demo de RBAC)
          <select
            className="mt-1 w-full rounded-md border border-black/10 bg-white px-2 py-1.5 text-[13px] text-[var(--ink-1)]"
            value={current.id}
            onChange={(e) => switchUser(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} · {ROLE_LABEL[u.papel]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  );
}
