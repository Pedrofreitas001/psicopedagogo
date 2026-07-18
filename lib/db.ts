import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * Camada de persistência do MVP.
 *
 * SQLite para rodar sem infraestrutura externa; o schema espelha o Postgres
 * do Supabase (ver supabase/schema.sql) para que a migração com Row Level
 * Security seja 1:1 — todo dado sensível carrega workspace_id e os dados de
 * cliente carregam client_id, que é a chave do isolamento por usuário.
 */

export type Role = "mentora" | "cliente";

let _db: Database.Database | null = null;

/**
 * Diretório gravável para o SQLite. Em serverless (Vercel) o filesystem do
 * projeto é somente leitura, então caímos para /tmp — o banco demo é
 * ressemeado a cada cold start (persistência real: Supabase Postgres).
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

/** Versão do schema. DBs demo de versão antiga são recriados. */
const SCHEMA_VERSION = 2;

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
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t.name}`);
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
    papel TEXT NOT NULL CHECK (papel IN ('mentora','cliente')),
    auth_id TEXT
  );
  -- Cada cliente acompanhado. user_id liga ao login (preenchido no 1º acesso).
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    user_id INTEGER REFERENCES users(id),
    nome TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    objetivo TEXT NOT NULL DEFAULT '',
    observacoes TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Pastas da biblioteca (árvore por parent_id).
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    nome TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id)
  );
  -- Documentos: com categoria_id = biblioteca (visível aos clientes);
  -- com client_id = arquivo daquele cliente (isolado).
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    categoria_id INTEGER REFERENCES categories(id),
    client_id INTEGER REFERENCES clients(id),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT '',
    tamanho INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL DEFAULT '',
    conteudo TEXT NOT NULL DEFAULT '',
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
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
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
  -- Linha do tempo do acompanhamento (preenchida automaticamente).
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('conversa','material','observacao','resumo')),
    descricao TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `);
}

export function logEvent(clientId: number, tipo: "conversa" | "material" | "observacao" | "resumo", descricao: string) {
  getDb()
    .prepare("INSERT INTO events (workspace_id, client_id, tipo, descricao) VALUES (1, ?, ?, ?)")
    .run(clientId, tipo, descricao);
}

