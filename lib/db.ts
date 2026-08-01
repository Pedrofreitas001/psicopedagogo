import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * Motor SQLite — usado apenas como fallback local/demo (sem Supabase
 * configurado). Em produção (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), toda
 * a leitura/escrita passa pelo Postgres do Supabase via REST — ver lib/data.ts.
 * O schema aqui espelha supabase/schema.sql para manter os dois caminhos
 * equivalentes.
 */

export type Role = "mentora" | "participante";

let _db: Database.Database | null = null;

/**
 * Diretório gravável para o SQLite. Em serverless (Vercel) o filesystem do
 * projeto é somente leitura, então caímos para /tmp — e por isso o SQLite
 * NUNCA deve ser a persistência real em produção (cada instância pode ter um
 * /tmp diferente). Use sempre o Postgres do Supabase em produção.
 */
function resolveDataDir(): string {
  if (process.env.DB_DIR) {
    fs.mkdirSync(process.env.DB_DIR, { recursive: true });
    return process.env.DB_DIR;
  }
  const local = path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(local, { recursive: true });
    fs.accessSync(local, fs.constants.W_OK);
    return local;
  } catch {
    const tmp = path.join(os.tmpdir(), "psicopedagogo");
    fs.mkdirSync(tmp, { recursive: true });
    return tmp;
  }
}

