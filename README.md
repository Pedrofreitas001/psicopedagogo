# Espaço Aprender — Acompanhamento Psicopedagógico (MVP)

Plataforma web para uma psicopedagoga acompanhar a jornada de seus clientes. A tecnologia
atua como **suporte à metodologia da especialista** — não como um produto de IA. A interface
é acolhedora e enxuta: quatro módulos, sem dezenas de menus.

## Os módulos

1. **Autenticação** (Supabase Auth) — dois perfis: **Mentora** e **Cliente**.
2. **Biblioteca** — a mentora sobe PDF, Word, PowerPoint e Excel e organiza por pastas
   (ex.: Leitura → Dislexia → Protocolos / Materiais / Exercícios), interativamente: cria e
   exclui pastas e arquivos, e a árvore reflete na hora. Cada documento tem uma "checagem":
   um resumo de conteúdo (a base do assistente) e um toggle de disponibilidade — a mentora
   revisa e só então disponibiliza para o assistente.
3. **Clientes** — ficha completa (nome, idade, escola/série, responsável e contato, queixa
   principal, diagnóstico preliminar, objetivo, observações), arquivos, histórico e chat no
   contexto do cliente. Dados isolados por usuário (RLS no Supabase; ver `supabase/schema.sql`).
4. **Prontuário** — na página do cliente, notas de sessão datadas (o que foi trabalhado, como
   respondeu, combinados) — a evolução de sessão em sessão.
5. **Assistente de Estudos** — chat simples ("Olá! Como posso ajudar?") que responde usando
   **apenas o que estiver ligado em Configurações → Escopo do assistente**: metodologia,
   biblioteca, histórico e/ou prontuário do cliente. Nunca internet, nunca opinião própria,
   nunca diagnóstico. Sem evidência na base, ele diz claramente que não pode responder. Toda
   conversa é salva automaticamente.
6. **Configurações** — metodologia (a base de conhecimento), escopo do assistente (o que ele
   acessa) e tom/instruções de como ele responde.

**Funcionalidade "uau"**: na página do cliente, o botão **"Gerar resumo da evolução"** lê
todas as conversas e a linha do tempo e produz uma síntese profissional para a mentora.

## O que cada perfil vê

| Cliente | Mentora |
|---|---|
| Olá, {nome} — Bem-vindo ao seu acompanhamento | Clientes |
| 📚 Materiais | Biblioteca |
| 💬 Assistente | Assistente |
| 📝 Meu Histórico | Configurações (metodologia + escopo do assistente) |
| 📂 Documentos | |

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

Sem nenhuma env var o app roda em **modo demo**: SQLite semeado com dados de exemplo
(mentora Mariana, clientes Pedro e Luísa, biblioteca, prontuário e histórico), seletor de
usuário na sidebar e assistente 100% offline (compõe respostas dos trechos recuperados da
base). **O SQLite demo é só para rodar sem infraestrutura** — em serverless (Vercel) ele não
persiste de forma confiável entre instâncias; para produção, configure o Supabase (abaixo).

### Env vars (produção)

