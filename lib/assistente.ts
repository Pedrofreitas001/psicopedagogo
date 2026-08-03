import {
  listKnowledge,
  listLibraryDocuments,
  listCaseDocuments,
  getCase,
  getParticipant,
  listCasesByParticipant,
  listParticipantEvents,
  listCaseEvents,
  listRecentCaseNotes,
  listRecentMessages,
  listAllMessagesForParticipant,
  createConversation,
  createMessage,
  logEvent,
  getAgentSettings,
  listCaseAssignments,
  listHypotheses,
  getProtocol,
  getResponses,
  type AgentSettings,
  type Protocol,
  type ProtocolField,
  type ProtocolResponse,
  type Hypothesis,
} from "./data";

/**
 * Mentor Clínico Digital — não é um chatbot de perguntas e respostas. Conduz
 * a participante da mentoria por um raciocínio clínico estruturado sobre um
 * caso (a criança que ela atende), seguindo o método de 6 etapas:
 *   1. organização dos dados já disponíveis;
 *   2. identificação de lacunas;
 *   3. análise pelas duas lentes (contexto e processamento cognitivo);
 *   4. construção de hipóteses;
 *   5. busca de evidências a favor/contra;
 *   6. tomada de decisão clínica.
 *
 * Ele NUNCA diagnostica, nunca confirma conclusões clínicas e nunca entrega
 * uma resposta pronta quando pode conduzir por perguntas — o julgamento
 * final é sempre da participante. Sempre que possível, explica por que está
 * perguntando o que perguntou (transparência do raciocínio).
 *
 * Fontes disponíveis (ligadas em Configurações → Escopo do assistente):
 *   metodologia, biblioteca (geral + arquivos do caso), ficha e linha do
 *   tempo do caso, registros de raciocínio clínico datados, protocolo(s)
 *   aplicados e hipóteses já formuladas para o caso.
 *
 * Com OPENROUTER_API_KEY definida, a condução é feita por um modelo via
 * OpenRouter com um prompt rígido de método; sem a chave, o assistente
 * apenas organiza o que já está registrado (modo demo, offline).
 */

export type Fonte = { tipo: "documento" | "metodologia" | "historico" | "prontuario" | "protocolo" | "hipotese"; titulo: string };
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