export function uploadsDir(): string {
  const dir = path.join(resolveDataDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Versão do schema. DBs demo de versão antiga são recriados (só afeta o modo local/demo). */
const SCHEMA_VERSION = 6;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dir = resolveDataDir();
  _db = new Database(path.join(dir, "acompanhamento.db"));
  _db.pragma("journal_mode = WAL");

  const version = _db.pragma("user_version", { simple: true }) as number;
  const hasTables = !!_db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'")
    .get();
  if (hasTables && version < SCHEMA_VERSION) wipe(_db);

  migrate(_db);
  const seeded = (_db.prepare("SELECT COUNT(*) c FROM workspaces").get() as { c: number }).c > 0;
  if (!seeded) seed(_db);
  _db.pragma(`user_version = ${SCHEMA_VERSION}`);
  return _db;
}

function wipe(db: Database.Database) {
  db.pragma("foreign_keys = OFF");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t.name}`);
  db.pragma("foreign_keys = ON");
}

function migrate(db: Database.Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('mentora','participante')),
    auth_id TEXT
  );
  -- Cada participante da mentoria (a psicopedagoga em formação). user_id liga
  -- ao login (preenchido no 1º acesso) — ela usa o app diretamente.
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    user_id INTEGER REFERENCES users(id),
    nome TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    estagio_mentoria TEXT NOT NULL DEFAULT '',
    observacoes_mentora TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Um caso clínico (criança/paciente) que a participante está acompanhando
  -- fora da plataforma e analisa aqui com o apoio do agente e do protocolo.
  CREATE TABLE IF NOT EXISTS clinical_cases (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    participant_id INTEGER NOT NULL REFERENCES participants(id),
    nome TEXT NOT NULL,
    idade INTEGER,
    diagnostico_preliminar TEXT NOT NULL DEFAULT '',
    escola_serie TEXT NOT NULL DEFAULT '',
    responsavel_nome TEXT NOT NULL DEFAULT '',
    responsavel_contato TEXT NOT NULL DEFAULT '',
    queixa_principal TEXT NOT NULL DEFAULT '',
    objetivo TEXT NOT NULL DEFAULT '',
    observacoes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Pastas da biblioteca (árvore por parent_id).
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    nome TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id)
  );
  -- Documentos: com categoria_id = biblioteca (visível a todas as participantes);
  -- com case_id = arquivo daquele caso clínico (isolado).
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    categoria_id INTEGER REFERENCES categories(id),
    case_id INTEGER REFERENCES clinical_cases(id),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT '',
    tamanho INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL DEFAULT '',
    conteudo TEXT NOT NULL DEFAULT '',
    disponivel_assistente INTEGER NOT NULL DEFAULT 1,
    enviado_por TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Metodologia da mentora: a base de conhecimento em texto.
  CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Conversa com o agente: geral da participante (case_id nulo, dúvidas da
  -- semana) ou no contexto de um caso clínico específico (raciocínio guiado).
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    participant_id INTEGER NOT NULL REFERENCES participants(id),
    case_id INTEGER REFERENCES clinical_cases(id),
    titulo TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    papel TEXT NOT NULL CHECK (papel IN ('usuario','assistente')),
    autor TEXT NOT NULL DEFAULT '',
    conteudo TEXT NOT NULL,
    fontes TEXT NOT NULL DEFAULT '[]',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Linha do tempo: eventos da participante (case_id nulo) ou de um caso.
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    participant_id INTEGER NOT NULL REFERENCES participants(id),
    case_id INTEGER REFERENCES clinical_cases(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('conversa','material','observacao','resumo','sessao','protocolo','hipotese')),
    descricao TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Registros de raciocínio clínico datados por caso (o antigo "prontuário").
  CREATE TABLE IF NOT EXISTS case_notes (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    case_id INTEGER NOT NULL REFERENCES clinical_cases(id),
    data_sessao TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    criado_por TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Hipóteses clínicas formuladas para um caso — o núcleo da "memória" do
  -- agente: fica registrado o que foi levantado, com que status e por quê.
  CREATE TABLE IF NOT EXISTS hypotheses (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    case_id INTEGER NOT NULL REFERENCES clinical_cases(id),
    texto TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','confirmada','descartada')),
    evidencias_favor TEXT NOT NULL DEFAULT '',
    evidencias_contra TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Escopo/comportamento do assistente (singleton por workspace).
  CREATE TABLE IF NOT EXISTS agent_settings (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    usa_biblioteca INTEGER NOT NULL DEFAULT 1,
    usa_metodologia INTEGER NOT NULL DEFAULT 1,
    usa_historico INTEGER NOT NULL DEFAULT 1,
    usa_prontuario INTEGER NOT NULL DEFAULT 1,
    usa_protocolos INTEGER NOT NULL DEFAULT 1,
    instrucoes_extra TEXT NOT NULL DEFAULT '',
    tom TEXT NOT NULL DEFAULT 'acolhedor',
    modelo TEXT NOT NULL DEFAULT ''
  );

  -- Protocolos: modelo (template) de avaliação/atividade estruturada, com
  -- seções e campos — reutilizável para qualquer protocolo que a mentora traga.
  CREATE TABLE IF NOT EXISTS protocols (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    nome TEXT NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    versao TEXT NOT NULL DEFAULT '1',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS protocol_sections (
    id INTEGER PRIMARY KEY,
    protocol_id INTEGER NOT NULL REFERENCES protocols(id),
    ordem INTEGER NOT NULL DEFAULT 0,
    titulo TEXT NOT NULL
  );
  -- tipo: texto | textarea | numero | single_select | multi_select | tabela
  -- opcoes: JSON — array de strings (selects) ou {linhas:[{key,label}], colunas:[{key,label,tipo,opcoes?}]} (tabela)
  CREATE TABLE IF NOT EXISTS protocol_fields (
    id INTEGER PRIMARY KEY,
    section_id INTEGER NOT NULL REFERENCES protocol_sections(id),
    ordem INTEGER NOT NULL DEFAULT 0,
    chave TEXT NOT NULL,
    label TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('texto','textarea','numero','single_select','multi_select','tabela')),
    opcoes TEXT NOT NULL DEFAULT 'null'
  );
  -- Aplicação de um protocolo a um caso clínico (pode repetir o mesmo
  -- protocolo várias vezes ao longo do acompanhamento, para comparar evolução).
  CREATE TABLE IF NOT EXISTS protocol_assignments (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    case_id INTEGER NOT NULL REFERENCES clinical_cases(id),
    protocol_id INTEGER NOT NULL REFERENCES protocols(id),
    data_aplicacao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluido')),
    criado_por TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- valor: JSON — string/número (texto/numero/single_select), array de
  -- strings (multi_select), ou objeto linha->coluna->valor (tabela).
  CREATE TABLE IF NOT EXISTS protocol_responses (
    id INTEGER PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES protocol_assignments(id),
    field_id INTEGER NOT NULL REFERENCES protocol_fields(id),
    valor TEXT NOT NULL DEFAULT 'null',
    UNIQUE (assignment_id, field_id)
  );
  `);
}

