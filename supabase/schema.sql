-- Schema de produção (Supabase Postgres) — espelho do SQLite do MVP.
-- Isolamento por usuário com Row Level Security:
--   · a mentora enxerga tudo do workspace;
--   · o cliente enxerga apenas o próprio registro, seus documentos,
--     suas conversas e sua linha do tempo (+ a biblioteca compartilhada).

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
  tipo text not null check (tipo in ('conversa','material','observacao','resumo')),
  descricao text not null,
  criado_em timestamptz not null default now()
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

-- Storage: bucket privado `documentos` (downloads via URL assinada no servidor)
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);
