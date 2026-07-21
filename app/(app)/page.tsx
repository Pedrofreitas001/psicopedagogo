import Link from "next/link";
import { countClients, countLibraryDocuments, countConversations } from "@/lib/data";
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

  const [clientes, documentos, conversas] = await Promise.all([countClients(), countLibraryDocuments(), countConversations()]);
  const primeiroNome = user.nome.split(" ")[0];

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Olá, {primeiroNome}</h1>
      <p className="mt-2 text-[15px] text-[var(--ink-2)]">
        {clientes} cliente(s) em acompanhamento · {documentos} materiais na biblioteca · {conversas} conversas registradas
      </p>
      <div className="mt-2 h-px bg-[var(--grid)]" />
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card href="/clientes" emoji="🤝" titulo="Clientes" descricao="A jornada de cada cliente: objetivo, observações, arquivos e histórico." />
        <Card href="/biblioteca" emoji="📚" titulo="Biblioteca" descricao="Seus materiais organizados por pastas — a alma do sistema." />
        <Card href="/assistente" emoji="💬" titulo="Assistente" descricao="Converse com a base de conhecimento no contexto de um cliente." />
        <Card href="/configuracoes" emoji="⚙️" titulo="Configurações" descricao="Sua metodologia e o escopo do assistente." />
      </div>
    </div>
  );
}