function seed(db: Database.Database) {
  db.prepare("INSERT INTO workspaces (id, nome) VALUES (1, ?)").run("Comunicar & Aprender");
  db.prepare("INSERT INTO agent_settings (workspace_id) VALUES (1)").run();

  const insertUser = db.prepare("INSERT INTO users (workspace_id, nome, email, papel) VALUES (1, ?, ?, ?)");
  insertUser.run("Mariana Duarte", "mentora@espacoaprender.demo", "mentora");
  const uCamila = insertUser.run("Camila Duarte", "camila@espacoaprender.demo", "participante");
  const uRoberta = insertUser.run("Roberta Nunes", "roberta@espacoaprender.demo", "participante");

  const insertParticipant = db.prepare(
    `INSERT INTO participants (workspace_id, user_id, nome, email, estagio_mentoria, observacoes_mentora, criado_em)
     VALUES (1, ?, ?, ?, ?, ?, datetime('now','-40 days'))`
  );
  const pCamila = insertParticipant.run(
    uCamila.lastInsertRowid,
    "Camila Duarte",
    "camila@espacoaprender.demo",
    "Módulo 2 — Avaliação da compreensão leitora",
    "Já aplicou o protocolo completo em um caso. Vem construindo bem a lente de contexto; ainda apoia-se pouco na lente de processamento cognitivo."
  );
  const pRoberta = insertParticipant.run(
    uRoberta.lastInsertRowid,
    "Roberta Nunes",
    "roberta@espacoaprender.demo",
    "Módulo 1 — Fundamentos do raciocínio clínico",
    "Início de mentoria. Primeiro caso em andamento."
  );

  const insertCase = db.prepare(
    `INSERT INTO clinical_cases (workspace_id, participant_id, nome, idade, diagnostico_preliminar, escola_serie, responsavel_nome, responsavel_contato, queixa_principal, objetivo, observacoes, criado_em)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','-35 days'))`
  );
  const casoLF = insertCase.run(
    pCamila.lastInsertRowid,
    "L.F.",
    9,
    "Dislexia (laudo externo)",
    "4º ano — Escola Municipal Jardim das Flores",
    "Mãe",
    "(11) 90000-0001",
    "Dificuldade para ler em voz alta na escola; troca e omite letras na escrita.",
    "Investigar se a dificuldade de compreensão é primariamente de decodificação ou também envolve processamento inferencial.",
    "Responde bem a atividades curtas e lúdicas; fadiga em textos longos. Família participativa."
  );
  const casoMS = insertCase.run(
    pRoberta.lastInsertRowid,
    "M.S.",
    11,
    "Em investigação — possível TDAH (encaminhada para avaliação neuropsicológica)",
    "6º ano — Colégio Santa Clara",
    "Pai",
    "(11) 90000-0002",
    "Dificuldade de concentração e organização das tarefas escolares; queixa também de compreensão leitora abaixo do esperado.",
    "Diferenciar o quanto da dificuldade de compreensão decorre de atenção sustentada versus processamento da leitura em si.",
    "Em avaliação inicial. Interesses: desenho e música — bons ganchos para as atividades."
  );

  // Biblioteca: Leitura → Dislexia → Protocolos / Materiais / Referências
  const insertCat = db.prepare("INSERT INTO categories (workspace_id, nome, parent_id) VALUES (1, ?, ?)");
  const leitura = insertCat.run("Leitura", null).lastInsertRowid as number;
  const dislexia = insertCat.run("Dislexia", leitura).lastInsertRowid as number;
  const protocolos = insertCat.run("Protocolos", dislexia).lastInsertRowid as number;
  const materiais = insertCat.run("Materiais", dislexia).lastInsertRowid as number;
  const referencias = insertCat.run("Referências bibliográficas", null).lastInsertRowid as number;
  insertCat.run("Escrita", null);

  const insertDoc = db.prepare(
    "INSERT INTO documents (workspace_id, categoria_id, case_id, nome, tipo, tamanho, conteudo, enviado_por, criado_em) VALUES (1, ?, ?, ?, ?, ?, ?, 'Mariana Duarte', datetime('now', ?))"
  );
  insertDoc.run(
    protocolos, null, "Protocolo de fluência de leitura.pdf", "pdf", 245760,
    "Protocolo de fluência de leitura: começar com leitura pareada (participante e criança leem juntos em voz alta), " +
      "seguida de leitura repetida do mesmo trecho curto (3 a 4 frases) até atingir conforto. Registrar palavras por minuto " +
      "apenas como referência interna, nunca como cobrança. Sessões de 15 minutos, 3 vezes por semana.",
    "-30 days"
  );
  insertDoc.run(
    materiais, null, "Guia de consciência fonológica.docx", "docx", 182300,
    "Guia de consciência fonológica: atividades de rima, segmentação silábica com palmas, identificação do som inicial " +
      "das palavras e jogos de troca de fonema (mala → bala). Trabalhar do maior para o menor: palavra, sílaba, fonema.",
    "-28 days"
  );
  insertDoc.run(
    referencias, null, "As duas lentes do raciocínio clínico.pdf", "pdf", 131072,
    "As duas lentes do raciocínio clínico em compreensão leitora — Lente de Contexto: história da criança, contexto familiar " +
      "e escolar, oportunidades de leitura, autonomia, experiências prévias. Lente de Processamento Cognitivo: linguagem, " +
      "vocabulário, fluência, memória, funções executivas, inferência, compreensão, processamento da leitura. Uma hipótese " +
      "clínica consistente cruza as duas lentes — nunca se apoia em uma só.",
    "-21 days"
  );

  const insertKnow = db.prepare("INSERT INTO knowledge (workspace_id, titulo, conteudo) VALUES (1, ?, ?)");
  insertKnow.run(
    "Como o agente conduz o raciocínio",
    "O agente não responde diretamente às observações da participante. Ele conduz por perguntas seguindo as etapas do método: " +
      "organização dos dados, identificação de lacunas, análise pelas duas lentes (contexto e processamento cognitivo), " +
      "construção de hipóteses, busca de evidências e tomada de decisão clínica. Nunca emite diagnóstico nem confirma " +
      "conclusões clínicas — o julgamento final é sempre da participante."
  );
  insertKnow.run(
    "Princípios com dislexia",
    "Com crianças com dislexia: instrução explícita e sistemática de consciência fonológica, sessões curtas e frequentes, " +
      "multissensorialidade (ver, ouvir, tocar, escrever), e proteção da autoestima — o erro é informação, não falha."
  );
  insertKnow.run(
    "O papel do protocolo na mentoria",
    "O protocolo não é apenas um formulário — é o principal instrumento de aprendizagem da mentoria. Cada seção existe para " +
      "sustentar uma decisão clínica específica. A participante deve preencher o protocolo antes dos encontros; o agente " +
      "ajuda a organizar o raciocínio a partir do que já foi preenchido, nunca preenche por ela."
  );

  // Caso L.F. (Camila): conversa socrática + evento + registro de raciocínio + hipótese
  const convLF = db
    .prepare("INSERT INTO conversations (workspace_id, participant_id, case_id, titulo, criado_em) VALUES (1, ?, ?, ?, datetime('now','-3 days'))")
    .run(pCamila.lastInsertRowid, casoLF.lastInsertRowid, "Compreensão inferencial abaixo do esperado");
  const insertMsg = db.prepare(
    "INSERT INTO messages (conversation_id, papel, autor, conteudo, fontes, criado_em) VALUES (?, ?, ?, ?, ?, datetime('now','-3 days'))"
  );
  insertMsg.run(
    convLF.lastInsertRowid, "usuario", "Camila Duarte",
    "Observei que o L.F. tem baixa compreensão inferencial no protocolo de leitura.",
    "[]"
  );
  insertMsg.run(
    convLF.lastInsertRowid, "assistente", "Mentor Clínico",
    "Antes de avançarmos para essa leitura, vamos organizar o que você já tem. Como estava a fluência dele nas questões " +
      "de leitura em voz alta — a dificuldade parece estar na decodificação ou ele lê com desenvoltura e a dificuldade " +
      "aparece só na compreensão?\n\nPergunto isso porque compreensão inferencial fraca pode ter origens bem diferentes: " +
      "às vezes é consequência de esforço excessivo na decodificação (a lente de processamento cognitivo), às vezes é uma " +
      "questão de repertório e experiência com o tipo de texto (a lente de contexto). Isolar isso primeiro muda que hipótese " +
      "faz sentido perseguir.",
    JSON.stringify([{ tipo: "protocolo", titulo: "Painel geral do leitor — L.F." }, { tipo: "documento", titulo: "As duas lentes do raciocínio clínico.pdf" }])
  );

  const insertEvent = db.prepare(
    "INSERT INTO events (workspace_id, participant_id, case_id, tipo, descricao, criado_em) VALUES (1, ?, ?, ?, ?, datetime('now', ?))"
  );
  insertEvent.run(pCamila.lastInsertRowid, casoLF.lastInsertRowid, "conversa", "Camila discutiu com o agente a compreensão inferencial de L.F.", "-3 days");
  insertEvent.run(pCamila.lastInsertRowid, casoLF.lastInsertRowid, "sessao", "Registro de raciocínio clínico adicionado ao caso.", "-1 days");

  db.prepare(
    "INSERT INTO case_notes (workspace_id, case_id, data_sessao, conteudo, criado_por, criado_em) VALUES (1, ?, date('now','-1 days'), ?, 'Camila Duarte', datetime('now','-1 days'))"
  ).run(
    casoLF.lastInsertRowid,
    "Reaplicação da leitura em voz alta: fluência adequada para a idade, sem trocas relevantes. A dificuldade concentrou-se " +
      "nas questões de nível 2 (integração/interpretação) — L.F. localiza informação explícita sem esforço, mas erra ao " +
      "conectar duas partes do texto. Hipótese de que o gargalo está mais em processamento do que em decodificação."
  );

  db.prepare(
    `INSERT INTO hypotheses (workspace_id, case_id, texto, status, evidencias_favor, evidencias_contra, criado_em, atualizado_em)
     VALUES (1, ?, ?, 'ativa', ?, ?, datetime('now','-1 days'), datetime('now','-1 days'))`
  ).run(
    casoLF.lastInsertRowid,
    "A dificuldade de compreensão de L.F. é predominantemente de integração/inferência, não de decodificação.",
    "Fluência e acurácia de leitura adequadas para a idade; acertos consistentes em questões de informação explícita.",
    "Ainda não há dado sobre vocabulário nem sobre conhecimento prévio do tema do texto usado — pode estar mascarando uma dificuldade de repertório."
  );
}