/** Recupera os trechos da base mais relacionados à pergunta, no escopo do caso (ou geral) e do agente. */
export async function recuperarBase(pergunta: string, participantId: number, caseId: number | null, settings: AgentSettings): Promise<Trecho[]> {
  const q = new Set(tokens(pergunta));

  const candidatos: { fonte: Fonte; texto: string }[] = [];

  if (settings.usaMetodologia) {
    const know = await listKnowledge();
    for (const k of know) candidatos.push({ fonte: { tipo: "metodologia", titulo: k.titulo }, texto: `${k.titulo}. ${k.conteudo}` });
  }

  if (settings.usaBiblioteca) {
    const biblioteca = await listLibraryDocuments();
    const doCaso = caseId ? await listCaseDocuments(caseId) : [];
    for (const d of [...biblioteca, ...doCaso]) {
      if (!d.disponivelAssistente || !d.conteudo) continue;
      candidatos.push({ fonte: { tipo: "documento", titulo: d.nome }, texto: `${d.nome}. ${d.conteudo}` });
    }
  }

  if (caseId && settings.usaHistorico) {
    const caso = await getCase(caseId);
    if (caso && (caso.objetivo || caso.observacoes || caso.diagnosticoPreliminar || caso.queixaPrincipal)) {
      candidatos.push({
        fonte: { tipo: "historico", titulo: `Ficha do caso ${caso.nome}` },
        texto: juntarComPonto([
          caso.objetivo && `Objetivo da análise: ${caso.objetivo}`,
          caso.queixaPrincipal && `Queixa principal registrada: ${caso.queixaPrincipal}`,
          caso.diagnosticoPreliminar && `Diagnóstico preliminar já anotado: ${caso.diagnosticoPreliminar}`,
          caso.observacoes && `Observações da participante: ${caso.observacoes}`,
        ]),
      });
    }
    const eventos = await listCaseEvents(caseId, 12);
    if (eventos.length) {
      candidatos.push({ fonte: { tipo: "historico", titulo: "Linha do tempo recente do caso" }, texto: eventos.map((e) => e.descricao).join(" ") });
    }
  } else if (!caseId && settings.usaHistorico) {
    const eventos = await listParticipantEvents(participantId, 12);
    if (eventos.length) {
      candidatos.push({ fonte: { tipo: "historico", titulo: "Linha do tempo recente da participante" }, texto: eventos.map((e) => e.descricao).join(" ") });
    }
  }

  if (caseId && settings.usaProntuario) {
    const notas = await listRecentCaseNotes(caseId, 8);
    for (const nota of notas) {
      candidatos.push({
        fonte: { tipo: "prontuario", titulo: `Registro de ${nota.dataSessao.slice(0, 10).split("-").reverse().join("/")}` },
        texto: nota.conteudo,
      });
    }
  }

  if (caseId && settings.usaProtocolos) {
    const assignments = await listCaseAssignments(caseId);
    for (const a of assignments.slice(0, 5)) {
      const [protocolo, respostas] = await Promise.all([getProtocol(a.protocolId), getResponses(a.id)]);
      if (!protocolo) continue;
      const texto = resumirProtocolo(a.dataAplicacao, a.status, protocolo, respostas);
      if (!texto) continue;
      candidatos.push({
        fonte: { tipo: "protocolo", titulo: `${protocolo.nome} — ${a.dataAplicacao.slice(0, 10).split("-").reverse().join("/")}` },
        texto,
      });
    }

    const hipoteses = await listHypotheses(caseId);
    for (const h of hipoteses.slice(0, 6)) {
      candidatos.push({ fonte: { tipo: "hipotese", titulo: `Hipótese (${statusHipotese(h.status)})` }, texto: resumirHipotese(h) });
    }
  }

  // Sem pergunta tokenizável (ex.: mensagem muito curta), ainda assim entrega
  // o contexto disponível — o agente precisa dele para conduzir a etapa 1.
  if (q.size === 0) {
    return candidatos.slice(0, 8).map((c) => ({ fonte: c.fonte, texto: c.texto, score: 1 }));
  }

  const trechos: Trecho[] = [];
  for (const c of candidatos) {
    const t = tokens(c.texto);
    let hits = 0;
    const vistos = new Set<string>();
    for (const tok of t) {
      if (q.has(tok) && !vistos.has(tok)) {
        vistos.add(tok);
        hits++;
      }
    }
    // Hipóteses e protocolo do caso sempre entram como contexto de fundo,
    // mesmo com pouca sobreposição de palavras — são o núcleo da memória do caso.
    const sempreRelevante = c.fonte.tipo === "hipotese" || c.fonte.tipo === "protocolo" || c.fonte.tipo === "historico";
    if (hits === 0 && !sempreRelevante) continue;
    trechos.push({ fonte: c.fonte, texto: c.texto, score: hits === 0 ? 0.1 : hits / Math.sqrt(q.size) });
  }
  trechos.sort((a, b) => b.score - a.score);
  return trechos.slice(0, 8);
}

function statusHipotese(status: Hypothesis["status"]): string {
  return status === "ativa" ? "ativa" : status === "confirmada" ? "confirmada" : "descartada";
}

function resumirHipotese(h: Hypothesis): string {
  const partes = [h.texto];
  if (h.evidenciasFavor) partes.push(`A favor: ${h.evidenciasFavor}`);
  if (h.evidenciasContra) partes.push(`Contra: ${h.evidenciasContra}`);
  return partes.join(" — ");
}

