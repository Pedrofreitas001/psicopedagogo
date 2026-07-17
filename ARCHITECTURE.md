# Arquitetura — como os dados viram conhecimento

Este documento explica **o que acontece em cada camada, quem faz o quê, onde os dados
ficam e como o frontend/backend estão compartimentados**. É o mapa para não cometer
erros de construção: cada módulo novo deve se encaixar em UMA camada e consumir apenas
a camada anterior.

## O fluxo completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1 · INGESTÃO         "traga os dados, não mude nada"             │
│  Conexões (VTEX, Zendesk, Power BI, Supabase…) → sync() → tabelas de    │
│  origem (vtex_orders, zendesk_tickets…) e raw_records (fontes genéricas)│
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2 · MODELO SEMÂNTICO  "o que esses dados significam?"            │
│  data_assets (entidades: Pedidos, Clientes…) + asset_columns (papel de  │
│  cada coluna: medida, dimensão, data, chave) + relacionamentos + LGPD   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3 · MODELO ANALÍTICO  "o que queremos acompanhar?"               │
│  kpis (agregação + medida + eixo temporal + quebra) calculados sob      │
│  demanda sobre as camadas 1–2                                           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 4 · EXPERIÊNCIA       "consumidores do conhecimento"             │
│  Aba KPIs · Dashboards (spec JSON) · Assistente/Agentes (ferramenta     │
│  analitico.kpis) · Insights de Marketing                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## As perguntas-chave, respondidas

### 1. A partir da ingestão, QUEM cria a camada estratégica (semântica)?

Três atores, em sequência:

| Ator | O que faz | Onde no código |
|---|---|---|
| **Conector** (automático) | Para APIs conhecidas (VTEX, Zendesk), já entrega semântica pronta: "isto é Pedidos, estes campos são sensíveis" | `lib/connectors.ts` → `upsertAssets()` |
| **Profiler** (automático) | Para fontes genéricas (Supabase, futuramente Excel), analisa a amostra e INFERE: coluna numérica com nome "valor_total" → medida monetária; texto com 3 valores distintos → dimensão; `*_id` → chave | `lib/semantic.ts` → `profileAsset()` |
| **Steward** (humano) | Confirma/corrige as inferências na tela do ativo: renomeia (`tbl_orders` → "Pedidos"), ajusta papéis, marca PII. Toda curadoria é auditada | `components/SemanticColumns.tsx` + `AssetEditor.tsx` |

O Semantic Builder conversacional (a "entrevista" conduzida por IA do documento de
visão) pluga exatamente no lugar do Profiler — mesmo contrato, muda só quem pergunta.

### 2. Onde FICAM esses dados?

Tudo em um banco único multi-tenant (hoje SQLite, schema pronto para Postgres/Supabase),
separado logicamente por camada:

| Camada | Tabelas | Regra |
|---|---|---|
| Raw (L1) | `vtex_orders`, `zendesk_tickets`, `powerbi_reports`, `marketing_campaigns`, `raw_records` | Nunca editadas pela UI; só o `sync()` escreve |
| Semantic (L2) | `data_assets`, `asset_columns`, `asset_relationships` | Editadas apenas por steward/admin (RBAC), com auditoria |
| Analytics (L3) | `kpis` | Definições declarativas; o VALOR não é armazenado — é calculado sob demanda (`lib/kpi.ts`). Quando o volume crescer, vira view materializada sem mudar contrato |
| Experiência (L4) | `dashboards` (spec JSON), `agents`, `projects` | Só referenciam as camadas anteriores |

### 3. Como VER/ANALISAR através dos KPIs?

Aba **KPIs**: cada KPI mostra o valor atual + evolução no tempo (se tem coluna de data)
+ quebra por dimensão (se tem). Dois caminhos para criar:
- **Sugerido**: no catálogo, o profiler sugere KPIs a partir das medidas/dimensões
  detectadas ("`valor_total` é medida monetária → Total de valor_total") — 1 clique.
- **Manual**: botão "+ Novo KPI" → escolhe ativo → o builder perfila as colunas e só
  oferece o que faz sentido (medidas para agregar, datas para eixo, dimensões para quebra).

### 4. Como construir DASHBOARDS de acordo com os dados?

Dashboards não têm código próprio: são **listas de specs JSON** (`{type: kpi|chart|table|kanban}`)
renderizadas pelo Dynamic UI Engine (`components/SpecRenderer.tsx`). Qualquer camada 4
produz specs: um KPI tem "salvar como dashboard", uma resposta do assistente também.
Como todos leem o MESMO modelo analítico, um número nunca diverge entre chat, KPI e dashboard.

### 5. Como os AGENTES encaixam?

Agentes são **consumidores, não donos** do conhecimento. Eles não interpretam dados
brutos: recebem ferramentas com escopo (`analitico.kpis`, `vtex.pedidos`…) e cada
ferramenta lê as camadas 1–3. Pergunte "qual o faturamento?" e o agente responde com o
KPI "Faturamento" — a mesma definição da aba KPIs. Se a pergunta exigir ferramenta não
autorizada, o agente recusa (governança por escopo).

## Compartimentação do código

```
lib/            ← toda a lógica de domínio, por camada
  connectors.ts   L1: conectores reais + demo
  semantic.ts     L2: profiler e curadoria de colunas
  kpi.ts          L3: cálculo de KPIs
  engine.ts       L4: orquestrador + ferramentas dos agentes
  db.ts           schema + seed (versionado: SCHEMA_VERSION)
  vault.ts        credenciais (AES-256-GCM)
  auth.ts         usuário atual + RBAC

app/api/        ← contratos HTTP finos: validam, chamam lib/, auditam
app/(páginas)   ← experiência; páginas server-side leem lib/ direto,
                  mutações passam pelas rotas de app/api/
components/     ← UI reutilizável (SpecRenderer é o Dynamic UI Engine)
```

Regra de ouro: **página nunca escreve no banco direto** (só via API route, que aplica
RBAC + auditoria), e **camada N nunca importa camada N+1**.

## Sidebar = mapa das camadas

- **Dados** → Conexões (L1), Catálogo & Semântica (L2)
- **Análise** → KPIs (L3), Dashboards, Queries, Marketing (L4 analítico)
- **Inteligência** → Assistente, Agentes (L4 conversacional)
- **Governança** → Auditoria (transversal)

## Próximos passos previstos (sem quebrar a arquitetura)

1. **Supabase como backend da plataforma** (auth + Postgres persistente) — troca
   `lib/db.ts` e `lib/auth.ts`; nenhuma outra camada muda.
2. **Upload de Excel/CSV** — novo conector L1 que escreve em `raw_records`; o profiler
   L2 já funciona sobre ele sem mudanças.
3. **Semantic Builder com IA** — substitui/complementa o profiler determinístico.
4. **Relacionamentos entre entidades sugeridos por IA** — colunas `papel = chave` com
   nomes compatíveis entre ativos diferentes.
5. **Brains por domínio** — análises recorrentes viram módulos permanentes (o caminho
   Marketing já demonstra o padrão).
