import Link from "next/link";
import { countClients, countLibraryDocuments, countConversations } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

function StatCard({ icon, label, valor, accent }: { icon: string; label: string; valor: number; accent: "brand" | "leaf" | "tint" }) {
  const cores = {
    brand: { borda: "border-[var(--brand-container)]", fundo: "bg-[var(--brand)]/10", texto: "text-[var(--brand)]" },
    leaf: { borda: "border-[var(--leaf)]", fundo: "bg-[var(--leaf)]/10", texto: "text-[var(--leaf)]" },
    tint: { borda: "border-[var(--brand-deep)]", fundo: "bg-[var(--brand-deep)]/10", texto: "text-[var(--brand-deep)]" },
  }[accent];
  return (
    <div className={`card rounded-xl p-6 border-t-2 ${cores.borda}`}>
      <span className={`inline-flex p-2 rounded-lg ${cores.fundo} ${cores.texto}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <p className="mt-4 text-[13px] font-semibold tracking-wide text-[var(--ink-2)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--ink-1)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{valor}</p>
    </div>
  );
}

function Card({ href, icon, titulo, descricao }: { href: string; icon: string; titulo: string; descricao: string }) {
  return (
    <Link href={href} className="card rounded-xl p-6 block group">
      <span className="inline-flex p-2 rounded-lg bg-[var(--brand)]/8 text-[var(--brand)]">
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <div className="mt-3 font-semibold text-[15px] group-hover:text-[var(--brand)] transition-colors">{titulo}</div>
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
        <h1 className="text-[28px] font-bold text-[var(--brand)]">Olá, {primeiroNome}</h1>
        <p className="mt-1 text-[15px] text-[var(--ink-2)]">Bem-vindo ao seu acompanhamento.</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card href="/materiais" icon="auto_stories" titulo="Materiais" descricao="Os conteúdos que sua mentora preparou para a sua jornada." />
          <Card href="/assistente" icon="psychology" titulo="Assistente" descricao="Tire dúvidas a qualquer hora, com base no seu acompanhamento." />
          <Card href="/historico" icon="timeline" titulo="Meu Histórico" descricao="A linha do tempo do que vocês já construíram juntos." />
          <Card href="/documentos" icon="description" titulo="Documentos" descricao="Seus arquivos e atividades, num lugar só." />
        </div>
      </div>
    );
  }

  const [clientes, documentos, conversas] = await Promise.all([countClients(), countLibraryDocuments(), countConversations()]);
  const primeiroNome = user.nome.split(" ")[0];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-[28px] font-bold text-[var(--brand)]">Olá, {primeiroNome}</h1>
        <p className="mt-1 text-[15px] text-[var(--ink-2)]">Visão geral do acompanhamento.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard icon="group" label="Clientes em acompanhamento" valor={clientes} accent="leaf" />
        <StatCard icon="auto_stories" label="Materiais na biblioteca" valor={documentos} accent="brand" />
        <StatCard icon="forum" label="Conversas registradas" valor={conversas} accent="tint" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Card href="/clientes" icon="group" titulo="Clientes" descricao="A jornada de cada cliente: objetivo, prontuário, protocolos e histórico." />
        <Card href="/biblioteca" icon="auto_stories" titulo="Biblioteca" descricao="Seus materiais organizados por pastas — a alma do sistema." />
        <Card href="/assistente" icon="psychology" titulo="Assistente" descricao="Converse com a base de conhecimento no contexto de um cliente." />
        <Card href="/configuracoes" icon="settings" titulo="Configurações" descricao="Sua metodologia, o escopo do assistente e o modelo de IA." />
      </div>
    </div>
  );
}