export async function responder(pergunta: string, participantId: number, caseId: number | null, nomeParticipante: string, nomeCaso: string | null): Promise<RespostaAssistente> {
  const settings = await getAgentSettings();
  const trechos = await recuperarBase(pergunta, participantId, caseId, settings);
  const fontes = trechos.map((t) => t.fonte);

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const resposta = await conduzirComIA(pergunta, trechos, participantId, caseId, nomeParticipante, nomeCaso, settings);
      return { resposta, fontes, recusado: false };
    } catch (e) {
      // Falha de API não pode derrubar a mentoria: cai no modo offline.
      // Fica registrado nos logs da função (Vercel → projeto → Logs) para diagnóstico.
      console.error("[assistente] Falha ao chamar a OpenRouter, caindo para o modo offline:", e);
    }
  }

  // Modo offline (sem IA): não há condução socrática real — apenas organiza
  // o que já está registrado e sugere as perguntas-guia do método.
  return respostaOffline(trechos, fontes, nomeCaso);
}

function respostaOffline(trechos: Trecho[], fontes: Fonte[], nomeCaso: string | null): RespostaAssistente {
  if (trechos.length === 0) {
    return {
      resposta:
        "[Modo offline — sem IA ativa] Ainda não há nada registrado para eu organizar aqui. Um bom primeiro passo (Etapa 1 do método): " +
        "reúna o que você já tem sobre o caso — anamnese, observações clínicas, resultados de testes e comportamento durante a avaliação " +
        "— e comece a registrar no protocolo ou nos registros de raciocínio clínico.",
      fontes: [],
      recusado: false,
    };
  }
  const corpo = trechos
    .slice(0, 3)
    .map((t) => `${t.fonte.titulo}: ${resumirTrecho(t.texto)}`)
    .join("\n\n");
  const perguntasGuia = [
    "O que você já sabe com segurança, e o que ainda é suposição?",
    "Essa observação aparece em mais de uma fonte (protocolo, registros, história) ou é isolada?",
    "Pela lente de contexto e pela lente de processamento cognitivo, o que cada uma sugere aqui?",
  ];
  return {
    resposta:
      `[Modo offline — sem IA ativa] Aqui está o que já está registrado${nomeCaso ? ` sobre ${nomeCaso}` : ""}:\n\n${corpo}\n\n` +
      `Sem IA ativa eu não consigo conduzir a reflexão com perguntas encadeadas — mas fica como ponto de partida:\n` +
      perguntasGuia.map((p) => `• ${p}`).join("\n"),
    fontes,
    recusado: false,
  };
}

function resumirTrecho(texto: string): string {
  const frases = texto.split(/(?<=[.!?])\s+/).slice(0, 3);
  return frases.join(" ").slice(0, 400);
}

/** Converte o preenchimento de um protocolo (respostas por campo) num texto corrido para a base de recuperação do assistente. */
function resumirProtocolo(dataAplicacao: string, status: string, protocolo: Protocol, respostas: ProtocolResponse[]): string {
  const porCampo = new Map(respostas.map((r) => [r.fieldId, r.valor]));
  const partes: string[] = [`Aplicação em ${dataAplicacao.slice(0, 10).split("-").reverse().join("/")}, status: ${status === "concluido" ? "concluído" : "em andamento"}.`];

  for (const secao of protocolo.secoes) {
    const linhasSecao: string[] = [];
    for (const campo of secao.campos) {
      const valor = porCampo.get(campo.id);
      const texto = formatarValorCampo(campo, valor);
      if (texto) linhasSecao.push(`${campo.label}: ${texto}`);
    }
    if (linhasSecao.length) partes.push(`${secao.titulo} — ${linhasSecao.join("; ")}.`);
  }
  return partes.length > 1 ? partes.join(" ") : "";
}

