-- Schema de produção (Supabase Postgres) — usado via REST/PostgREST por
-- lib/data.ts (service_role key, ignora RLS por design; a autorização real
-- acontece nas rotas de app/api/*). O RLS abaixo é defesa em profundidade.
--
-- Instalação nova: rode este arquivo inteiro.
-- Projeto já existente (rodou uma versão anterior deste schema): rode
-- supabase/migration_v1.sql em vez deste arquivo — ele só adiciona o que
-- falta, sem recriar tabelas.

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
  papel text not null check (papel in ('mentora','cliente')),
  auth_id uuid unique references auth.users(id)
);

create table clients (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  user_id bigint references users(id),
  nome text not null,
  email text not null default '',
  objetivo text not null default '',
  observacoes text not null default '',
  idade integer,
  diagnostico_preliminar text not null default '',
  escola_serie text not null default '',
  responsavel_nome text not null default '',
  responsavel_contato text not null default '',
  queixa_principal text not null default '',
  criado_em timestamptz not null default now()
);

create table categories (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  nome text not null,
  parent_id bigint references categories(id)
);

create table documents (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  categoria_id bigint references categories(id),
  client_id bigint references clients(id),
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

create table conversations (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  client_id bigint not null references clients(id),
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

create table events (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  client_id bigint not null references clients(id),
  tipo text not null check (tipo in ('conversa','material','observacao','resumo','sessao')),
  descricao text not null,
  criado_em timestamptz not null default now()
);

-- Prontuário: notas de sessão datadas por cliente.
create table session_notes (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  client_id bigint not null references clients(id),
  data_sessao date not null,
  conteudo text not null,
  criado_por text not null default '',
  criado_em timestamptz not null default now()
);

-- Escopo/comportamento do assistente (singleton por workspace).
create table agent_settings (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id) unique,
  usa_biblioteca boolean not null default true,
  usa_metodologia boolean not null default true,
  usa_historico boolean not null default true,
  usa_prontuario boolean not null default true,
  instrucoes_extra text not null default '',
  tom text not null default 'acolhedor'
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table users enable row level security;
alter table clients enable row level security;
alter table categories enable row level security;
alter table documents enable row level security;
alter table knowledge enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table events enable row level security;
alter table session_notes enable row level security;
alter table agent_settings enable row level security;

create or replace function current_app_user_id() returns bigint
language sql stable security definer as
$$ select id from users where auth_id = auth.uid() $$;

create or replace function is_mentora() returns boolean
language sql stable security definer as
$$ select exists (select 1 from users where auth_id = auth.uid() and papel = 'mentora') $$;

create or replace function current_client_id() returns bigint
language sql stable security definer as
$$ select c.id from clients c join users u on u.id = c.user_id where u.auth_id = auth.uid() $$;

-- Mentora: acesso total às tabelas do workspace
create policy mentora_all_users on users for all using (is_mentora());
create policy mentora_all_clients on clients for all using (is_mentora());
create policy mentora_all_categories on categories for all using (is_mentora());
create policy mentora_all_documents on documents for all using (is_mentora());
create policy mentora_all_knowledge on knowledge for all using (is_mentora());
create policy mentora_all_conversations on conversations for all using (is_mentora());
create policy mentora_all_messages on messages for all using (is_mentora());
create policy mentora_all_events on events for all using (is_mentora());
create policy mentora_all_session_notes on session_notes for all using (is_mentora());
create policy mentora_all_agent_settings on agent_settings for all using (is_mentora());

-- Cliente: apenas o que é dele + biblioteca compartilhada
create policy cliente_self on users for select using (auth_id = auth.uid());
create policy cliente_own_record on clients for select using (id = current_client_id());
create policy cliente_categories on categories for select using (true);
create policy cliente_documents on documents for select
  using (categoria_id is not null or client_id = current_client_id());
create policy cliente_upload on documents for insert
  with check (categoria_id is null and client_id = current_client_id());
create policy cliente_conversations on conversations for select using (client_id = current_client_id());
create policy cliente_new_conversation on conversations for insert with check (client_id = current_client_id());
create policy cliente_messages on messages for select
  using (conversation_id in (select id from conversations where client_id = current_client_id()));
create policy cliente_new_message on messages for insert
  with check (conversation_id in (select id from conversations where client_id = current_client_id()));
create policy cliente_events on events for select using (client_id = current_client_id());
create policy cliente_session_notes on session_notes for select using (client_id = current_client_id());

-- Storage: bucket privado `documentos` (downloads via URL assinada no servidor)
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);
