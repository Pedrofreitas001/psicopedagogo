# Comunicar & Aprender — Mentoria de Raciocínio Clínico (MVP)

Ambiente digital para uma mentoria de psicopedagogas: a mentora forma **participantes**, que
trazem seus próprios **casos clínicos** (crianças que atendem fora da plataforma) e são
conduzidas por um **mentor de IA socrático** — que não responde nem diagnostica, mas conduz o
raciocínio clínico por perguntas, ancorado no protocolo e nas hipóteses de cada caso.

## O modelo do domínio

```
Mentora
 └─ forma várias Participantes (psicopedagogas em formação)
     └─ cada Participante acompanha um ou mais Casos clínicos (as crianças que atende)
         ├─ Protocolo(s) aplicado(s) — internalizados no código, reutilizáveis
         ├─ Hipóteses clínicas — texto, status (ativa/confirmada/descartada), evidências
         ├─ Registros de raciocínio clínico — datados, um por observação/sessão
         └─ Conversas com o Mentor Clínico — sempre no contexto do caso (ou uma dúvida geral)
```

Isso não é um chatbot de perguntas e respostas: o agente segue um método de 6 etapas
(organização dos dados → identificação de lacunas → análise pelas duas lentes — contexto e
processamento cognitivo → construção de hipóteses → busca de evidências → tomada de decisão
clínica) e conduz a participante por perguntas antes de qualquer síntese, sempre explicando por
que está perguntando o que perguntou. Ele nunca diagnostica nem substitui a supervisão da
mentora — a decisão final é sempre da participante.

## Os módulos

1. **Autenticação** (Supabase Auth) — dois perfis: **Mentora** e **Participante**.
2. **Biblioteca** — a mentora sobe PDF, Word, PowerPoint e Excel e organiza por pastas,
   interativamente: cria e exclui pastas e arquivos. Cada documento tem uma "checagem": um
   resumo de conteúdo (a base do agente) e um toggle de disponibilidade.
3. **Participantes** — cadastro (nome, email, estágio na mentoria, observações da mentora),
   lista de casos clínicos e **resumo pré-encontro**: hipóteses formadas, pontos frágeis e
   dúvidas recorrentes em todos os casos ativos, para preparar o próximo encontro da mentoria.
4. **Casos clínicos** — ficha da criança (idade, escola/série, responsável, queixa principal,
   diagnóstico preliminar, objetivo da análise), protocolo(s) aplicado(s), hipóteses clínicas,
   registros de raciocínio clínico datados, arquivos e linha do tempo.
5. **Protocolos** — internalizados em código (`lib/protocolos-builtin.ts`): seções e campos
   (texto, número, seleção única/múltipla, tabela). Trazer um protocolo novo é uma entrada
   nova nesse arquivo — a sincronização com o banco é automática e idempotente por nome.
6. **Mentor Clínico** — conversa sempre presa a um caso (ou uma dúvida geral da participante),
   usando **apenas o que estiver ligado em Configurações → Escopo do assistente**: metodologia,
   biblioteca, ficha/histórico do caso, registros de raciocínio, protocolo(s) e hipóteses.
   Nunca internet, nunca diagnóstico. Toda conversa é salva na linha do tempo do caso.
7. **Configurações** — metodologia (a base de conhecimento), escopo do agente, tom, instruções
   adicionais e o modelo de IA usado (via OpenRouter).

## O que cada perfil vê

| Participante | Mentora |
|---|---|
| Olá, {nome} — casos ativos | Participantes |
| 🗂️ Meus Casos | Biblioteca |
| 🧠 Assistente | Assistente |
| 📚 Materiais | Configurações (metodologia + escopo do agente + modelo de IA) |

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

Sem nenhuma env var o app roda em **modo demo**: SQLite semeado com dados de exemplo (mentora
Mariana, participante Camila com o caso L.F., participante Roberta com o caso M.S., biblioteca,
hipóteses e histórico), seletor de usuário na sidebar e agente 100% offline (organiza o que já
está registrado, sem condução socrática real). **O SQLite demo é só para rodar sem
infraestrutura** — em serverless (Vercel) ele não persiste de forma confiável entre instâncias;
para produção, configure o Supabase (abaixo).

### Env vars (produção)

