-- Migração v3: pivot de modelo — de "mentora acompanha clientes" para "mentora
-- forma participantes, que analisam casos clínicos com o apoio de um mentor de
-- IA socrático". Rode isto DEPOIS de migration_v1.sql e migration_v2.sql, num
-- projeto que já tem as tabelas antigas (clients, session_notes, etc).
--
-- O que muda:
--   - `clients` vira `participants` (a psicopedagoga em formação na mentoria).
--   - Novo nível `clinical_cases` (a criança que a participante atende) — os
--     campos clínicos que antes ficavam em `clients` migram para cá.
--   - `session_notes` vira `case_notes` (registros de raciocínio clínico por caso).
--   - `documents`, `protocol_assignments` passam a referenciar o caso, não a participante.
--   - `conversations` e `events` ganham `participant_id` (obrigatório) e `case_id` (opcional).
--   - Nova tabela `hypotheses` — hipóteses clínicas por caso, com status e evidências.
--   - `users.papel`: valor `cliente` passa a `participante`.
--
-- Importante sobre a migração de dados: cada `cliente` existente vira uma
-- `participante` E um `caso clínico` com o MESMO id (via `overriding system
-- value`) — assim documentos, conversas, eventos e prontuário antigos são
-- repontados automaticamente sem precisar de tabela de mapeamento. Ou seja,
-- cada cliente antigo continua acessível como participante (identidade) e como
-- caso clínico (dados clínicos), ambos herdando o histórico que já existia.

-- ---------------------------------------------------------------------------
-- 1. Participantes: renomeia clients -> participants
-- ---------------------------------------------------------------------------
alter table clients rename to participants;
alter table participants add column if not exists estagio_mentoria text not null default '';
alter table participants add column if not exists observacoes_mentora text not null default '';

