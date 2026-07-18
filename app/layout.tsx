import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Espaço Aprender — Acompanhamento Psicopedagógico",
  description: "Plataforma de acompanhamento psicopedagógico: biblioteca, jornada do cliente e assistente de estudos.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
