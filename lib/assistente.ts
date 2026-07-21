import {
  listKnowledge,
  listLibraryDocuments,
  listClientDocuments,
  getClient,
  listClientEvents,
  listRecentSessionNotes,
  listRecentMessages,
  listAllMessages,
  createConversation,
  createMessage,
  logEvent,
  getAgentSettings,
  type AgentSettings,
} from "./data";

/**
 * Assistente de Estudos — responde usando exclusivamente as fontes ligadas em
 * Configurações → Escopo do assistente:
 *   1. a metodologia cadastrada pela mentora (tabela knowledge);
 *   2. os documentos da biblioteca e do cliente marcados como disponíveis;
 *   3. o histórico daquele cliente (objetivo/observações e linha do tempo);
 *   4. o prontuário (notas de sessão datadas).
 *
 * Nunca internet, nunca opinião própria, nunca diagnóstico. Quando a base
 * não sustenta uma resposta, ele diz isso com clareza.
 *
 * Com OPENROUTER_API_KEY definida, a redação final é feita por um modelo via
 * OpenRouter com um prompt rígido de fundamentação; sem a chave, o assistente
 * compõe a resposta diretamente dos trechos recuperados (modo demo, offline).
 */

export type Fonte = { tipo: "documento" | "metodologia" | "historico" | "prontuario"; titulo: string };
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

