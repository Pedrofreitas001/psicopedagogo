import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { authEnabled } from "@/lib/supabase-auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const db = getDb();
  const users = db.prepare("SELECT id, nome, papel FROM users WHERE workspace_id = 1 ORDER BY id").all() as {
    id: number;
    nome: string;
    papel: string;
  }[];
  const workspace = db.prepare("SELECT nome FROM workspaces WHERE id = 1").get() as { nome: string };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        users={users}
        currentUserId={current.id}
        currentUserPapel={current.papel}
        workspaceName={workspace.nome}
        authMode={authEnabled()}
      />
      <main className="flex-1 min-w-0 px-8 py-8 max-w-[1100px]">{children}</main>
    </div>
  );
}