function formatarValorCampo(campo: ProtocolField, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";
  if (campo.tipo === "multi_select" && Array.isArray(valor)) return valor.join(", ");
  if (campo.tipo === "tabela" && typeof valor === "object" && !Array.isArray(campo.opcoes)) {
    const config = campo.opcoes as { linhas: { key: string; label: string }[] } | null;
    if (!config) return "";
    const registro = valor as Record<string, Record<string, string | number>>;
    const linhas = config.linhas
      .map((l) => {
        const colunas = registro[l.key];
        if (!colunas) return "";
        const vals = Object.values(colunas).filter((v) => v !== null && v !== undefined && v !== "");
        return vals.length ? `${l.label} (${vals.join(", ")})` : "";
      })
      .filter(Boolean);
    return linhas.join("; ");
  }
  if (typeof valor === "string" || typeof valor === "number") return String(valor);
  return "";
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
  acolhedor: "Tom: acolhedor e encorajador, como um supervisor experiente que constrói confiança — mas sem perder o rigor das perguntas.",
  formal: "Tom: profissional e formal, como uma supervisão clínica estruturada.",
  direto: "Tom: direto e objetivo, perguntas curtas e bem direcionadas, sem rodeios.",
};

export const MODELO_PADRAO = "anthropic/claude-sonnet-5";

/** Chama um modelo via OpenRouter (API compatível com OpenAI) para conduzir a etapa do raciocínio. */
async function chamarOpenRouter(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number,
  modeloEscolhido?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY não configurada");
  const model = modeloEscolhido || process.env.OPENROUTER_MODEL || MODELO_PADRAO;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://espacoaprender.app",
      "X-Title": process.env.OPENROUTER_SITE_NAME || "Comunicar & Aprender",
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
  const settings = await getAgentSettings();
  const modelo = settings.modelo || process.env.OPENROUTER_MODEL || MODELO_PADRAO;
  try {
    const resposta = await chamarOpenRouter(
      "Responda apenas com a palavra: ok",
      [{ role: "user", content: "teste de conexão" }],
      20,
      modelo
    );
    return { ok: true, modelo, resposta };
  } catch (e) {
    return { ok: false, modelo, error: e instanceof Error ? e.message : String(e) };
  }
}