-- ---------------------------------------------------------------------------
-- 2. Casos clínicos: um caso por participante existente, preservando os
--    campos clínicos que antes ficavam na própria participante.
-- ---------------------------------------------------------------------------
create table if not exists clinical_cases (
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

insert into clinical_cases (id, workspace_id, participant_id, nome, idade, diagnostico_preliminar, escola_serie, responsavel_nome, responsavel_contato, queixa_principal, objetivo, observacoes, criado_em)
  overriding system value
  select id, workspace_id, id, nome, idade, diagnostico_preliminar, escola_serie, responsavel_nome, responsavel_contato, queixa_principal, objetivo, observacoes, criado_em
  from participants
  where not exists (select 1 from clinical_cases cc where cc.id = participants.id);

select setval(pg_get_serial_sequence('clinical_cases', 'id'), coalesce((select max(id) from clinical_cases), 1));

alter table participants drop column if exists objetivo;
alter table participants drop column if exists observacoes;
alter table participants drop column if exists idade;
alter table participants drop column if exists diagnostico_preliminar;
alter table participants drop column if exists escola_serie;
alter table participants drop column if exists responsavel_nome;
alter table participants drop column if exists responsavel_contato;
alter table participants drop column if exists queixa_principal;

-- ---------------------------------------------------------------------------
-- 3. Documentos: client_id -> case_id
-- ---------------------------------------------------------------------------
alter table documents rename column client_id to case_id;
alter table documents drop constraint if exists documents_client_id_fkey;
alter table documents add constraint documents_case_id_fkey foreign key (case_id) references clinical_cases(id);

-- ---------------------------------------------------------------------------
-- 4. Prontuário -> registros de raciocínio clínico por caso
-- ---------------------------------------------------------------------------
alter table session_notes rename to case_notes;
alter table case_notes rename column client_id to case_id;
alter table case_notes drop constraint if exists session_notes_client_id_fkey;
alter table case_notes add constraint case_notes_case_id_fkey foreign key (case_id) references clinical_cases(id);

-- ---------------------------------------------------------------------------
-- 5. Conversas: participant_id (obrigatório) + case_id (opcional)
-- ---------------------------------------------------------------------------
alter table conversations rename column client_id to participant_id;
alter table conversations drop constraint if exists conversations_client_id_fkey;
alter table conversations add constraint conversations_participant_id_fkey foreign key (participant_id) references participants(id);
alter table conversations add column if not exists case_id bigint references clinical_cases(id);
update conversations set case_id = participant_id where case_id is null;

-- ---------------------------------------------------------------------------
-- 6. Linha do tempo: mesma lógica das conversas + novo tipo de evento "hipotese"
-- ---------------------------------------------------------------------------
alter table events rename column client_id to participant_id;
alter table events drop constraint if exists events_client_id_fkey;
alter table events add constraint events_participant_id_fkey foreign key (participant_id) references participants(id);
alter table events add column if not exists case_id bigint references clinical_cases(id);
update events set case_id = participant_id where case_id is null;
alter table events drop constraint if exists events_tipo_check;
alter table events add constraint events_tipo_check
  check (tipo in ('conversa','material','observacao','resumo','sessao','protocolo','hipotese'));

-- ---------------------------------------------------------------------------
-- 7. Protocolos: aplicações passam a pertencer ao caso clínico
-- ---------------------------------------------------------------------------
alter table protocol_assignments rename column client_id to case_id;
alter table protocol_assignments drop constraint if exists protocol_assignments_client_id_fkey;
alter table protocol_assignments add constraint protocol_assignments_case_id_fkey foreign key (case_id) references clinical_cases(id);

-- ---------------------------------------------------------------------------
-- 8. Hipóteses clínicas — nova tabela, núcleo da "memória" do agente por caso
-- ---------------------------------------------------------------------------
create table if not exists hypotheses (
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

-- ---------------------------------------------------------------------------
-- 9. users.papel: 'cliente' -> 'participante'
-- ---------------------------------------------------------------------------
alter table users drop constraint if exists users_papel_check;
update users set papel = 'participante' where papel = 'cliente';
alter table users add constraint users_papel_check check (papel in ('mentora','participante'));

-- ---------------------------------------------------------------------------
-- 10. Row Level Security — recria para o novo modelo
-- ---------------------------------------------------------------------------
alter table participants enable row level security;
alter table clinical_cases enable row level security;
alter table case_notes enable row level security;
alter table hypotheses enable row level security;

drop policy if exists mentora_all_clients on participants;
drop policy if exists cliente_own_record on participants;
create policy mentora_all_participants on participants for all using (is_mentora());

drop policy if exists cliente_self on users;
create policy participante_self on users for select using (auth_id = auth.uid());

create or replace function current_participant_id() returns bigint
language sql stable security definer as
$$ select p.id from participants p join users u on u.id = p.user_id where u.auth_id = auth.uid() $$;

create or replace function current_participant_case_ids() returns setof bigint
language sql stable security definer as
$$ select id from clinical_cases where participant_id = current_participant_id() $$;

create policy mentora_all_clinical_cases on clinical_cases for all using (is_mentora());
create policy participante_own_cases on clinical_cases for select using (participant_id = current_participant_id());
create policy participante_new_case on clinical_cases for insert with check (participant_id = current_participant_id());
create policy participante_update_case on clinical_cases for update using (participant_id = current_participant_id());

drop policy if exists cliente_documents on documents;
drop policy if exists cliente_upload on documents;
create policy participante_documents on documents for select
  using (categoria_id is not null or case_id in (select current_participant_case_ids()));
create policy participante_upload on documents for insert
  with check (categoria_id is null and case_id in (select current_participant_case_ids()));

drop policy if exists cliente_conversations on conversations;
drop policy if exists cliente_new_conversation on conversations;
create policy participante_conversations on conversations for select using (participant_id = current_participant_id());
create policy participante_new_conversation on conversations for insert with check (participant_id = current_participant_id());

drop policy if exists cliente_messages on messages;
drop policy if exists cliente_new_message on messages;
create policy participante_messages on messages for select
  using (conversation_id in (select id from conversations where participant_id = current_participant_id()));
create policy participante_new_message on messages for insert
  with check (conversation_id in (select id from conversations where participant_id = current_participant_id()));

drop policy if exists cliente_events on events;
create policy participante_events on events for select using (participant_id = current_participant_id());

drop policy if exists mentora_all_session_notes on case_notes;
drop policy if exists cliente_session_notes on case_notes;
create policy mentora_all_case_notes on case_notes for all using (is_mentora());
create policy participante_case_notes on case_notes for select using (case_id in (select current_participant_case_ids()));
create policy participante_new_case_notes on case_notes for insert with check (case_id in (select current_participant_case_ids()));

create policy mentora_all_hypotheses on hypotheses for all using (is_mentora());
create policy participante_hypotheses on hypotheses for select using (case_id in (select current_participant_case_ids()));
create policy participante_new_hypotheses on hypotheses for insert with check (case_id in (select current_participant_case_ids()));
create policy participante_update_hypotheses on hypotheses for update using (case_id in (select current_participant_case_ids()));

drop policy if exists mentora_all_protocol_assignments on protocol_assignments;
create policy mentora_all_protocol_assignments on protocol_assignments for all using (is_mentora());
create policy participante_protocol_assignments on protocol_assignments for select using (case_id in (select current_participant_case_ids()));
create policy participante_new_protocol_assignments on protocol_assignments for insert with check (case_id in (select current_participant_case_ids()));
create policy participante_update_protocol_assignments on protocol_assignments for update using (case_id in (select current_participant_case_ids()));

drop policy if exists mentora_all_protocols on protocols;
drop policy if exists mentora_all_protocol_sections on protocol_sections;
drop policy if exists mentora_all_protocol_fields on protocol_fields;
drop policy if exists mentora_all_protocol_responses on protocol_responses;
create policy mentora_all_protocols on protocols for all using (is_mentora());
create policy mentora_all_protocol_sections on protocol_sections for all using (is_mentora());
create policy mentora_all_protocol_fields on protocol_fields for all using (is_mentora());
create policy mentora_all_protocol_responses on protocol_responses for all using (is_mentora());
create policy participante_protocols on protocols for select using (true);
create policy participante_protocol_sections on protocol_sections for select using (true);
create policy participante_protocol_fields on protocol_fields for select using (true);
create policy participante_protocol_responses on protocol_responses for select
  using (assignment_id in (select id from protocol_assignments where case_id in (select current_participant_case_ids())));
create policy participante_new_protocol_responses on protocol_responses for insert
  with check (assignment_id in (select id from protocol_assignments where case_id in (select current_participant_case_ids())));

drop policy if exists participante_knowledge on knowledge;
create policy participante_knowledge on knowledge for select using (true);

-- current_client_id() só pode cair depois que TODAS as policies antigas que
-- dependiam dela já foram derrubadas acima — senão o Postgres recusa o drop
-- (ERROR 2BP01: cannot drop function ... because other objects depend on it).
drop function if exists current_client_id();
