import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comunicar & Aprender — Mentoria de Raciocínio Clínico",
  description: "Mentoria de raciocínio clínico em compreensão leitora: protocolo, hipóteses e um mentor de IA socrático para cada caso.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