/** Recupera os trechos da base mais relacionados à pergunta, no escopo do cliente e do agente. */
export async function recuperarBase(pergunta: string, clientId: number | null, settings: AgentSettings): Promise<Trecho[]> {
  const q = new Set(tokens(pergunta));
  if (q.size === 0) return [];

  const candidatos: { fonte: Fonte; texto: string }[] = [];

  if (settings.usaMetodologia) {
    const know = await listKnowledge();
    for (const k of know) candidatos.push({ fonte: { tipo: "metodologia", titulo: k.titulo }, texto: `${k.titulo}. ${k.conteudo}` });
  }

  if (settings.usaBiblioteca) {
    const biblioteca = await listLibraryDocuments();
    const doCliente = clientId ? await listClientDocuments(clientId) : [];
    for (const d of [...biblioteca, ...doCliente]) {
      if (!d.disponivelAssistente || !d.conteudo) continue;
      candidatos.push({ fonte: { tipo: "documento", titulo: d.nome }, texto: `${d.nome}. ${d.conteudo}` });
    }
  }

  if (clientId && settings.usaHistorico) {
    const cli = await getClient(clientId);
    if (cli && (cli.objetivo || cli.observacoes || cli.diagnosticoPreliminar || cli.queixaPrincipal)) {
      candidatos.push({
        fonte: { tipo: "historico", titulo: `Acompanhamento de ${cli.nome}` },
        texto: juntarComPonto([
          cli.objetivo && `Objetivo do acompanhamento: ${cli.objetivo}`,
          cli.queixaPrincipal && `Queixa principal registrada: ${cli.queixaPrincipal}`,
          cli.diagnosticoPreliminar && `Diagnóstico preliminar já anotado pela mentora: ${cli.diagnosticoPreliminar}`,
          cli.observacoes && `Observações da mentora: ${cli.observacoes}`,
        ]),
      });
    }
    const eventos = await listClientEvents(clientId, 12);
    if (eventos.length) {
      candidatos.push({
        fonte: { tipo: "historico", titulo: "Linha do tempo recente" },
        texto: eventos.map((e) => e.descricao).join(" "),
      });
    }
  }

  if (clientId && settings.usaProntuario) {
    const notas = await listRecentSessionNotes(clientId, 8);
    for (const nota of notas) {
      candidatos.push({ fonte: { tipo: "prontuario", titulo: `Sessão de ${nota.dataSessao.slice(0, 10).split("-").reverse().join("/")}` }, texto: nota.conteudo });
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

export async function responder(pergunta: string, clientId: number | null, nomeCliente: string): Promise<RespostaAssistente> {
  const settings = await getAgentSettings();
  const trechos = await recuperarBase(pergunta, clientId, settings);
  // Sem apoio mínimo na base → recusa transparente (regra do produto)
  if (trechos.length === 0 || trechos[0].score < 0.5) {
    return { resposta: RECUSA, fontes: [], recusado: true };
  }
  const fontes = trechos.map((t) => t.fonte);

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const resposta = await redigirComIA(pergunta, trechos, clientId, nomeCliente, settings);
      return { resposta, fontes, recusado: false };
    } catch (e) {
      // Falha de API não pode derrubar o atendimento: cai no modo offline.
      // Fica registrado nos logs da função (Vercel → projeto → Logs) para diagnóstico.
      console.error("[assistente] Falha ao chamar a OpenRouter, caindo para o modo offline:", e);
    }
  }

  // Modo offline (sem IA): não há redação real, só uma composição literal dos
  // trechos recuperados — muito mais limitada que o modo com OpenRouter.
  const corpo = trechos
    .slice(0, 2)
    .map((t) => resumirTrecho(t.texto))
    .join("\n\n");
  const nomes = fontes.map((f) => `“${f.titulo}”`).join(", ");
  return {
    resposta: `[Modo offline — sem IA ativa] Com base no que a mentora preparou (${nomes}):\n\n${corpo}\n\nSe quiser, posso detalhar algum desses pontos — e qualquer dúvida clínica fica para a mentora.`,
    fontes,
    recusado: false,
  };
}

function resumirTrecho(texto: string): string {
  const frases = texto.split(/(?<=[.!?])\s+/).slice(0, 4);
  return frases.join(" ").slice(0, 600);
}

/** Junta partes de texto com ". " entre elas, sem duplicar pontuação quando uma parte já termina em ponto. */
function juntarComPonto(partes: (string | null | undefined)[]): string {
  return partes
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .map((p) => p.replace(/[.!?]+$/, ""))
    .join(". ") + ".";
}

const TOM_INSTRUCAO: Record<AgentSettings["tom"], string> = {
  acolhedor: "Tom: acolhedor, encorajador e simples, como uma mentora carinhosa.",
  formal: "Tom: profissional e formal, como um relatório técnico claro.",
  direto: "Tom: direto e objetivo, frases curtas, sem rodeios.",
};

/** Chama um modelo via OpenRouter (API compatível com OpenAI) para redigir a resposta final. */
async function chamarOpenRouter(system: string, messages: { role: "user" | "assistant"; content: string }[], maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY não configurada");
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://espacoaprender.app",
      "X-Title": process.env.OPENROUTER_SITE_NAME || "Espaço Aprender",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const texto = data.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error("Resposta vazia da OpenRouter");
  return texto;
}

/** Chamada mínima para diagnosticar a configuração da OpenRouter (usada pelo botão "Testar conexão" em Configurações). */
export async function testarConexaoIA(): Promise<{ ok: boolean; modelo?: string; resposta?: string; error?: string }> {
  const modelo = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5";
  try {
    const resposta = await chamarOpenRouter(
      "Responda apenas com a palavra: ok",
      [{ role: "user", content: "teste de conexão" }],
      20
    );
    return { ok: true, modelo, resposta };
  } catch (e) {
    return { ok: false, modelo, error: e instanceof Error ? e.message : String(e) };
  }
}

async function redigirComIA(pergunta: string, trechos: Trecho[], clientId: number | null, nomeCliente: string, settings: AgentSettings): Promise<string> {
  const contexto = trechos.map((t, i) => `[Fonte ${i + 1} — ${t.fonte.tipo}: ${t.fonte.titulo}]\n${t.texto}`).join("\n\n");
  const historico = clientId ? await listRecentMessages(clientId, 10) : [];

  const system = `Você é o Assistente de Estudos de uma plataforma de acompanhamento psicopedagógico. Você apoia a metodologia da mentora — você não é um produto de IA e não se apresenta como tal.

Como responder (isso é o que mais importa):
- NUNCA cole ou liste as fontes uma atrás da outra. Leia todas, entenda o que cada uma diz, e escreva uma resposta corrida que RESPONDE DIRETAMENTE à pergunta, conectando as partes relevantes entre si. O leitor não deve perceber que você está "juntando trechos" — deve parecer alguém que leu tudo e já sabe a resposta.
- Comece respondendo à pergunta em 1 frase direta. Depois, no máximo 2 parágrafos curtos, traga o raciocínio e o contexto específico ${clientId ? `de ${nomeCliente}` : ""} que sustentam essa resposta.
- Só traga informação das fontes que realmente ajuda a responder a ESTA pergunta — ignore fontes pouco relevantes mesmo que estejam na lista.
- Não repita rótulos como "Fonte 1" ou nomes de arquivo dentro do texto da resposta — cite naturalmente ("segundo o protocolo que a mentora preparou...", "as sessões recentes mostram que...").

Regras invioláveis:
- Responda APENAS com base nas fontes fornecidas abaixo (metodologia da mentora, documentos da biblioteca, histórico e prontuário do cliente). Nunca use conhecimento externo, internet ou opinião própria, e nunca invente algo que não esteja nas fontes.
- Você PODE relatar o que a mentora já registrou (objetivo, queixa, diagnóstico preliminar, notas de sessão) — isso é fato documentado, não invenção sua. O que você NUNCA deve fazer é formular, sugerir ou confirmar um diagnóstico por conta própria, nem dar opinião clínica além do que está escrito. Se perguntarem algo que exige avaliação (não apenas relatar o que já foi anotado), diga isso e encaminhe para a mentora.
- Se as fontes não sustentarem a resposta, diga claramente que não há evidências na base e sugira falar com a mentora.
- ${TOM_INSTRUCAO[settings.tom]}
- Português do Brasil.
${settings.instrucoesExtra ? `\nInstruções adicionais definidas pela mentora:\n${settings.instrucoesExtra}` : ""}

Fontes disponíveis para esta pergunta (uso interno seu — não cite os rótulos "Fonte N" na resposta):

${contexto}`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...historico.map((m) => ({ role: m.papel === "usuario" ? ("user" as const) : ("assistant" as const), content: m.conteudo })),
    { role: "user", content: pergunta },
  ];

  return chamarOpenRouter(system, messages, 1024);
}

