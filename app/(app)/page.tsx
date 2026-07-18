import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function Card({ href, emoji, titulo, descricao }: { href: string; emoji: string; titulo: string; descricao: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6 shadow-sm hover:shadow-md hover:border-[var(--brand)]/30 transition-all block"
    >
      <div className="text-2xl">{emoji}</div>
      <div className="mt-3 font-semibold text-[15px]">{titulo}</div>
      <div className="mt-1 text-[13px] text-[var(--ink-2)] leading-relaxed">{descricao}</div>
    </Link>
  );
}

export default async function Home() {
  const user = (await getCurrentUser())!;
  const db = getDb();

  if (user.papel === "cliente") {
    const primeiroNome = user.nome.split(" ")[0];
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold">Olá, {primeiroNome}</h1>
        <p className="mt-2 text-[15px] text-[var(--ink-2)]">Bem-vindo ao seu acompanhamento.</p>
        <div className="mt-2 h-px bg-[var(--grid)]" />
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card href="/materiais" emoji="📚" titulo="Materiais" descricao="Os conteúdos que sua mentora preparou para a sua jornada." />
          <Card href="/assistente" emoji="💬" titulo="Assistente" descricao="Tire dúvidas a qualquer hora, com base no seu acompanhamento." />
          <Card href="/historico" emoji="📝" titulo="Meu Histórico" descricao="A linha do tempo do que vocês já construíram juntos." />
          <Card href="/documentos" emoji="📂" titulo="Documentos" descricao="Seus arquivos e atividades, num lugar só." />
        </div>
      </div>
    );
  }

  const stats = {
    clientes: (db.prepare("SELECT COUNT(*) c FROM clients WHERE workspace_id = 1").get() as { c: number }).c,
    documentos: (db.prepare("SELECT COUNT(*) c FROM documents WHERE workspace_id = 1 AND categoria_id IS NOT NULL").get() as { c: number }).c,
    conversas: (db.prepare("SELECT COUNT(*) c FROM conversations WHERE workspace_id = 1").get() as { c: number }).c,
  };
  const primeiroNome = user.nome.split(" ")[0];

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Olá, {primeiroNome}</h1>
      <p className="mt-2 text-[15px] text-[var(--ink-2)]">
        {stats.clientes} cliente(s) em acompanhamento · {stats.documentos} materiais na biblioteca · {stats.conversas} conversas registradas
      </p>
      <div className="mt-2 h-px bg-[var(--grid)]" />
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card href="/clientes" emoji="🤝" titulo="Clientes" descricao="A jornada de cada cliente: objetivo, observações, arquivos e histórico." />
        <Card href="/biblioteca" emoji="📚" titulo="Biblioteca" descricao="Seus materiais organizados por pastas — a alma do sistema." />
        <Card href="/assistente" emoji="💬" titulo="Assistente" descricao="Converse com a base de conhecimento no contexto de um cliente." />
        <Card href="/configuracoes" emoji="⚙️" titulo="Configurações" descricao="Sua metodologia — o que fundamenta as respostas do assistente." />
      </div>
    </div>
  );
}
