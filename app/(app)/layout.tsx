import { redirect } from "next/navigation";
import { listUsers, getWorkspaceName } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { authEnabled } from "@/lib/supabase-auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const [users, workspaceName] = await Promise.all([listUsers(), getWorkspaceName()]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        users={users}
        currentUserId={current.id}
        currentUserPapel={current.papel}
        workspaceName={workspaceName}
        authMode={authEnabled()}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 bg-[var(--surface-1)] border-b border-[var(--grid)] flex items-center justify-between px-8 sticky top-0 z-30 shadow-sm">
          <span className="font-bold text-[16px] text-[var(--brand)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {workspaceName}
          </span>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[13px] font-semibold leading-tight">{current.nome}</p>
              <p className="text-[11.5px] text-[var(--ink-muted)] capitalize leading-tight">{current.papel}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--leaf-container)] text-[var(--leaf)] grid place-items-center text-[14px] font-bold ring-2 ring-white shadow-sm">
              {current.nome.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 px-10 py-8 max-w-[1200px] w-full">{children}</main>
      </div>
    </div>
  );
}