| Variável | Efeito |
|---|---|
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Liga o login real (Supabase Auth): páginas exigem sessão, cookie httpOnly, renovação de token no middleware. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Persistência real**: participantes, casos, protocolos, hipóteses, biblioteca, conversas e configurações passam a ser lidos/escritos no Postgres do Supabase via REST (em vez do SQLite local). Também libera o Supabase Storage para os arquivos (URL assinada no download). |
| `OPENROUTER_API_KEY` | A condução do raciocínio pelo Mentor Clínico e o resumo pré-encontro passam a ser feitos por um modelo via [OpenRouter](https://openrouter.ai). |
| `OPENROUTER_MODEL` (opcional) | Modelo padrão do servidor quando a mentora não escolhe um em Configurações. Padrão: `anthropic/claude-sonnet-5`. |

Sem `SUPABASE_SERVICE_ROLE_KEY`, mesmo com login real ativo, os **dados da aplicação**
continuam no SQLite local — em produção isso é visível como registros que "somem": cada
instância serverless pode ter seu próprio arquivo. Configure sempre as três variáveis do
Supabase juntas em produção.

Provisionamento no primeiro login: email igual a um usuário semeado herda o papel; email igual
ao de uma **participante cadastrada pela mentora** entra como participante já vinculada ao seu
registro; primeiro login real do workspace vira **mentora**; demais viram participantes.

### Configurando o banco no Supabase

- **Projeto novo**: rode `supabase/schema.sql` inteiro no SQL Editor.
- **Projeto que já rodou uma versão anterior deste schema** (com `clients`/`session_notes`):
  rode, na ordem, `supabase/migration_v1.sql`, `supabase/migration_v2.sql` e
  `supabase/migration_v3.sql` — o v3 faz o pivot de modelo (participantes + casos clínicos +
  hipóteses), preservando todo o histórico existente (cada cliente antigo vira uma participante
  **e** um caso clínico com os mesmos dados e o mesmo histórico).

## Como o agente se mantém fundamentado

1. **Escopo**: em Configurações, a mentora liga/desliga cada fonte (metodologia, biblioteca,
   histórico, registros de raciocínio, protocolos/hipóteses), define tom + instruções
   adicionais e escolhe o modelo de IA (padrão: Claude Sonnet 5 via OpenRouter).
2. **Recuperação**: a pergunta é tokenizada (sem acentos/stopwords) e pontuada contra as fontes
   ligadas do caso em questão (`lib/assistente.ts`); protocolo, hipóteses e histórico do caso
   sempre entram como contexto de fundo, mesmo com baixa sobreposição de palavras — são o
   núcleo da memória do caso.
3. **Condução**: com `OPENROUTER_API_KEY`, um modelo conduz o raciocínio seguindo o método de
   6 etapas, com um prompt que proíbe diagnóstico, resposta pronta e conhecimento externo; sem
   a chave, o agente apenas organiza o que já está registrado (offline). Em ambos os casos as
   **fontes são exibidas** na conversa.
4. **Registro**: toda troca vira `conversations`/`messages` e alimenta a linha do tempo
   (`events`) do caso (ou da participante, para dúvidas gerais) — o insumo do resumo
   pré-encontro.

## Estrutura do banco

`workspaces · users · participants · clinical_cases · categories · documents · knowledge ·
conversations · messages · events · case_notes · hypotheses · agent_settings · protocols ·
protocol_sections · protocol_fields · protocol_assignments · protocol_responses`

O SQLite local (`lib/db.ts`) espelha o Postgres de produção (`supabase/schema.sql`), que já
traz as **políticas de RLS**: mentora enxerga o workspace inteiro; participante enxerga só o
próprio registro, os casos que ela mesma criou, a biblioteca compartilhada e os protocolos.

## Estrutura do código

```
lib/            lógica de domínio
  data.ts         camada de dados única e assíncrona (Postgres via REST, ou SQLite local)
  db.ts           motor SQLite: schema + seed (só o caminho de fallback local/demo)
  auth.ts         usuário atual + provisionamento por papel
  supabase-auth.ts  Supabase Auth via REST (login, refresh, validação)
  storage.ts      Supabase Storage com fallback em disco
  assistente.ts   mentor socrático: recuperação por caso + OpenRouter + resumo pré-encontro
  protocolos-builtin.ts  protocolos internalizados no código (seções + campos)
app/api/        rotas finas: validam, aplicam permissão, chamam lib/data.ts
app/(app)/      páginas por papel (dashboard, participantes, casos, biblioteca, assistente…)
components/     UI reutilizável (chat, protocolo dinâmico, hipóteses, biblioteca interativa…)
supabase/       schema.sql (instalação nova) + migration_v1/v2/v3.sql (projeto existente)
```

Toda leitura/escrita passa por `lib/data.ts`, que decide o backend: Postgres do Supabase via
REST (produção — `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS por design, a autorização real é feita
nas rotas de `app/api/`) ou SQLite local (fallback sem infraestrutura). Extração automática de
texto de PDF/Word fica para uma próxima fase — hoje o "resumo de conteúdo" é preenchido (ou
completado depois, na Biblioteca) pela mentora.
