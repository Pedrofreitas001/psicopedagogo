-- Schema de produção (Supabase Postgres) — usado via REST/PostgREST por
-- lib/data.ts (service_role key, ignora RLS por design; a autorização real
-- acontece nas rotas de app/api/*). O RLS abaixo é defesa em profundidade.
--
-- Instalação nova: rode este arquivo inteiro.
-- Projeto já existente (rodou uma versão anterior deste schema): rode
-- supabase/migration_v1.sql, depois migration_v2.sql, depois migration_v3.sql
-- em vez deste arquivo — cada um só adiciona/ajusta o que falta.

create table workspaces (
  id bigint generated always as identity primary key,
  nome text not null,
  criado_em timestamptz not null default now()
);

create table users (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  nome text not null,
  email text not null,
  papel text not null check (papel in ('mentora','participante')),
  auth_id uuid unique references auth.users(id)
);

-- Cada participante da mentoria (a psicopedagoga em formação). user_id liga
-- ao login (preenchido no 1º acesso) — ela usa o app diretamente.
create table participants (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  user_id bigint references users(id),
  nome text not null,
  email text not null default '',
  estagio_mentoria text not null default '',
  observacoes_mentora text not null default '',
  criado_em timestamptz not null default now()
);

-- Um caso clínico (criança/paciente) que a participante está acompanhando
-- fora da plataforma e analisa aqui com o apoio do agente e do protocolo.
create table clinical_cases (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  participant_id bigint not null references participants(id),
  nome text not null,
  idade integer,
  diagnostico_preliminar text not null default '',
  escola_serie text not null default '',
  responsavel_nome text not null default '',
  responsavel_contato text not null default '',
  queixa_principal text not null default '',
  objetivo text not null default '',
  observacoes text not null default '',
  status text not null default 'ativo' check (status in ('ativo','encerrado')),
  criado_em timestamptz not null default now()
);

create table categories (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  nome text not null,
  parent_id bigint references categories(id)
);

-- Documentos: com categoria_id = biblioteca (visível a todas as participantes);
-- com case_id = arquivo daquele caso clínico (isolado).
create table documents (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  categoria_id bigint references categories(id),
  case_id bigint references clinical_cases(id),
  nome text not null,
  tipo text not null default '',
  tamanho bigint not null default 0,
  storage_path text not null default '',
  conteudo text not null default '',
  disponivel_assistente boolean not null default true,
  enviado_por text not null default '',
  criado_em timestamptz not null default now()
);

create table knowledge (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  titulo text not null,
  conteudo text not null,
  atualizado_em timestamptz not null default now()
);

-- Conversa com o agente: geral da participante (case_id nulo, dúvidas da
-- semana) ou no contexto de um caso clínico específico (raciocínio guiado).
create table conversations (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  participant_id bigint not null references participants(id),
  case_id bigint references clinical_cases(id),
  titulo text not null default '',
  criado_em timestamptz not null default now()
);

create table messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references conversations(id),
  papel text not null check (papel in ('usuario','assistente')),
  autor text not null default '',
  conteudo text not null,
  fontes jsonb not null default '[]',
  criado_em timestamptz not null default now()
);

-- Linha do tempo: eventos da participante (case_id nulo) ou de um caso.
create table events (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  participant_id bigint not null references participants(id),
  case_id bigint references clinical_cases(id),
  tipo text not null check (tipo in ('conversa','material','observacao','resumo','sessao','protocolo','hipotese')),
  descricao text not null,
  criado_em timestamptz not null default now()
);

-- Registros de raciocínio clínico datados por caso (o antigo "prontuário").
create table case_notes (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  case_id bigint not null references clinical_cases(id),
  data_sessao date not null,
  conteudo text not null,
  criado_por text not null default '',
  criado_em timestamptz not null default now()
);

-- Hipóteses clínicas formuladas para um caso — o núcleo da "memória" do
-- agente: fica registrado o que foi levantado, com que status e por quê.
create table hypotheses (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  case_id bigint not null references clinical_cases(id),
  texto text not null,
  status text not null default 'ativa' check (status in ('ativa','confirmada','descartada')),
  evidencias_favor text not null default '',
  evidencias_contra text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Escopo/comportamento do assistente (singleton por workspace).
create table agent_settings (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id) unique,
  usa_biblioteca boolean not null default true,
  usa_metodologia boolean not null default true,
  usa_historico boolean not null default true,
  usa_prontuario boolean not null default true,
  usa_protocolos boolean not null default true,
  instrucoes_extra text not null default '',
  tom text not null default 'acolhedor',
  modelo text not null default ''
);

-- Protocolos: modelo (template) de avaliação/atividade estruturada, com
-- seções e campos — reutilizável para qualquer protocolo internalizado.
create table protocols (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  nome text not null,
  descricao text not null default '',
  versao text not null default '1',
  criado_em timestamptz not null default now()
);

create table protocol_sections (
  id bigint generated always as identity primary key,
  protocol_id bigint not null references protocols(id),
  ordem integer not null default 0,
  titulo text not null
);

-- tipo: texto | textarea | numero | single_select | multi_select | tabela
-- opcoes: jsonb — array de strings (selects) ou {linhas:[{key,label}], colunas:[{key,label,tipo,opcoes?}]} (tabela)
create table protocol_fields (
  id bigint generated always as identity primary key,
  section_id bigint not null references protocol_sections(id),
  ordem integer not null default 0,
  chave text not null,
  label text not null,
  tipo text not null check (tipo in ('texto','textarea','numero','single_select','multi_select','tabela')),
  opcoes jsonb not null default 'null'
);

-- Aplicação de um protocolo a um caso clínico (pode repetir o mesmo
-- protocolo várias vezes ao longo do acompanhamento, para comparar evolução).
create table protocol_assignments (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  case_id bigint not null references clinical_cases(id),
  protocol_id bigint not null references protocols(id),
  data_aplicacao date not null,
  status text not null default 'em_andamento' check (status in ('em_andamento','concluido')),
  criado_por text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- valor: jsonb — string/número (texto/numero/single_select), array de
-- strings (multi_select), ou objeto linha->coluna->valor (tabela).
create table protocol_responses (
  id bigint generated always as identity primary key,
  assignment_id bigint not null references protocol_assignments(id),
  field_id bigint not null references protocol_fields(id),
  valor jsonb not null default 'null',
  unique (assignment_id, field_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table users enable row level security;
alter table participants enable row level security;
alter table clinical_cases enable row level security;
alter table categories enable row level security;
alter table documents enable row level security;
alter table knowledge enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table events enable row level security;
alter table case_notes enable row level security;
alter table hypotheses enable row level security;
alter table agent_settings enable row level security;
alter table protocols enable row level security;
alter table protocol_sections enable row level security;
alter table protocol_fields enable row level security;
alter table protocol_assignments enable row level security;
alter table protocol_responses enable row level security;

create or replace function current_app_user_id() returns bigint
language sql stable security definer as
$$ select id from users where auth_id = auth.uid() $$;

create or replace function is_mentora() returns boolean
language sql stable security definer as
$$ select exists (select 1 from users where auth_id = auth.uid() and papel = 'mentora') $$;

create or replace function current_participant_id() returns bigint
language sql stable security definer as
$$ select p.id from participants p join users u on u.id = p.user_id where u.auth_id = auth.uid() $$;

create or replace function current_participant_case_ids() returns setof bigint
language sql stable security definer as
$$ select id from clinical_cases where participant_id = current_participant_id() $$;

-- Mentora: acesso total às tabelas do workspace
create policy mentora_all_users on users for all using (is_mentora());
create policy mentora_all_participants on participants for all using (is_mentora());
create policy mentora_all_clinical_cases on clinical_cases for all using (is_mentora());
create policy mentora_all_categories on categories for all using (is_mentora());
create policy mentora_all_documents on documents for all using (is_mentora());
create policy mentora_all_knowledge on knowledge for all using (is_mentora());
create policy mentora_all_conversations on conversations for all using (is_mentora());
create policy mentora_all_messages on messages for all using (is_mentora());
create policy mentora_all_events on events for all using (is_mentora());
create policy mentora_all_case_notes on case_notes for all using (is_mentora());
create policy mentora_all_hypotheses on hypotheses for all using (is_mentora());
create policy mentora_all_agent_settings on agent_settings for all using (is_mentora());
create policy mentora_all_protocols on protocols for all using (is_mentora());
create policy mentora_all_protocol_sections on protocol_sections for all using (is_mentora());
create policy mentora_all_protocol_fields on protocol_fields for all using (is_mentora());
create policy mentora_all_protocol_assignments on protocol_assignments for all using (is_mentora());
create policy mentora_all_protocol_responses on protocol_responses for all using (is_mentora());

-- Participante: apenas os próprios casos + biblioteca compartilhada
create policy participante_self on users for select using (auth_id = auth.uid());
create policy participante_own_record on participants for select using (id = current_participant_id());
create policy participante_own_cases on clinical_cases for select using (participant_id = current_participant_id());
create policy participante_new_case on clinical_cases for insert with check (participant_id = current_participant_id());
create policy participante_update_case on clinical_cases for update using (participant_id = current_participant_id());
create policy participante_categories on categories for select using (true);
create policy participante_documents on documents for select
  using (categoria_id is not null or case_id in (select current_participant_case_ids()));
create policy participante_upload on documents for insert
  with check (categoria_id is null and case_id in (select current_participant_case_ids()));
create policy participante_conversations on conversations for select using (participant_id = current_participant_id());
create policy participante_new_conversation on conversations for insert with check (participant_id = current_participant_id());
create policy participante_messages on messages for select
  using (conversation_id in (select id from conversations where participant_id = current_participant_id()));
create policy participante_new_message on messages for insert
  with check (conversation_id in (select id from conversations where participant_id = current_participant_id()));
create policy participante_events on events for select using (participant_id = current_participant_id());
create policy participante_case_notes on case_notes for select using (case_id in (select current_participant_case_ids()));
create policy participante_new_case_notes on case_notes for insert with check (case_id in (select current_participant_case_ids()));
create policy participante_hypotheses on hypotheses for select using (case_id in (select current_participant_case_ids()));
create policy participante_new_hypotheses on hypotheses for insert with check (case_id in (select current_participant_case_ids()));
create policy participante_update_hypotheses on hypotheses for update using (case_id in (select current_participant_case_ids()));
create policy participante_protocol_assignments on protocol_assignments for select using (case_id in (select current_participant_case_ids()));
create policy participante_new_protocol_assignments on protocol_assignments for insert with check (case_id in (select current_participant_case_ids()));
create policy participante_update_protocol_assignments on protocol_assignments for update using (case_id in (select current_participant_case_ids()));
create policy participante_protocols on protocols for select using (true);
create policy participante_protocol_sections on protocol_sections for select using (true);
create policy participante_protocol_fields on protocol_fields for select using (true);
create policy participante_protocol_responses on protocol_responses for select
  using (assignment_id in (select id from protocol_assignments where case_id in (select current_participant_case_ids())));
create policy participante_new_protocol_responses on protocol_responses for insert
  with check (assignment_id in (select id from protocol_assignments where case_id in (select current_participant_case_ids())));
create policy participante_knowledge on knowledge for select using (true);

-- Storage: bucket privado `documentos` (downloads via URL assinada no servidor)
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);

-- Workspace padrão — toda a aplicação assume workspace_id = 1. Como esta é a
-- primeira linha de uma tabela recém-criada, o id gerado automaticamente é 1.
insert into workspaces (nome) values ('Comunicar & Aprender');
