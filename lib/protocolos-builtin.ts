/**
 * Protocolos internalizados no código — a forma mais simples de "trazer um
 * protocolo novo" é adicionar uma entrada aqui (seções + campos) e chamar
 * syncBuiltinProtocols(); a sincronização é idempotente (por nome) e roda
 * sozinha sempre que a lista de protocolos é aberta, então nenhuma migração
 * SQL manual é necessária para adicionar/ajustar um protocolo.
 */

export type CampoTipo = "texto" | "textarea" | "numero" | "single_select" | "multi_select" | "tabela";

export type TabelaConfig = {
  linhas: { key: string; label: string }[];
  colunas: { key: string; label: string; tipo: "texto" | "numero" | "select"; opcoes?: string[] }[];
};

export type CampoDef = {
  chave: string;
  label: string;
  tipo: CampoTipo;
  opcoes?: string[] | TabelaConfig;
};

export type SecaoDef = { titulo: string; campos: CampoDef[] };

export type ProtocoloDef = { nome: string; descricao: string; versao: string; secoes: SecaoDef[] };

const NIVEL_3 = ["Adequado", "Alerta", "Alterado"];

export const PROTOCOLOS_BUILTIN: ProtocoloDef[] = [
  {
    nome: "Avaliação da Compreensão Leitora — Textos Expositivos",
    descricao: "Comunicar & Aprender — protocolo de avaliação da compreensão leitora em textos expositivos.",
    versao: "2",
    secoes: [
      {
        titulo: "Identificação",
        campos: [
          { chave: "nome", label: "Nome", tipo: "texto" },
          { chave: "data_nascimento", label: "Data de nascimento", tipo: "texto" },
          { chave: "idade", label: "Idade", tipo: "numero" },
          { chave: "escolaridade", label: "Escolaridade", tipo: "texto" },
          { chave: "data_avaliacao", label: "Data da avaliação", tipo: "texto" },
          { chave: "avaliador", label: "Avaliador(a)", tipo: "texto" },
          { chave: "texto_utilizado", label: "Texto utilizado", tipo: "texto" },
          { chave: "num_palavras_texto", label: "Número de palavras do texto", tipo: "numero" },
          { chave: "genero_finalidade", label: "Gênero/finalidade (ex.: divulgação científica, didático, jornalístico, técnico)", tipo: "texto" },
          {
            chave: "estrutura_predominante",
            label: "Estrutura predominante do texto utilizado (marcar antes da aplicação)",
            tipo: "single_select",
            opcoes: ["Descrição", "Sequência/processo", "Comparação", "Causa-efeito", "Problema-solução"],
          },
        ],
      },
      {
        titulo: "0. Antes da leitura",
        campos: [
          { chave: "interesse_leitura", label: "Demonstração de interesse pela leitura/tema", tipo: "single_select", opcoes: ["Demonstra interesse", "Neutro(a)", "Demonstra desinteresse"] },
          { chave: "conhecimento_previo", label: "Ativação de conhecimento prévio sobre o tema", tipo: "single_select", opcoes: ["Conhecimento amplo", "Conhecimento superficial", "Conhecimento ausente"] },
          { chave: "relata_o_que_sabe", label: "Relata o que sabe", tipo: "textarea" },
        ],
      },
      {
        titulo: "1. Identificação e eficiência leitora",
        campos: [
          {
            chave: "painel_geral_leitor",
            label: "Painel geral do leitor",
            tipo: "tabela",
            opcoes: {
              linhas: [
                { key: "velocidade_silenciosa", label: "Velocidade de leitura silenciosa (ppm)" },
                { key: "velocidade_oral", label: "Velocidade de leitura oral (ppm)" },
                { key: "acuracia", label: "Acurácia (palavras corretas por minuto)" },
                { key: "fluencia", label: "Fluência" },
                { key: "reconto", label: "Reconto" },
                { key: "compreensao", label: "Compreensão" },
                { key: "inferencias", label: "Inferências" },
                { key: "monitoramento", label: "Monitoramento" },
              ],
              colunas: [{ key: "nivel", label: "Nível", tipo: "select", opcoes: NIVEL_3 }],
            } as TabelaConfig,
          },
          { chave: "tempo_leitura_silenciosa_s", label: "Tempo de leitura silenciosa (s)", tipo: "numero" },
          { chave: "velocidade_silenciosa_ppm", label: "Velocidade de leitura silenciosa (ppm) — calculada", tipo: "numero" },
          { chave: "tempo_leitura_oral_s", label: "Tempo de leitura oral (s)", tipo: "numero" },
          { chave: "velocidade_oral_ppm", label: "Velocidade de leitura oral (ppm) — calculada", tipo: "numero" },
          {
            chave: "ocorrencias_leitura",
            label: "Ocorrências na leitura (frequência)",
            tipo: "tabela",
            opcoes: {
              linhas: [
                { key: "trocas", label: "Trocas/Substituições" },
                { key: "omissoes", label: "Omissões" },
                { key: "acrescimos", label: "Acréscimos" },
                { key: "inversoes", label: "Inversões" },
                { key: "hesitacoes", label: "Hesitações" },
                { key: "autocorrecoes", label: "Autocorreções" },
              ],
              colunas: [{ key: "frequencia", label: "Frequência", tipo: "numero" }],
            } as TabelaConfig,
          },
          { chave: "caracterizacao_modo", label: "Caracterização da leitura — modo", tipo: "multi_select", opcoes: ["Automatizada", "Lenta", "Hesitante", "Silabada"] },
          { chave: "caracterizacao_estrategia", label: "Caracterização da leitura — estratégia", tipo: "multi_select", opcoes: ["Por adivinhação", "Dependente do contexto", "Bom monitoramento", "Baixo monitoramento"] },
          { chave: "palavras_incorretas_exemplos", label: "Palavras lidas incorretamente / exemplos relevantes", tipo: "textarea" },
          { chave: "qual_silenciosa_atitude", label: "Avaliação qualitativa (leitura silenciosa) — atitude", tipo: "multi_select", opcoes: ["Boa concentração", "Dispersa-se facilmente", "Necessita de redirecionamentos", "Demonstra cansaço"] },
          { chave: "qual_silenciosa_visao", label: "Visão e musculatura ocular", tipo: "multi_select", opcoes: ["Usa óculos", "Move a cabeça lateralmente", "Pisca com frequência", "Usa apoio para acompanhar a linha", "Refere ardência/cansaço visual"] },
          { chave: "qual_silenciosa_postura", label: "Padrão postural", tipo: "multi_select", opcoes: ["Aproxima muito o texto dos olhos", "Apoia a cabeça nas mãos", "Movimenta-se excessivamente", "Mantém postura adequada"] },
          { chave: "qual_silenciosa_oralizacao", label: "Apoio articulatório / oralização", tipo: "multi_select", opcoes: ["Move silenciosamente os lábios", "Sussurra durante a leitura", "Vocaliza palavras", "Não apresenta oralização"] },
          { chave: "acuracia_oral_texto", label: "Acurácia (palavras lidas corretamente por minuto) = (palavras corretas × 60) ÷ tempo", tipo: "texto" },
          { chave: "precisao_oral", label: "Precisão (leitura oral)", tipo: "multi_select", opcoes: ["Substituições", "Omissões", "Acréscimos", "Inversões", "Hesitações", "Autocorreções"] },
          { chave: "precisao_exemplos", label: "Exemplos", tipo: "textarea" },
          { chave: "prosodia", label: "Prosódia", tipo: "multi_select", opcoes: ["Expressividade adequada", "Entonação adequada", "Leitura monótona", "Respeita a pontuação", "Ritmo adequado", "Ritmo lento", "Ritmo acelerado", "Agrupa palavras em unidades de sentido", "Pausas inadequadas"] },
          { chave: "observacoes_leitura_oral", label: "Observações (leitura oral)", tipo: "textarea" },
          { chave: "controle_leitura", label: "Controle da leitura", tipo: "multi_select", opcoes: ["Autocorreções espontâneas", "Faz perguntas/comentários", "Relê trechos espontaneamente"] },
          { chave: "observacoes_controle_leitura", label: "Observações (controle da leitura)", tipo: "textarea" },
        ],
      },
      {
        titulo: "2. Representação mental do texto",
        campos: [
          {
            chave: "reconto_quantitativo",
            label: "Reconto livre — análise quantitativa",
            tipo: "tabela",
            opcoes: {
              linhas: [
                { key: "proposicoes_simples", label: "Proposições simples" },
                { key: "proposicoes_conexao", label: "Proposições de conexão (causa-efeito, comparação, sequência etc.)" },
                { key: "total_proposicoes", label: "Total de proposições" },
              ],
              colunas: [{ key: "resultado", label: "Resultado", tipo: "numero" }],
            } as TabelaConfig,
          },
          { chave: "identifica_estrutura", label: "Paciente identifica a estrutura", tipo: "single_select", opcoes: ["Espontaneamente", "Com ajuda", "Não identifica"] },
          { chave: "estrutura_recuperada", label: "Estrutura recuperada no reconto", tipo: "multi_select", opcoes: ["Descrição", "Sequência/processo", "Comparação", "Causa-efeito", "Problema-solução"] },
          { chave: "distribuicao_informacoes", label: "Distribuição das informações recuperadas", tipo: "multi_select", opcoes: ["Predomínio de informações do início", "Predomínio de informações do meio", "Predomínio de informações do final", "Distribuição equilibrada"] },
          { chave: "relacao_estrutura", label: "Em relação à estrutura do texto", tipo: "multi_select", opcoes: ["Recupera os elementos centrais (ex.: causa e efeito; problema e solução)", "Recupera apenas parte dos elementos", "Recupera elementos isolados, sem relação com a estrutura"] },
          { chave: "recuperacao_informacoes", label: "Recuperação das informações", tipo: "multi_select", opcoes: ["Predomínio de informações centrais", "Predomínio de detalhes", "Predomínio de exemplos", "Recuperação equilibrada"] },
          { chave: "organizacao_coesao", label: "Organização do reconto — coesão/sequência", tipo: "multi_select", opcoes: ["Coeso", "Parcialmente coeso", "Fragmentado", "Sequência preservada", "Sequência parcialmente preservada", "Sequência desorganizada"] },
          { chave: "organizacao_extensao", label: "Organização do reconto — extensão", tipo: "multi_select", opcoes: ["Muito resumido", "Adequado", "Excessivamente detalhado", "Tangencial", "Acréscimo de informações não presentes no texto"] },
          {
            chave: "construcao_compreensao",
            label: "Construção da compreensão",
            tipo: "tabela",
            opcoes: {
              linhas: [
                { key: "ideias_centrais", label: "Identifica as ideias centrais que dão unidade ao texto" },
                { key: "continuidade_tematica", label: "Estabelece continuidade temática entre as ideias" },
                { key: "relaciona_ideias", label: "Relaciona as ideias entre si" },
                { key: "informacoes_isoladas", label: "Apresenta informações isoladas (efeito lista)" },
                { key: "organizacao_texto", label: "Identifica a organização do texto" },
                { key: "inferencias", label: "Realiza inferências além das informações explícitas" },
                { key: "comentarios", label: "Faz comentários pertinentes sobre o texto" },
              ],
              colunas: [{ key: "nivel", label: "Nível", tipo: "select", opcoes: ["Espontaneamente", "Com ajuda", "Não observado"] }],
            } as TabelaConfig,
          },
          { chave: "comentarios_clinicos_reconto", label: "Comentários clínicos", tipo: "textarea" },
        ],
      },
      {
        titulo: "3. Compreensão por questões",
        campos: [
          {
            chave: "questoes",
            label: "Questões (1 a 12)",
            tipo: "tabela",
            opcoes: {
              linhas: Array.from({ length: 12 }, (_, i) => ({ key: `q${i + 1}`, label: `Questão ${i + 1}` })),
              colunas: [
                { key: "categoria", label: "Cat. (E/I/OG)", tipo: "select", opcoes: ["E", "I", "OG"] },
                { key: "nivel", label: "Nível", tipo: "select", opcoes: ["1", "2", "3"] },
                { key: "resposta", label: "Resposta do paciente", tipo: "texto" },
                { key: "pontuacao", label: "Pontuação", tipo: "select", opcoes: ["0", "1", "2"] },
              ],
            } as TabelaConfig,
          },
          {
            chave: "sintese_categoria",
            label: "Síntese por categoria (E = explícita, I = implícita, OG = organização global)",
            tipo: "tabela",
            opcoes: {
              linhas: [
                { key: "explicitas", label: "Informações explícitas" },
                { key: "implicitas", label: "Informações implícitas" },
                { key: "organizacao_global", label: "Organização global" },
                { key: "total", label: "Total geral" },
              ],
              colunas: [
                { key: "acertos", label: "Acertos", tipo: "numero" },
                { key: "pontuacao", label: "Pontuação", tipo: "numero" },
              ],
            } as TabelaConfig,
          },
          {
            chave: "sintese_nivel",
            label: "Síntese por nível de processamento",
            tipo: "tabela",
            opcoes: {
              linhas: [
                { key: "nivel1", label: "Nível 1 — Acesso/recuperação" },
                { key: "nivel2", label: "Nível 2 — Integração/interpretação" },
                { key: "nivel3", label: "Nível 3 — Reflexão/avaliação" },
                { key: "total", label: "Total geral" },
              ],
              colunas: [
                { key: "acertos", label: "Acertos", tipo: "numero" },
                { key: "pontuacao", label: "Pontuação", tipo: "numero" },
              ],
            } as TabelaConfig,
          },
          { chave: "vocabulario_geral", label: "Vocabulário", tipo: "single_select", opcoes: ["Adequado", "Dificuldade lexical ocasional", "Dificuldade lexical frequente"] },
          { chave: "vocabulario_tecnico", label: "Vocabulário técnico/específico da área", tipo: "single_select", opcoes: ["Adequado", "Dificuldade ocasional", "Dificuldade frequente"] },
          { chave: "palavras_relevantes", label: "Palavras relevantes", tipo: "textarea" },
          { chave: "padrao_respostas_recuperacao", label: "Padrão de respostas — recuperação/inferência", tipo: "multi_select", opcoes: ["Localiza informações explícitas", "Recupera parcialmente informações explícitas", "Faz inferências adequadas", "Faz inferências inconsistentes", "Integra informações de diferentes trechos"] },
          { chave: "padrao_respostas_organizacao", label: "Padrão de respostas — organização/monitoramento", tipo: "multi_select", opcoes: ["Identifica a organização global", "Baseia-se excessivamente em conhecimento prévio", "Mantém interpretações equivocadas", "Revê hipóteses após releitura"] },
        ],
      },
      {
        titulo: "4. Síntese clínica",
        campos: [
          { chave: "perfil_compreensao_a", label: "Perfil de compreensão — recuperação e integração", tipo: "multi_select", opcoes: ["Recupera informações explícitas", "Recupera parcialmente informações explícitas", "Realiza inferências adequadas", "Realiza inferências inconsistentes", "Integra informações do texto", "Dificuldade de integração", "Identifica a organização global"] },
          { chave: "perfil_compreensao_b", label: "Perfil de compreensão — estrutura e monitoramento", tipo: "multi_select", opcoes: ["Dificuldade na organização global", "Reconhece a estrutura do texto expositivo", "Dificuldade em reconhecer a estrutura textual", "Monitora a compreensão", "Identifica falhas de compreensão", "Revê hipóteses após releitura", "Corrige interpretações equivocadas"] },
          { chave: "aspectos_linguisticos", label: "Aspectos linguísticos", tipo: "multi_select", opcoes: ["Vocabulário adequado", "Dificuldade lexical ocasional", "Dificuldade lexical frequente", "Dificuldade sintática", "Linguagem oral adequada", "Linguagem oral impactando a compreensão"] },
          { chave: "necessidade_investigacao", label: "Necessidade de investigação complementar", tipo: "single_select", opcoes: ["Não", "Sim"] },
          { chave: "investigacao_qual", label: "Qual investigação complementar?", tipo: "texto" },
          { chave: "aspectos_cognitivos", label: "Aspectos cognitivos possivelmente envolvidos", tipo: "multi_select", opcoes: ["Decodificação", "Fluência", "Vocabulário", "Linguagem oral", "Inferência", "Atenção", "Memória operacional", "Conhecimento prévio", "TPAC", "Funções executivas", "Outros"] },
          { chave: "hipotese_clinica", label: "Hipótese clínica predominante", tipo: "single_select", opcoes: ["Dificuldade de decodificação", "Dificuldade de fluência", "Dificuldade inferencial", "Dificuldade de construção da macroestrutura", "Dificuldade de reconhecimento da estrutura textual", "Dificuldade de monitoramento", "Dificuldade relacionada ao vocabulário", "Dificuldade relacionada à linguagem oral", "Perfil misto"] },
          { chave: "observacoes_clinicas", label: "Observações clínicas relevantes", tipo: "textarea" },
        ],
      },
    ],
  },
];