async function conduzirComIA(
  pergunta: string,
  trechos: Trecho[],
  participantId: number,
  caseId: number | null,
  nomeParticipante: string,
  nomeCaso: string | null,
  settings: AgentSettings
): Promise<string> {
  const contexto = trechos.length
    ? trechos.map((t, i) => `[Fonte ${i + 1} — ${t.fonte.tipo}: ${t.fonte.titulo}]\n${t.texto}`).join("\n\n")
    : "(Nenhuma fonte relevante encontrada ainda para este caso — pode ser o início da análise.)";
  const historico = await listRecentMessages(participantId, caseId, 10);

  const system = `Você é o Mentor Clínico Digital da mentoria "${await nomeDoWorkspace()}" — um supervisor experiente que conduz ${nomeParticipante}${
    nomeCaso ? `, analisando o caso de ${nomeCaso},` : ""
  } pelo raciocínio clínico em compreensão leitora. Você não é um chatbot de perguntas e respostas.

O método que você segue tem 6 etapas — identifique mentalmente em qual delas a conversa está e conduza por ela:
1. Organização dos dados: o que já se sabe (anamnese, observações, testes, comportamento na avaliação).
2. Identificação de lacunas: o que ainda falta saber; que hipótese está sem evidência suficiente.
3. Análise pelas duas lentes: Lente de Contexto (história da criança, família, escola, oportunidades de leitura, autonomia, experiências prévias) e Lente de Processamento Cognitivo (linguagem, vocabulário, fluência, memória, funções executivas, inferência, compreensão).
4. Construção de hipóteses: nunca afirme — pergunte que hipóteses os dados sustentam, se há interpretação alternativa, se há dados que contradizem.
5. Busca de evidências: o que confirma, o que enfraquece, o que ainda precisa ser coletado.
6. Tomada de decisão clínica: qual a hipótese mais consistente agora, qual o próximo passo da avaliação, isso muda o plano de intervenção, o que comunicar à família/escola.

Como conduzir (o que mais importa):
- Você NUNCA responde diretamente a uma observação clínica com uma conclusão pronta. Em vez disso, faça de 1 a 3 perguntas que levem ${nomeParticipante} a examinar melhor o que ela trouxe — sempre ancoradas nas etapas acima e nas fontes disponíveis.
- Depois das perguntas, em 1 frase curta, explique por que está perguntando isso (transparência do raciocínio) — ex.: "Pergunto isso porque X pode indicar Y ou Z, e isolar qual é o caso muda a hipótese que faz sentido perseguir."
- Só ofereça uma síntese ou organização mais longa quando ${nomeParticipante} já tiver explorado as perguntas anteriores, ou quando ela pedir explicitamente um resumo/organização do que já foi discutido.
- Use as fontes abaixo (protocolo, hipóteses já registradas, registros de raciocínio clínico, histórico, metodologia, biblioteca) para ancorar as perguntas em dados reais do caso — cite-as naturalmente, sem repetir rótulos como "Fonte 1".

Regras invioláveis:
- NUNCA emita diagnóstico, NUNCA confirme uma conclusão clínica como certa, NUNCA substitua a supervisão da mentora. A decisão final é sempre de ${nomeParticipante}.
- NUNCA invente dado que não esteja nas fontes ou no que ${nomeParticipante} acabou de relatar na conversa.
- Se ${nomeParticipante} pedir uma resposta pronta ou um diagnóstico, recuse com gentileza e devolva com uma pergunta que a ajude a chegar lá sozinha.
- ${TOM_INSTRUCAO[settings.tom]}
- Português do Brasil.
${settings.instrucoesExtra ? `\nInstruções adicionais definidas pela mentora:\n${settings.instrucoesExtra}` : ""}

Fontes disponíveis sobre este caso (uso interno seu — não cite os rótulos "Fonte N" na resposta):

${contexto}`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...historico.map((m) => ({ role: m.papel === "usuario" ? ("user" as const) : ("assistant" as const), content: m.conteudo })),
    { role: "user", content: pergunta },
  ];

  return chamarOpenRouter(system, messages, 1024, settings.modelo || undefined);
}

let _workspaceNomeCache: string | null = null;
async function nomeDoWorkspace(): Promise<string> {
  if (_workspaceNomeCache) return _workspaceNomeCache;
  const { getWorkspaceName } = await import("./data");
  _workspaceNomeCache = await getWorkspaceName();
  return _workspaceNomeCache;
}

/** Salva a troca no banco e registra o evento na linha do tempo. */
export async function salvarConversa(
  participantId: number,
  caseId: number | null,
  autor: string,
  pergunta: string,
  resposta: RespostaAssistente,
  conversationId?: number
): Promise<number> {
  let convId = conversationId;
  if (!convId) {
    // A conversa é sempre gravada (mensagens completas, para o histórico e o
    // contexto do agente) — mas só aparece na linha do tempo do caso se a
    // participante adicionar explicitamente (ver registrarConversaNaLinhaDoTempo).
    convId = await createConversation(participantId, caseId, pergunta.slice(0, 80));
  }
  await createMessage({ conversationId: convId, papel: "usuario", autor, conteudo: pergunta, fontes: [] });
  await createMessage({ conversationId: convId, papel: "assistente", autor: "Mentor Clínico", conteudo: resposta.resposta, fontes: resposta.fontes });
  return convId;
}

/**
 * "Gerar resumo pré-encontro": lê hipóteses, protocolo e conversas de todos
 * os casos ativos da participante e produz uma síntese para a mentora usar
 * antes do próximo encontro da mentoria — hipóteses formadas, pontos ainda
 * frágeis, dúvidas recorrentes e questões para discussão. Com IA (OpenRouter)
 * quando há chave; senão, um resumo estruturado determinístico.
 */
