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
      <main className="flex-1 min-w-0 px-8 py-8 max-w-[1100px]">{children}</main>
    </div>
  );
}