| Variável | Efeito |
|---|---|
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Liga o login real (Supabase Auth): páginas exigem sessão, cookie httpOnly, renovação de token no middleware. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Persistência real**: clientes, biblioteca, prontuário, conversas e configurações passam a ser lidos/escritos no Postgres do Supabase via REST (em vez do SQLite local). Também libera o Supabase Storage para os arquivos (URL assinada no download). |
| `OPENROUTER_API_KEY` | A redação das respostas do assistente e o resumo de evolução passam a ser feitos por um modelo via [OpenRouter](https://openrouter.ai), sempre presos à base recuperada. |
| `OPENROUTER_MODEL` (opcional) | Modelo usado no OpenRouter. Padrão: `anthropic/claude-sonnet-4.5`. Aceita qualquer modelo disponível na OpenRouter (ex.: `openai/gpt-4o-mini`, `google/gemini-2.5-flash`). |

Sem `SUPABASE_SERVICE_ROLE_KEY`, mesmo com login real ativo, os **dados da aplicação**
(clientes, biblioteca, prontuário…) continuam no SQLite local — em produção isso é visível
como registros que "somem": cada instância serverless pode ter seu próprio arquivo. Configure
sempre as três variáveis do Supabase juntas em produção.

Provisionamento no primeiro login: email igual a um usuário semeado herda o papel; email
igual ao de um **cliente cadastrado pela mentora** entra como cliente já vinculado ao seu
registro; primeiro login real do workspace vira **mentora**; demais viram clientes.

### Configurando o banco no Supabase

- **Projeto novo**: rode `supabase/schema.sql` inteiro no SQL Editor.
- **Projeto que já rodou uma versão anterior deste schema**: rode `supabase/migration_v1.sql`
  em vez disso — só adiciona o que falta (ficha de cliente elaborada, checagem de documento,
  prontuário, escopo do assistente), sem recriar nada.

## Como o assistente se mantém fundamentado

1. **Escopo**: em Configurações, a mentora liga/desliga cada fonte (metodologia, biblioteca,
   histórico, prontuário) e define tom + instruções adicionais.
2. **Recuperação**: a pergunta é tokenizada (sem acentos/stopwords) e pontuada contra as
   fontes ligadas (`lib/assistente.ts`). Documentos só entram se tiverem conteúdo **e**
   estiverem marcados como disponíveis (a checagem da Biblioteca).
3. **Piso de evidência**: sem trecho relevante, resposta de recusa transparente — sem
   inventar.
4. **Redação**: com `OPENROUTER_API_KEY`, um modelo redige a partir apenas dos trechos
   recuperados, com prompt que proíbe diagnóstico e conhecimento externo; sem a chave, a
   resposta é composta diretamente dos trechos (offline). Em ambos os casos as **fontes são
   exibidas** na conversa.
5. **Registro**: toda troca vira `conversations`/`messages` e alimenta a linha do tempo
   (`events`) — que é o "Meu Histórico" do cliente e o insumo do resumo de evolução.

> Nota de produto: hoje o prontuário (notas de sessão) entra na mesma base que o chat do
> cliente consulta. Se preferir manter as notas clínicas visíveis só para a mentora, dá para
> desligar "Prontuário" no escopo do assistente quando o cliente estiver conversando — ou
> pedir que a fonte seja restrita por papel numa próxima iteração.

## Estrutura do banco

`workspaces · users · clients · categories · documents · knowledge · conversations · messages · events · session_notes · agent_settings`

O SQLite local (`lib/db.ts`) espelha o Postgres de produção (`supabase/schema.sql`), que já
traz as **políticas de RLS**: mentora enxerga o workspace inteiro; cliente enxerga só o
próprio registro, seus documentos, suas conversas, seu prontuário e a biblioteca compartilhada.

## Estrutura do código

```
lib/            lógica de domínio
  data.ts         camada de dados única e assíncrona (Postgres via REST, ou SQLite local)
  db.ts           motor SQLite: schema + seed (só o caminho de fallback local/demo)
  auth.ts         usuário atual + provisionamento por papel
  supabase-auth.ts  Supabase Auth via REST (login, refresh, validação)
  storage.ts      Supabase Storage com fallback em disco
  assistente.ts   recuperação na base + OpenRouter + resumo de evolução
app/api/        rotas finas: validam, aplicam permissão, chamam lib/data.ts
app/(app)/      páginas por papel (dashboard, materiais, biblioteca, clientes…)
components/     UI reutilizável (chat, upload, prontuário, biblioteca interativa…)
supabase/       schema.sql (instalação nova) + migration_v1.sql (projeto existente)
```

Toda leitura/escrita passa por `lib/data.ts`, que decide o backend: Postgres do Supabase via
REST (produção — `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS por design, a autorização real é
feita nas rotas de `app/api/`) ou SQLite local (fallback sem infraestrutura). Extração
automática de texto de PDF/Word fica para uma próxima fase — hoje o "resumo de conteúdo" é
preenchido (ou completado depois, na Biblioteca) pela mentora.
