import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Governance Hub — Dados & Agentes de IA",
  description: "HUB de governança de dados e agentes de IA (MVP)",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