function seed(db: Database.Database) {
  db.prepare("INSERT INTO workspaces (id, nome) VALUES (1, ?)").run("Espaço Aprender");

  const insertUser = db.prepare("INSERT INTO users (workspace_id, nome, email, papel) VALUES (1, ?, ?, ?)");
  insertUser.run("Mariana Duarte", "mentora@espacoaprender.demo", "mentora");
  const uPedro = insertUser.run("Pedro", "pedro@espacoaprender.demo", "cliente");
  const uLuisa = insertUser.run("Luísa", "luisa@espacoaprender.demo", "cliente");

  const insertClient = db.prepare(
    "INSERT INTO clients (workspace_id, user_id, nome, email, objetivo, observacoes, criado_em) VALUES (1, ?, ?, ?, ?, ?, datetime('now','-40 days'))"
  );
  const cPedro = insertClient.run(
    uPedro.lastInsertRowid,
    "Pedro",
    "pedro@espacoaprender.demo",
    "Desenvolver fluência e compreensão de leitura, com mais autonomia nas atividades escolares.",
    "Diagnóstico de dislexia (laudo externo). Responde bem a atividades curtas e lúdicas; fadiga em textos longos. Família participativa."
  );
  insertClient.run(
    uLuisa.lastInsertRowid,
    "Luísa",
    "luisa@espacoaprender.demo",
    "Fortalecer a atenção sustentada e a organização das rotinas de estudo.",
    "Em avaliação inicial. Interesses: desenho e música — bons ganchos para as atividades."
  );

  // Biblioteca: Leitura → Dislexia → Protocolos / Materiais / Exercícios
  const insertCat = db.prepare("INSERT INTO categories (workspace_id, nome, parent_id) VALUES (1, ?, ?)");
  const leitura = insertCat.run("Leitura", null).lastInsertRowid as number;
  const dislexia = insertCat.run("Dislexia", leitura).lastInsertRowid as number;
  const protocolos = insertCat.run("Protocolos", dislexia).lastInsertRowid as number;
  const materiais = insertCat.run("Materiais", dislexia).lastInsertRowid as number;
  const exercicios = insertCat.run("Exercícios", dislexia).lastInsertRowid as number;
  insertCat.run("Escrita", null);
  insertCat.run("Atenção e Rotina", null);

  const insertDoc = db.prepare(
    "INSERT INTO documents (workspace_id, categoria_id, client_id, nome, tipo, tamanho, conteudo, enviado_por, criado_em) VALUES (1, ?, ?, ?, ?, ?, ?, 'Mariana Duarte', datetime('now', ?))"
  );
  insertDoc.run(
    protocolos, null, "Protocolo de fluência de leitura.pdf", "pdf", 245760,
    "Protocolo de fluência de leitura: começar com leitura pareada (mentora e cliente leem juntos em voz alta), " +
      "seguida de leitura repetida do mesmo trecho curto (3 a 4 frases) até atingir conforto. Registrar palavras por minuto " +
      "apenas como referência interna, nunca como cobrança. Sessões de 15 minutos, 3 vezes por semana. Avançar de nível " +
      "somente quando a leitura estiver fluida e sem tensão. Em caso de erro, modelar a palavra com calma e retomar a frase inteira.",
    "-30 days"
  );
  insertDoc.run(
    materiais, null, "Guia de consciência fonológica.docx", "docx", 182300,
    "Guia de consciência fonológica: atividades de rima (identificar e produzir rimas com apoio de imagens), " +
      "segmentação silábica com palmas, identificação do som inicial das palavras e jogos de troca de fonema " +
      "(mala → bala). Trabalhar do maior para o menor: palavra, sílaba, fonema. Usar sempre material concreto e lúdico " +
      "antes do registro escrito.",
    "-28 days"
  );
  insertDoc.run(
    exercicios, null, "Exercícios de compreensão textual.pdf", "pdf", 131072,
    "Exercícios de compreensão textual: antes da leitura, levantar hipóteses a partir do título e das imagens. " +
      "Durante a leitura, pausar ao fim de cada parágrafo e pedir que o cliente conte com as próprias palavras o que entendeu. " +
      "Depois, perguntas em três níveis: literal (o que aconteceu), inferencial (por que aconteceu) e crítico (o que você faria). " +
      "Estratégias metacognitivas: ensinar o cliente a perceber quando não entendeu e a voltar no texto por conta própria.",
    "-21 days"
  );
  insertDoc.run(
    exercicios, null, "Atividade — leitura compartilhada.pptx", "pptx", 96500,
    "Atividade de leitura compartilhada para casa: escolher um texto curto do interesse do cliente, ler em dupla com um adulto " +
      "alternando parágrafos, e conversar sobre a história ao final. Duração sugerida: 10 minutos, sem correções durante a leitura.",
    "-2 days"
  );

  const insertKnow = db.prepare("INSERT INTO knowledge (workspace_id, titulo, conteudo) VALUES (1, ?, ?)");
  insertKnow.run(
    "Abordagem do acompanhamento",
    "O acompanhamento psicopedagógico parte sempre das potencialidades do cliente, nunca das faltas. Cada plano é individual, " +
      "construído a partir da avaliação inicial e revisto a cada ciclo de 8 encontros. A tecnologia e os materiais são apoio à " +
      "metodologia — o vínculo entre mentora, cliente e família é o centro do trabalho. O assistente não substitui a mentora: " +
      "orienta com base nos materiais e no histórico, e encaminha para a mentora tudo o que exigir avaliação clínica."
  );
  insertKnow.run(
    "Princípios com dislexia",
    "Com clientes com dislexia: instrução explícita e sistemática de consciência fonológica, sessões curtas e frequentes, " +
      "multissensorialidade (ver, ouvir, tocar, escrever), e proteção da autoestima — o erro é informação, não falha. " +
      "Evitar leitura em voz alta diante de turma sem preparo prévio. Celebrar progresso relativo ao próprio cliente."
  );
  insertKnow.run(
    "Rotina de estudos em casa",
    "Rotina de estudos recomendada: blocos curtos de 15 a 20 minutos com pausas, sempre no mesmo horário, ambiente com poucos " +
      "estímulos visuais, e um combinado visível (checklist) do que será feito. A família acompanha sem fazer pelo cliente. " +
      "Terminar sempre com uma atividade em que o cliente se sinta competente."
  );

  // Histórico demo do Pedro: conversa + eventos, como no roteiro do produto
  const conv = db
    .prepare("INSERT INTO conversations (workspace_id, client_id, titulo, criado_em) VALUES (1, ?, ?, datetime('now','-3 days'))")
    .run(cPedro.lastInsertRowid, "Dificuldade com leitura em voz alta");
  const insertMsg = db.prepare(
    "INSERT INTO messages (conversation_id, papel, autor, conteudo, fontes, criado_em) VALUES (?, ?, ?, ?, ?, datetime('now','-3 days'))"
  );
  insertMsg.run(
    conv.lastInsertRowid, "usuario", "Pedro",
    "Tenho vergonha de ler em voz alta na escola. Tem alguma coisa que eu possa treinar em casa?",
    "[]"
  );
  insertMsg.run(
    conv.lastInsertRowid, "assistente", "Assistente de Estudos",
    "Sim! Pela metodologia da sua mentora, um bom caminho é a leitura pareada: você lê junto com um adulto, em voz alta, " +
      "um trecho curto — e repete o mesmo trecho até ficar confortável. São 15 minutos, sem pressa e sem cobrança. " +
      "O material \"Protocolo de fluência de leitura\" da sua biblioteca explica o passo a passo. Que tal combinar com sua " +
      "família um horário fixo para treinar 3 vezes por semana?",
    JSON.stringify([{ tipo: "documento", titulo: "Protocolo de fluência de leitura.pdf" }, { tipo: "metodologia", titulo: "Princípios com dislexia" }])
  );

  const insertEvent = db.prepare(
    "INSERT INTO events (workspace_id, client_id, tipo, descricao, criado_em) VALUES (1, ?, ?, ?, datetime('now', ?))"
  );
  insertEvent.run(cPedro.lastInsertRowid, "conversa", "Pedro perguntou ao assistente sobre leitura em voz alta.", "-3 days");
  insertEvent.run(cPedro.lastInsertRowid, "material", "Mariana enviou a atividade \"Leitura compartilhada\" para casa.", "-2 days");
  insertEvent.run(cPedro.lastInsertRowid, "observacao", "Sessão presencial: leitura pareada com menos tensão; Pedro pediu para reler o trecho sozinho.", "-1 days");
}
