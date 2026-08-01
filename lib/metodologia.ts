import type { CaseNote, Hypothesis, ProtocolAssignment } from "./data";

/**
 * Deriva, por regras (sem chamar IA), em que etapa do método de 6 etapas o
 * caso está — a partir do que já foi registrado (protocolo, hipóteses,
 * registros de raciocínio). É a mesma sequência descrita no prompt do
 * mentor de IA (lib/assistente.ts), só que aplicada aos dados em vez de a
 * uma conversa. Serve tanto para guiar a participante (próximo passo) quanto,
 * futuramente, para métricas de evolução por participante.
 */
export type EtapaCaso = {
  numero: 1 | 2 | 3 | 4 | 5 | 6;
  titulo: string;
  descricao: string;
  proximoPasso: string;
  pergunta: string;
  concluido?: boolean;
};

export function calcularEtapaCaso(assignments: ProtocolAssignment[], hipoteses: Hypothesis[], notas: CaseNote[]): EtapaCaso {
  const protocoloConcluido = assignments.some((a) => a.status === "concluido");
  const protocoloEmAndamento = assignments.some((a) => a.status === "em_andamento");
  const ativas = hipoteses.filter((h) => h.status === "ativa");
  const comEvidencia = ativas.filter((h) => h.evidenciasFavor.trim() || h.evidenciasContra.trim());
  const prontasParaDecisao = ativas.filter((h) => h.evidenciasFavor.trim() && h.evidenciasContra.trim());

  if (hipoteses.length > 0 && ativas.length === 0) {
    return {
      numero: 6,
      titulo: "Ciclo concluído",
      descricao: "Todas as hipóteses já foram confirmadas ou descartadas.",
      proximoPasso: "Reveja se a queixa principal foi respondida — se sim, considere encerrar o caso; se não, levante uma nova hipótese.",
      pergunta: "Já confirmamos ou descartamos as hipóteses deste caso. O que os dados que temos até aqui sugerem: a queixa principal já está respondida, ou ainda falta investigar algo?",
      concluido: true,
    };
  }

  if (prontasParaDecisao.length > 0) {
    return {
      numero: 6,
      titulo: "Etapa 6 — Tomada de decisão clínica",
      descricao: "Há hipótese com evidências a favor e contra já registradas.",
      proximoPasso: "Decida: qual hipótese é a mais consistente agora, e isso muda o plano de intervenção?",
      pergunta: "Já reuni evidências a favor e contra para uma das hipóteses deste caso. Pode me ajudar a decidir qual é a mais consistente agora, e qual deveria ser o próximo passo da avaliação?",
    };
  }

  if (comEvidencia.length > 0) {
    return {
      numero: 5,
      titulo: "Etapa 5 — Busca de evidências",
      descricao: "Uma hipótese já tem evidência registrada de um dos lados.",
      proximoPasso: "Continue reunindo o que confirma e o que enfraquece cada hipótese ativa.",
      pergunta: "Estou reunindo evidências para uma hipótese deste caso. O que mais eu deveria verificar para confirmar ou enfraquecer essa hipótese?",
    };
  }

  if (ativas.length > 0) {
    return {
      numero: 4,
      titulo: "Etapa 4 — Construção de hipóteses",
      descricao: "Já existe hipótese registrada, ainda sem evidências.",
      proximoPasso: "Busque o que confirma e o que contradiz essa hipótese antes de segui-la adiante.",
      pergunta: "Registrei uma hipótese para este caso. Que evidências, a favor ou contra, eu deveria buscar primeiro?",
    };
  }

  if (protocoloConcluido) {
    return {
      numero: 3,
      titulo: "Etapa 3 — Análise pelas duas lentes",
      descricao: "O protocolo foi concluído, mas ainda não há nenhuma hipótese.",
      proximoPasso: "Olhe os dados pela lente de contexto e pela lente de processamento cognitivo, e levante a primeira hipótese.",
      pergunta: "Concluí o protocolo deste caso. Pela lente de contexto e pela lente de processamento cognitivo, que hipóteses esses dados sustentam?",
    };
  }

  if (protocoloEmAndamento || notas.length > 0) {
    return {
      numero: 2,
      titulo: "Etapa 2 — Identificação de lacunas",
      descricao: "Já há registro sobre o caso, mas o protocolo ainda não foi concluído.",
      proximoPasso: "Termine de aplicar o protocolo — é isso que revela o que ainda falta saber.",
      pergunta: "Já tenho alguns dados registrados sobre este caso. O que ainda está faltando para eu entender melhor a situação?",
    };
  }

  return {
    numero: 1,
    titulo: "Etapa 1 — Organização dos dados",
    descricao: "O caso foi criado, mas ainda não há protocolo, notas ou hipóteses.",
    proximoPasso: "Aplique um protocolo ou registre o primeiro raciocínio sobre o caso, para começar a organizar o que você já sabe.",
    pergunta: "Acabei de cadastrar este caso. Quais informações eu já deveria ter em mãos antes de aplicar um protocolo?",
  };
}
