-- Migração aditiva v2: modelo de IA editável + módulo de Protocolos.
-- Segura para rodar mesmo com dados existentes — só adiciona colunas/tabelas.
-- Rode no SQL Editor do Supabase (Project → SQL Editor → New query → colar e Run).

-- ---------------------------------------------------------------------------
-- 1. Modelo de IA editável + toggle de protocolos em agent_settings
-- ---------------------------------------------------------------------------
alter table agent_settings add column if not exists modelo text not null default '';
alter table agent_settings add column if not exists usa_protocolos boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Linha do tempo: novo tipo de evento "protocolo"
-- ---------------------------------------------------------------------------
alter table events drop constraint if exists events_tipo_check;
alter table events add constraint events_tipo_check
  check (tipo in ('conversa','material','observacao','resumo','sessao','protocolo'));

-- ---------------------------------------------------------------------------
-- 3. Módulo de Protocolos
-- ---------------------------------------------------------------------------
create table if not exists protocols (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  nome text not null,
  descricao text not null default '',
  versao text not null default '1',
  criado_em timestamptz not null default now()
);

create table if not exists protocol_sections (
  id bigint generated always as identity primary key,
  protocol_id bigint not null references protocols(id),
  ordem integer not null default 0,
  titulo text not null
);

create table if not exists protocol_fields (
  id bigint generated always as identity primary key,
  section_id bigint not null references protocol_sections(id),
  ordem integer not null default 0,
  chave text not null,
  label text not null,
  tipo text not null check (tipo in ('texto','textarea','numero','single_select','multi_select','tabela')),
  opcoes jsonb not null default 'null'
);

create table if not exists protocol_assignments (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references workspaces(id),
  client_id bigint not null references clients(id),
  protocol_id bigint not null references protocols(id),
  data_aplicacao date not null,
  status text not null default 'em_andamento' check (status in ('em_andamento','concluido')),
  criado_por text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists protocol_responses (
  id bigint generated always as identity primary key,
  assignment_id bigint not null references protocol_assignments(id),
  field_id bigint not null references protocol_fields(id),
  valor jsonb not null default 'null',
  unique (assignment_id, field_id)
);

alter table protocols enable row level security;
alter table protocol_sections enable row level security;
alter table protocol_fields enable row level security;
alter table protocol_assignments enable row level security;
alter table protocol_responses enable row level security;

drop policy if exists mentora_all_protocols on protocols;
create policy mentora_all_protocols on protocols for all using (is_mentora());

drop policy if exists mentora_all_protocol_sections on protocol_sections;
create policy mentora_all_protocol_sections on protocol_sections for all using (is_mentora());

drop policy if exists mentora_all_protocol_fields on protocol_fields;
create policy mentora_all_protocol_fields on protocol_fields for all using (is_mentora());

drop policy if exists mentora_all_protocol_assignments on protocol_assignments;
create policy mentora_all_protocol_assignments on protocol_assignments for all using (is_mentora());

drop policy if exists mentora_all_protocol_responses on protocol_responses;
create policy mentora_all_protocol_responses on protocol_responses for all using (is_mentora());
