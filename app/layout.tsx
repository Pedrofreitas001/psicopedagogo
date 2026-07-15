import type { Metadata } from "next";
import "./globals.css";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Governance Hub — Dados & Agentes de IA",
  description: "HUB de governança de dados e agentes de IA (MVP)",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const users = db.prepare("SELECT id, nome, papel FROM users WHERE workspace_id = 1 ORDER BY id").all() as {
    id: number;
    nome: string;
    papel: string;
  }[];
  const current = await getCurrentUser();
  const workspace = db.prepare("SELECT nome, plano FROM workspaces WHERE id = 1").get() as { nome: string; plano: string };

  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar users={users} currentUserId={current.id} workspaceName={workspace.nome} plano={workspace.plano} />
          <main className="flex-1 min-w-0 px-8 py-8 max-w-[1200px]">{children}</main>
        </div>
      </body>
    </html>
  );
}
