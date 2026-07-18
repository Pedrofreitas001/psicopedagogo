# Espaço Aprender — Acompanhamento Psicopedagógico (MVP)

Plataforma web para uma psicopedagoga acompanhar a jornada de seus clientes. A tecnologia
atua como **suporte à metodologia da especialista** — não como um produto de IA. A interface
é acolhedora e enxuta: quatro módulos, sem dezenas de menus.

## Os quatro módulos

1. **Autenticação** (Supabase Auth) — dois perfis: **Mentora** e **Cliente**.
2. **Biblioteca** — a mentora sobe PDF, Word, PowerPoint e Excel e organiza por pastas
   (ex.: Leitura → Dislexia → Protocolos / Materiais / Exercícios). O resumo de conteúdo
   informado no upload vira a base de conhecimento do assistente.
3. **Clientes** — cada cliente tem: nome, objetivo, observações, arquivos, histórico e chat.
   Dados isolados por usuário (RLS no Supabase; ver `supabase/schema.sql`).
4. **Assistente de Estudos** — chat simples ("Olá! Como posso ajudar?") que responde usando
   **exclusivamente**: documentos da mentora + metodologia cadastrada + histórico daquele
   cliente. Nunca internet, nunca opinião própria, nunca diagnóstico. Sem evidência na base,
   ele diz claramente que não pode responder. Toda conversa é salva automaticamente.

**Funcionalidade "uau"**: na página do cliente, o botão **"Gerar resumo da evolução"** lê
todas as conversas e a linha do tempo e produz uma síntese profissional para a mentora.

## O que cada perfil vê

| Cliente | Mentora |
|---|---|
| Olá, {nome} — Bem-vindo ao seu acompanhamento | Clientes |
| 📚 Materiais | Biblioteca |
| 💬 Assistente | Assistente |
| 📝 Meu Histórico | Configurações (metodologia) |
| 📂 Documentos | |

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

Sem nenhuma env var o app roda em **modo demo**: SQLite semeado com dados de exemplo
(mentora Mariana, clientes Pedro e Luísa, biblioteca e histórico), seletor de usuário na
sidebar e assistente 100% offline (compõe respostas dos trechos recuperados da base).

### Env vars (produção)

| Variável | Efeito |
|---|---|
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Liga o login real (Supabase Auth): páginas exigem sessão, cookie httpOnly, renovação de token no middleware. |
| `SUPABASE_SERVICE_ROLE_KEY` | Uploads vão para o bucket privado `documentos` do Supabase Storage; download por URL assinada. |
| `ANTHROPIC_API_KEY` | A redação das respostas do assistente e o resumo de evolução passam a ser feitos pelo Claude (`claude-opus-4-8`), sempre presos à base recuperada. |

Provisionamento no primeiro login: email igual a um usuário semeado herda o papel; email
igual ao de um **cliente cadastrado pela mentora** entra como cliente já vinculado ao seu
registro; primeiro login real do workspace vira **mentora**; demais viram clientes.

## Como o assistente se mantém fundamentado

1. **Recuperação**: a pergunta é tokenizada (sem acentos/stopwords) e pontuada contra a
   metodologia, os documentos com conteúdo e o histórico do cliente (`lib/assistente.ts`).
2. **Piso de evidência**: sem trecho relevante, resposta de recusa transparente — sem
   inventar.
3. **Redação**: com `ANTHROPIC_API_KEY`, o Claude redige a partir apenas dos trechos
   recuperados, com prompt que proíbe diagnóstico e conhecimento externo; sem a chave, a
   resposta é composta diretamente dos trechos (offline). Em ambos os casos as **fontes são
   exibidas** na conversa.
4. **Registro**: toda troca vira `conversations`/`messages` e alimenta a linha do tempo
   (`events`) — que é o "Meu Histórico" do cliente e o insumo do resumo de evolução.

## Estrutura do banco

`workspaces · users · clients · categories · documents · knowledge · conversations · messages · events`

O SQLite do MVP (`lib/db.ts`) espelha o Postgres de produção (`supabase/schema.sql`), que já
traz as **políticas de RLS**: mentora enxerga o workspace inteiro; cliente enxerga só o
próprio registro, seus documentos, suas conversas e a biblioteca compartilhada.

## Estrutura do código

```
lib/            lógica de domínio
  db.ts           schema + seed (SQLite demo, espelho do Supabase)
  auth.ts         usuário atual + provisionamento por papel
  supabase-auth.ts  Supabase Auth via REST (login, refresh, validação)
  storage.ts      Supabase Storage com fallback em disco
  assistente.ts   recuperação na base + Claude + resumo de evolução
app/api/        rotas finas: validam, aplicam permissão, chamam lib/
app/(app)/      páginas por papel (dashboard, materiais, biblioteca, clientes…)
components/     UI reutilizável (chat, upload, formulários, linha do tempo)
supabase/       schema Postgres + RLS de produção
```

Decisões do MVP: SQLite para rodar sem infraestrutura (migração 1:1 para o Postgres do
Supabase), extração de texto dos uploads via campo "resumo de conteúdo" (extração automática
de PDF/Word fica para a fase 2), e assistente com fallback offline para a demo nunca depender
de chave de API.
