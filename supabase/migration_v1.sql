-- Migração aditiva para o projeto Supabase já criado a partir de supabase/schema.sql.
-- Segura para rodar mesmo com dados existentes — só adiciona colunas/tabelas.
-- Rode no SQL Editor do Supabase (Project → SQL Editor → New query → colar e Run).

-- ---------------------------------------------------------------------------
-- 1. Ficha de cliente mais completa
-- ---------------------------------------------------------------------------
alter table clients add column if not exists idade integer;
alter table clients add column if not exists diagnostico_preliminar text not null default '';
alter table clients add column if not exists escola_serie text not null default '';
alter table clients add column if not exists responsavel_nome text not null default '';
alter table clients add column if not exists responsavel_contato text not null default '';
alter table clients add column if not exists queixa_principal text not null default '';

-- ---------------------------------------------------------------------------
-- 2. Checagem de disponibilidade do documento para o assistente
-- ---------------------------------------------------------------------------
alter table documents add column if not exists disponivel_assistente boolean not null default true;

-- ---------------------------------------------------------------------------
-- 3. Linha do tempo: novo tipo de evento "sessao"
-- ---------------------------------------------------------------------------
alter table events drop constraint if exists events_tipo_check;
alter table events add constraint events_tipo_check
  check (tipo in ('conversa','material','observacao','resumo','sessao'));

-- ---------------------------------------------------------------------------
-- 4. Prontuário: notas de sessão datadas por cliente
-- ---------------------------------------------------------------------------
create table if not exists session_notes (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  client_id bigint not null references clients(id),
  data_sessao date not null,
  conteudo text not null,
  criado_por text not null default '',
  criado_em timestamptz not null default now()
);
alter table session_notes enable row level security;

drop policy if exists mentora_all_session_notes on session_notes;
create policy mentora_all_session_notes on session_notes for all using (is_mentora());

drop policy if exists cliente_session_notes on session_notes;
create policy cliente_session_notes on session_notes for select using (client_id = current_client_id());

-- ---------------------------------------------------------------------------
-- 5. Escopo/comportamento do assistente (singleton por workspace)
-- ---------------------------------------------------------------------------
create table if not exists agent_settings (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id) unique,
  usa_biblioteca boolean not null default true,
  usa_metodologia boolean not null default true,
  usa_historico boolean not null default true,
  usa_prontuario boolean not null default true,
  instrucoes_extra text not null default '',
  tom text not null default 'acolhedor'
);
alter table agent_settings enable row level security;

drop policy if exists mentora_all_agent_settings on agent_settings;
create policy mentora_all_agent_settings on agent_settings for all using (is_mentora());

-- A aplicação cria a linha padrão (workspace_id = 1) sozinha no primeiro
-- acesso a Configurações, mas inserir aqui evita qualquer corrida:
insert into agent_settings (workspace_id)
  select 1 where not exists (select 1 from agent_settings where workspace_id = 1);
