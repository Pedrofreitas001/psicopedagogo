# Governance Hub — Dados & Agentes de IA (MVP)

Plataforma operacional de dados e IA para empresas de médio porte: conecta ferramentas SaaS
(VTEX, Zendesk, Power BI), organiza os dados numa camada de governança e permite que **agentes
de IA com escopo controlado** respondam perguntas em linguagem natural, citando a fonte e
gerando visualizações.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

### Deploy na Vercel

Funciona sem configuração: em ambiente serverless o filesystem é somente leitura, então o
SQLite é criado em `/tmp` e **ressemeado a cada cold start** — os dados demo sempre aparecem,
mas dashboards/edições salvos são efêmeros. Para persistência real em produção, migrar para
Postgres (o schema já está pronto para isso, ver "Decisões do MVP").

Na primeira execução o banco SQLite (`data/hub.db`) é criado e populado com dados demo dos
três conectores (95 pedidos VTEX, 60 tickets Zendesk, 6 relatórios Power BI), 3 agentes
configurados e 1 workspace com 3 usuários (admin / steward / viewer — troque pelo seletor na
sidebar para ver o RBAC em ação). Para resetar o demo, apague `data/hub.db`.

## O que demonstrar (roteiro de 5 minutos)

1. **Assistente** → clique na sugestão *"Quais os tickets de suporte mais frequentes de
   clientes que compraram acima de R$500 no último mês?"* — o Orchestrator aciona o agente
   cross, cruza Pedidos (VTEX) × Tickets (Zendesk) por email, responde com KPIs + gráfico +
   tabela, cita as fontes e mascara PII (LGPD). Clique em **Salvar como dashboard**.
2. **Assistente** → fixe o roteamento em *"Agente de Suporte"* e pergunte sobre faturamento —
   o agente **recusa** (não tem a skill `vtex.pedidos`): governança por escopo, não por prompt.
3. **Agentes** → abra um agente e ajuste as skills (ferramentas MCP), ativos autorizados e a
   política de PII. Crie um agente novo em segundos.
4. **Data Catalog** → abra "Pedidos": owner, steward, sensibilidade LGPD, campos sensíveis,
   relacionamentos e quais agentes têm acesso. Troque para o usuário *viewer* e tente salvar —
   bloqueado (RBAC).
5. **Conexões** → "ver credencial": o valor sai mascarado e a leitura aparece na **Auditoria**.
6. **Dashboards** → o dashboard salvo no passo 1 reaparece idêntico (spec JSON renderizada
   pelo Dynamic UI Engine).

## Arquitetura (mapeada ao PRD)

| Camada do PRD | Onde está no código |
|---|---|
| 1. Core Platform (workspace, RBAC, auditoria) | `lib/db.ts`, `lib/auth.ts`, `app/audit/` |
| 2. Credential Vault (AES-256-GCM, leitura auditada) | `lib/vault.ts`, `app/api/credentials/` |
| 3. Connection Hub (VTEX, Zendesk, Power BI) | `app/connections/`, `app/api/connections/[id]/sync/` |
| 4. Data Catalog (owner, steward, LGPD, relacionamentos) | `app/catalog/`, `app/api/catalog/` |
| 5. Biblioteca de Queries (+ explicar com IA) | `app/queries/`, `app/api/queries/[id]/explain/` |
| 7. Agent Runtime (skills, escopo, custo, recusa) | `lib/engine.ts`, `app/agents/` |
| 8. Orchestrator + Projects (roteamento, encadeamento) | `lib/engine.ts` (`pickAgents`/`executeQuestion`) |
| 9. Dynamic UI Engine (kpi/table/chart/kanban) + Dashboards | `lib/types.ts`, `components/SpecRenderer.tsx`, `app/dashboards/` |

## Decisões do MVP e caminho de produção

O objetivo deste MVP é **demonstrar valor sem infraestrutura externa** — ele roda com
`npm run dev` e nada mais. As simplificações são deliberadas e cada uma tem um caminho de
migração direto:

- **SQLite em vez de PostgreSQL**: o schema já espelha a seção 3 do PRD (tudo com
  `workspace_id`); migrar é trocar o driver e ativar Row-Level Security.
- **Conectores em modo demo**: implementam o mesmo contrato (`sync` popula DataAssets,
  credenciais no Vault, auditoria). Plugar as APIs reais (VTEX AppKey/AppToken, Zendesk
  OAuth 2.0, Power BI service principal com fila para o rate limit) troca a origem dos dados,
  não a arquitetura. Cada conector vira um **servidor MCP** para que agentes internos e
  clientes externos (Claude Desktop/Cowork) usem a mesma interface.
- **Planner determinístico em vez de LLM**: `lib/engine.ts` interpreta a pergunta por regras
  e executa "ferramentas" locais. Em produção, cada ferramenta vira um tool MCP e o
  **Claude Agent SDK** assume o planejamento — o contrato de resposta (`ChatResponse` com
  blocos de UI, fontes, custo e flag de mascaramento) permanece o mesmo, então o frontend
  não muda.
- **Auth por cookie + seletor de usuário**: substituir por Auth.js/Clerk multi-tenant.
- **Sem Knowledge Hub (Módulo 6)**: fica para a fase 2 do roadmap (pgvector + chunking),
  como previsto no PRD.

## Governança implementada

- Agentes só executam **skills explicitamente autorizadas**; fora do escopo → recusa auditada.
- PII (email/CPF) **mascarado por padrão** nas respostas; exibição em claro é permissão por
  agente, marcada na UI.
- RBAC: viewer não edita catálogo/agentes; só admin exclui agentes; credenciais são
  inacessíveis ao viewer.
- Vault: segredos com AES-256-GCM, nunca retornados em claro pela API, toda leitura auditada.
- AuditLog cobre: sync de conectores, acesso a credenciais, execução/recusa de agentes,
  mudanças de governança e ownership, dashboards salvos.