/** Salva a troca no banco e registra o evento na linha do tempo. */
export async function salvarConversa(
  clientId: number,
  autor: string,
  pergunta: string,
  resposta: RespostaAssistente,
  conversationId?: number
): Promise<number> {
  let convId = conversationId;
  if (!convId) {
    convId = await createConversation(clientId, pergunta.slice(0, 80));
    await logEvent(clientId, "conversa", `${autor} iniciou uma conversa: “${pergunta.slice(0, 80)}”.`);
  }
  await createMessage({ conversationId: convId, papel: "usuario", autor, conteudo: pergunta, fontes: [] });
  await createMessage({ conversationId: convId, papel: "assistente", autor: "Assistente de Estudos", conteudo: resposta.resposta, fontes: resposta.fontes });
  return convId;
}

/**
 * "Gerar resumo da evolução": lê todas as conversas e eventos do cliente e
 * produz uma síntese para a mentora. Com IA (OpenRouter) quando há chave;
 * senão, um resumo estruturado determinístico.
 */
export async function gerarResumoEvolucao(clientId: number): Promise<string> {
  const cli = await getClient(clientId);
  if (!cli) throw new Error("Cliente não encontrado");

  const msgs = await listAllMessages(clientId);
  const eventos = await listClientEvents(clientId, 100);

  if (process.env.OPENROUTER_API_KEY && (msgs.length > 0 || eventos.length > 0)) {
    try {
      const material = [
        `Cliente: ${cli.nome}${cli.idade ? ` (${cli.idade} anos)` : ""}`,
        `Objetivo do acompanhamento: ${cli.objetivo || "—"}`,
        `Queixa principal: ${cli.queixaPrincipal || "—"}`,
        `Diagnóstico preliminar: ${cli.diagnosticoPreliminar || "—"}`,
        `Observações da mentora: ${cli.observacoes || "—"}`,
        "",
        "Linha do tempo:",
        ...eventos.map((e) => `- [${e.criadoEm.slice(0, 10)}] (${e.tipo}) ${e.descricao}`),
        "",
        "Conversas com o assistente:",
        ...msgs.map((m) => `- [${m.criadoEm.slice(0, 10)}] ${m.autor}: ${m.conteudo}`),
      ].join("\n");
      const texto = await chamarOpenRouter(
        "Você redige, para uma psicopedagoga, um resumo da evolução de um cliente em acompanhamento. Use APENAS o material fornecido " +
          "(linha do tempo e conversas) — nada externo. Não emita diagnóstico. Escreva 1 a 2 parágrafos em português do Brasil, tom " +
          "profissional e objetivo: avanços observados, dificuldades que persistem e sugestão de foco para os próximos encontros.",
        [{ role: "user", content: material }],
        800
      );
      if (texto) return await registrarResumo(clientId, texto);
    } catch {
      // cai no resumo determinístico
    }
  }

  // Resumo determinístico (modo demo)
  const nConversas = new Set(msgs.map((m) => m.criadoEm.slice(0, 10))).size;
  const perguntas = msgs.filter((m) => m.papel === "usuario").map((m) => m.conteudo);
  const temas = temasFrequentes(perguntas.join(" "));
  const ultimos = eventos.slice(-3).map((e) => e.descricao);
  const texto =
    `Nas últimas interações registradas (${msgs.length} mensagens em ${nConversas || 1} dia(s) de conversa e ${eventos.length} evento(s) na linha do tempo), ` +
    `${cli.nome} trouxe principalmente temas ligados a ${temas.length ? temas.join(", ") : "o objetivo do acompanhamento"}. ` +
    (ultimos.length ? `Registros recentes: ${ultimos.join(" ")} ` : "") +
    `O objetivo vigente é: ${cli.objetivo || "ainda não definido"}. ` +
    `Sugere-se revisar esses pontos no próximo encontro e atualizar as observações do acompanhamento.`;
  return await registrarResumo(clientId, texto);
}

async function registrarResumo(clientId: number, texto: string): Promise<string> {
  await logEvent(clientId, "resumo", "Resumo da evolução gerado pela mentora.");
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