export async function gerarResumoEvolucao(participantId: number): Promise<string> {
  const participante = await getParticipant(participantId);
  if (!participante) throw new Error("Participante não encontrada");

  const casos = await listCasesByParticipant(participantId);
  const msgs = await listAllMessagesForParticipant(participantId);
  const eventos = await listParticipantEvents(participantId, 100);
  const settings = await getAgentSettings();

  const hipotesesPorCaso = await Promise.all(
    casos.map(async (c) => ({ caso: c, hipoteses: await listHypotheses(c.id) }))
  );

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const material = [
        `Participante: ${participante.nome}`,
        `Estágio na mentoria: ${participante.estagioMentoria || "—"}`,
        `Observações da mentora sobre a participante: ${participante.observacoesMentora || "—"}`,
        "",
        "Casos clínicos acompanhados:",
        ...hipotesesPorCaso.map(
          ({ caso, hipoteses }) =>
            `- ${caso.nome} (${caso.status}): objetivo "${caso.objetivo || "—"}". Hipóteses: ${
              hipoteses.length
                ? hipoteses.map((h) => `[${h.status}] ${h.texto}`).join(" | ")
                : "nenhuma hipótese registrada ainda"
            }`
        ),
        "",
        "Linha do tempo da mentoria:",
        ...eventos.map((e) => `- [${e.criadoEm.slice(0, 10)}] (${e.tipo}) ${e.descricao}`),
        "",
        "Conversas com o agente (todos os casos):",
        ...msgs.map((m) => `- [${m.criadoEm.slice(0, 10)}] ${m.autor}: ${m.conteudo}`),
      ].join("\n");
      const texto = await chamarOpenRouter(
        "Você prepara, para a mentora de um programa de formação em raciocínio clínico, um resumo pré-encontro sobre uma " +
          "participante. Use APENAS o material fornecido — nada externo. Não emita diagnóstico sobre os casos clínicos da " +
          "participante. Estruture a resposta em: (1) principais hipóteses formuladas por ela e o status de cada uma; " +
          "(2) pontos ainda frágeis no raciocínio; (3) dúvidas recorrentes nas conversas; (4) 2-3 questões sugeridas para " +
          "discutir no encontro. Português do Brasil, tom profissional e objetivo.",
        [{ role: "user", content: material }],
        900,
        settings.modelo || undefined
      );
      if (texto) return await registrarResumo(participantId, texto);
    } catch {
      // cai no resumo determinístico
    }
  }

  // Resumo determinístico (modo demo)
  const totalHipoteses = hipotesesPorCaso.reduce((acc, h) => acc + h.hipoteses.length, 0);
  const ativas = hipotesesPorCaso.flatMap((h) => h.hipoteses.filter((x) => x.status === "ativa"));
  const casosAtivos = casos.filter((c) => c.status === "ativo");
  const texto =
    `${participante.nome} está no estágio "${participante.estagioMentoria || "não definido"}" da mentoria, com ${casosAtivos.length} caso(s) ativo(s) ` +
    `e ${totalHipoteses} hipótese(s) registrada(s) no total (${ativas.length} ainda ativa(s), sem confirmação ou descarte). ` +
    (ativas.length ? `Hipóteses em aberto: ${ativas.map((h) => `"${h.texto}"`).join("; ")}. ` : "") +
    `Foram ${msgs.length} mensagens trocadas com o agente ao longo do acompanhamento. ` +
    `Sugestão de pauta para o encontro: revisar as hipóteses ainda ativas e decidir, para cada uma, se há evidência suficiente para confirmar, descartar ou se ainda falta coletar dado.`;
  return await registrarResumo(participantId, texto);
}

async function registrarResumo(participantId: number, texto: string): Promise<string> {
  await logEvent(participantId, null, "resumo", "Resumo pré-encontro gerado pela mentora.");
  return texto;
}
