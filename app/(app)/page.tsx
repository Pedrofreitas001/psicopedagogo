import Link from "next/link";
import { countParticipants, countActiveCases, countConversations, listCasesByParticipant } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

function StatCard({
  icon,
  label,
  valor,
  accent,
  href,
}: {
  icon: string;
  label: string;
  valor: number;
  accent: "brand" | "leaf" | "tint";
  href?: string;
}) {
  const cores = {
    brand: { borda: "border-[var(--brand-container)]", fundo: "bg-[var(--brand)]/10", texto: "text-[var(--brand)]" },
    leaf: { borda: "border-[var(--leaf)]", fundo: "bg-[var(--leaf)]/10", texto: "text-[var(--leaf)]" },
    tint: { borda: "border-[var(--brand-deep)]", fundo: "bg-[var(--brand-deep)]/10", texto: "text-[var(--brand-deep)]" },
  }[accent];
  const conteudo = (
    <>
      <span className={`inline-flex p-2 rounded-lg ${cores.fundo} ${cores.texto}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <p className="mt-4 text-[13px] font-semibold tracking-wide text-[var(--ink-2)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--ink-1)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{valor}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`card rounded-xl p-6 border-t-2 ${cores.borda} block hover:-translate-y-0.5 transition-transform`}>
        {conteudo}
      </Link>
    );
  }
  return <div className={`card rounded-xl p-6 border-t-2 ${cores.borda}`}>{conteudo}</div>;
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

  if (user.papel === "participante") {
    const primeiroNome = user.nome.split(" ")[0];
    const casos = user.participantId ? await listCasesByParticipant(user.participantId) : [];
    const ativos = casos.filter((c) => c.status === "ativo").length;
    return (
      <div className="max-w-3xl">
        <h1 className="text-[28px] font-bold text-[var(--brand)]">Olá, {primeiroNome}</h1>
        <p className="mt-1 text-[15px] text-[var(--ink-2)]">
          {ativos} caso(s) ativo(s) em análise · {casos.length} caso(s) no total.
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card href="/casos" icon="cases" titulo="Meus Casos" descricao="Os casos clínicos que você está analisando na mentoria." />
          <Card href="/assistente" icon="psychology" titulo="Assistente" descricao="Converse com o mentor clínico sobre um caso ou uma dúvida geral." />
          <Card href="/materiais" icon="auto_stories" titulo="Materiais" descricao="Os conteúdos que a mentora preparou para a formação." />
        </div>
      </div>
    );
  }

  const [participantes, casosAtivos, conversas] = await Promise.all([countParticipants(), countActiveCases(), countConversations()]);
  const primeiroNome = user.nome.split(" ")[0];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-[28px] font-bold text-[var(--brand)]">Olá, {primeiroNome}</h1>
        <p className="mt-1 text-[15px] text-[var(--ink-2)]">Visão geral da mentoria.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard icon="group" label="Mentores na mentoria" valor={participantes} accent="leaf" href="/participantes" />
        <StatCard icon="cases" label="Casos clínicos ativos" valor={casosAtivos} accent="brand" />
        <StatCard icon="forum" label="Conversas registradas" valor={conversas} accent="tint" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Card href="/participantes" icon="group" titulo="Mentores" descricao="A evolução de cada mentora: estágio, casos clínicos e hipóteses." />
        <Card href="/biblioteca" icon="auto_stories" titulo="Biblioteca" descricao="Seus materiais organizados por pastas — a alma do sistema." />
        <Card href="/assistente" icon="psychology" titulo="Assistente" descricao="Converse com o agente no contexto de um caso clínico." />
        <Card href="/configuracoes" icon="settings" titulo="Configurações" descricao="Sua metodologia, o escopo do assistente e o modelo de IA." />
      </div>
    </div>
  );
}
