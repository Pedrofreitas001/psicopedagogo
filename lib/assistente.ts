import Anthropic from "@anthropic-ai/sdk";
import { getDb, logEvent } from "./db";

/**
 * Assistente de Estudos — responde usando exclusivamente:
 *   1. a metodologia cadastrada pela mentora (tabela knowledge);
 *   2. os documentos da biblioteca (texto extraído/informado no upload);
 *   3. o histórico daquele cliente (conversas e linha do tempo).
 *
 * Nunca internet, nunca opinião própria, nunca diagnóstico. Quando a base
 * não sustenta uma resposta, ele diz isso com clareza.
 *
 * Com ANTHROPIC_API_KEY definida, a redação final é feita pelo Claude com um
 * prompt rígido de fundamentação; sem a chave, o assistente compõe a resposta
 * diretamente dos trechos recuperados (modo demo, 100% offline).
 */

export type Fonte = { tipo: "documento" | "metodologia" | "historico"; titulo: string };
export type RespostaAssistente = { resposta: string; fontes: Fonte[]; recusado: boolean };

const STOPWORDS = new Set(
  ("a o e de da do das dos em no na nos nas um uma uns umas para por com sem sob sobre que se sua seu suas seus " +
    "meu minha meus minhas como mais menos muito pouco quando onde quem qual quais isso isto aquilo ele ela eles elas " +
    "eu tu voce voces nos ao aos as os ou mas tambem ja nao sim ser ter estar fazer pode posso tem tenho foi era sao " +
    "esta este esse essa estes esses essas alguma algum coisa tal vez ate depois antes entre").split(" ")
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

type Trecho = { fonte: Fonte; texto: string; score: number };

/** Recupera os trechos da base mais relacionados à pergunta, no escopo do cliente. */
export function recuperarBase(pergunta: string, clientId: number | null): Trecho[] {
  const db = getDb();
  const q = new Set(tokens(pergunta));
  if (q.size === 0) return [];

  const candidatos: { fonte: Fonte; texto: string }[] = [];

  const know = db.prepare("SELECT titulo, conteudo FROM knowledge WHERE workspace_id = 1").all() as { titulo: string; conteudo: string }[];
  for (const k of know) candidatos.push({ fonte: { tipo: "metodologia", titulo: k.titulo }, texto: `${k.titulo}. ${k.conteudo}` });

  // Biblioteca (compartilhada) + arquivos do próprio cliente
  const docs = db
    .prepare(
      "SELECT nome, conteudo FROM documents WHERE workspace_id = 1 AND conteudo != '' AND (categoria_id IS NOT NULL OR client_id = ?)"
    )
    .all(clientId ?? -1) as { nome: string; conteudo: string }[];
  for (const d of docs) candidatos.push({ fonte: { tipo: "documento", titulo: d.nome }, texto: `${d.nome}. ${d.conteudo}` });

  if (clientId) {
    const cli = db
      .prepare("SELECT nome, objetivo, observacoes FROM clients WHERE id = ? AND workspace_id = 1")
      .get(clientId) as { nome: string; objetivo: string; observacoes: string } | undefined;
    if (cli && (cli.objetivo || cli.observacoes)) {
      candidatos.push({
        fonte: { tipo: "historico", titulo: `Acompanhamento de ${cli.nome}` },
        texto: `Objetivo do acompanhamento: ${cli.objetivo}. Observações da mentora: ${cli.observacoes}`,
      });
    }
    const eventos = db
      .prepare("SELECT descricao FROM events WHERE client_id = ? ORDER BY criado_em DESC LIMIT 12")
      .all(clientId) as { descricao: string }[];
    if (eventos.length) {
      candidatos.push({
        fonte: { tipo: "historico", titulo: "Linha do tempo recente" },
        texto: eventos.map((e) => e.descricao).join(" "),
      });
    }
  }

  const trechos: Trecho[] = [];
  for (const c of candidatos) {
    const t = tokens(c.texto);
    if (t.length === 0) continue;
    let hits = 0;
    const vistos = new Set<string>();
    for (const tok of t) {
      if (q.has(tok) && !vistos.has(tok)) {
        vistos.add(tok);
        hits++;
      }
    }
    if (hits === 0) continue;
    trechos.push({ fonte: c.fonte, texto: c.texto, score: hits / Math.sqrt(q.size) });
  }
  trechos.sort((a, b) => b.score - a.score);
  return trechos.slice(0, 4);
}

const RECUSA =
  "Não encontrei, nos materiais e na metodologia cadastrados pela mentora, base suficiente para responder a essa pergunta " +
  "com segurança. Prefiro não arriscar uma resposta sem fundamento. Que tal levar essa dúvida diretamente para a mentora " +
  "no próximo encontro? Ela pode avaliar com calma e, se fizer sentido, incluir um material sobre isso na biblioteca.";

function historicoRecente(clientId: number): { papel: "usuario" | "assistente"; conteudo: string }[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT m.papel, m.conteudo FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.client_id = ? ORDER BY m.id DESC LIMIT 10`
      )
      .all(clientId) as { papel: "usuario" | "assistente"; conteudo: string }[]
  ).reverse();
}

export async function responder(pergunta: string, clientId: number | null, nomeCliente: string): Promise<RespostaAssistente> {
  const trechos = recuperarBase(pergunta, clientId);
  // Sem apoio mínimo na base → recusa transparente (regra do produto)
  if (trechos.length === 0 || trechos[0].score < 0.5) {
    return { resposta: RECUSA, fontes: [], recusado: true };
  }
  const fontes = trechos.map((t) => t.fonte);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const resposta = await redigirComClaude(pergunta, trechos, clientId, nomeCliente);
      return { resposta, fontes, recusado: false };
    } catch {
      // Falha de API não pode derrubar o atendimento: cai no modo offline
    }
  }

  // Modo offline: compõe a resposta diretamente dos trechos recuperados
  const corpo = trechos
    .slice(0, 2)
    .map((t) => resumirTrecho(t.texto))
    .join("\n\n");
  const nomes = fontes.map((f) => `“${f.titulo}”`).join(", ");
  return {
    resposta: `Com base no que a mentora preparou (${nomes}):\n\n${corpo}\n\nSe quiser, posso detalhar algum desses pontos — e qualquer dúvida clínica fica para a mentora.`,
    fontes,
    recusado: false,
  };
}

function resumirTrecho(texto: string): string {
  const frases = texto.split(/(?<=[.!?])\s+/).slice(0, 4);
  return frases.join(" ").slice(0, 600);
}

async function redigirComClaude(pergunta: string, trechos: Trecho[], clientId: number | null, nomeCliente: string): Promise<string> {
  const client = new Anthropic();
  const contexto = trechos
    .map((t, i) => `[Fonte ${i + 1} — ${t.fonte.tipo}: ${t.fonte.titulo}]\n${t.texto}`)
    .join("\n\n");
  const historico = clientId ? historicoRecente(clientId) : [];

  const system = `Você é o Assistente de Estudos de uma plataforma de acompanhamento psicopedagógico. Você apoia a metodologia da mentora — você não é um produto de IA e não se apresenta como tal.

Regras invioláveis:
- Responda APENAS com base nas fontes fornecidas abaixo (metodologia da mentora, documentos da biblioteca e histórico do cliente). Nunca use conhecimento externo, internet ou opinião própria.
- NUNCA emita diagnóstico, hipótese clínica ou orientação de saúde. Encaminhe esses temas para a mentora.
- Se as fontes não sustentarem a resposta, diga claramente que não há evidências na base para responder e sugira falar com a mentora.
- Tom: acolhedor, encorajador e simples. Português do Brasil. Respostas curtas (1 a 3 parágrafos), falando diretamente com ${nomeCliente}.
- Cite naturalmente de qual material da mentora veio a orientação.

Fontes disponíveis para esta pergunta:

${contexto}`;

  const messages: Anthropic.MessageParam[] = [
    ...historico.map((m) => ({ role: m.papel === "usuario" ? ("user" as const) : ("assistant" as const), content: m.conteudo })),
    { role: "user", content: pergunta },
  ];

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system,
    messages,
  });
  const texto = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!texto) throw new Error("Resposta vazia");
  return texto;
}

/** Salva a troca no banco e registra o evento na linha do tempo. */
export function salvarConversa(
  clientId: number,
  autor: string,
  pergunta: string,
  resposta: RespostaAssistente,
  conversationId?: number
): number {
  const db = getDb();
  let convId = conversationId;
  if (!convId) {
    const info = db
      .prepare("INSERT INTO conversations (workspace_id, client_id, titulo) VALUES (1, ?, ?)")
      .run(clientId, pergunta.slice(0, 80));
    convId = Number(info.lastInsertRowid);
    logEvent(clientId, "conversa", `${autor} iniciou uma conversa: “${pergunta.slice(0, 80)}”.`);
  }
  const insert = db.prepare(
    "INSERT INTO messages (conversation_id, papel, autor, conteudo, fontes) VALUES (?, ?, ?, ?, ?)"
  );
  insert.run(convId, "usuario", autor, pergunta, "[]");
  insert.run(convId, "assistente", "Assistente de Estudos", resposta.resposta, JSON.stringify(resposta.fontes));
  return convId;
}

/**
 * "Gerar resumo da evolução": lê todas as conversas e eventos do cliente e
 * produz uma síntese para a mentora. Com Claude quando há chave; senão, um
 * resumo estruturado determinístico.
 */
export async function gerarResumoEvolucao(clientId: number): Promise<string> {
  const db = getDb();
  const cli = db.prepare("SELECT nome, objetivo, observacoes FROM clients WHERE id = ?").get(clientId) as
    | { nome: string; objetivo: string; observacoes: string }
    | undefined;
  if (!cli) throw new Error("Cliente não encontrado");

  const msgs = db
    .prepare(
      `SELECT m.papel, m.autor, m.conteudo, m.criado_em FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.client_id = ? ORDER BY m.id ASC LIMIT 200`
    )
    .all(clientId) as { papel: string; autor: string; conteudo: string; criado_em: string }[];
  const eventos = db
    .prepare("SELECT tipo, descricao, criado_em FROM events WHERE client_id = ? ORDER BY criado_em ASC LIMIT 100")
    .all(clientId) as { tipo: string; descricao: string; criado_em: string }[];

  if (process.env.ANTHROPIC_API_KEY && (msgs.length > 0 || eventos.length > 0)) {
    try {
      const client = new Anthropic();
      const material = [
        `Cliente: ${cli.nome}`,
        `Objetivo do acompanhamento: ${cli.objetivo || "—"}`,
        `Observações da mentora: ${cli.observacoes || "—"}`,
        "",
        "Linha do tempo:",
        ...eventos.map((e) => `- [${e.criado_em.slice(0, 10)}] (${e.tipo}) ${e.descricao}`),
        "",
        "Conversas com o assistente:",
        ...msgs.map((m) => `- [${m.criado_em.slice(0, 10)}] ${m.autor}: ${m.conteudo}`),
      ].join("\n");
      const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 800,
        system:
          "Você redige, para uma psicopedagoga, um resumo da evolução de um cliente em acompanhamento. Use APENAS o material fornecido " +
          "(linha do tempo e conversas) — nada externo. Não emita diagnóstico. Escreva 1 a 2 parágrafos em português do Brasil, tom " +
          "profissional e objetivo: avanços observados, dificuldades que persistem e sugestão de foco para os próximos encontros.",
        messages: [{ role: "user", content: material }],
      });
      const texto = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (texto) return registrarResumo(clientId, texto);
    } catch {
      // cai no resumo determinístico
    }
  }

  // Resumo determinístico (modo demo)
  const nConversas = new Set(msgs.map((m) => m.criado_em.slice(0, 10))).size;
  const perguntas = msgs.filter((m) => m.papel === "usuario").map((m) => m.conteudo);
  const temas = temasFrequentes(perguntas.join(" "));
  const ultimos = eventos.slice(-3).map((e) => e.descricao);
  const texto =
    `Nas últimas interações registradas (${msgs.length} mensagens em ${nConversas || 1} dia(s) de conversa e ${eventos.length} evento(s) na linha do tempo), ` +
    `${cli.nome} trouxe principalmente temas ligados a ${temas.length ? temas.join(", ") : "o objetivo do acompanhamento"}. ` +
    (ultimos.length ? `Registros recentes: ${ultimos.join(" ")} ` : "") +
    `O objetivo vigente é: ${cli.objetivo || "ainda não definido"}. ` +
    `Sugere-se revisar esses pontos no próximo encontro e atualizar as observações do acompanhamento.`;
  return registrarResumo(clientId, texto);
}

function registrarResumo(clientId: number, texto: string): string {
  logEvent(clientId, "resumo", "Resumo da evolução gerado pela mentora.");
  return texto;
}

function temasFrequentes(texto: string): string[] {
  const contagem = new Map<string, number>();
  for (const t of tokens(texto)) contagem.set(t, (contagem.get(t) ?? 0) + 1);
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}
