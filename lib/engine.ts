import { getDb, audit, maskEmail, maskCpf } from "./db";
import { gerarCriativos } from "./creative";
import type { ChatResponse, ChatSource, UISpec } from "./types";

/**
 * Agent Runtime + Orchestrator (Módulos 7 e 8 do PRD).
 *
 * O Orchestrator interpreta a pergunta, decide quais ferramentas são
 * necessárias e escolhe o(s) agente(s) do projeto cuja lista de ferramentas
 * autorizadas cobre a execução. Um agente NUNCA executa ferramenta fora do
 * seu escopo — se o usuário fixar um agente sem a ferramenta, a execução é
 * recusada (governança por escopo, não por confiança no prompt).
 *
 * No MVP as ferramentas são resolvidas por um planner determinístico
 * (regras em pt-BR sobre os dados sincronizados). O ponto de integração com
 * o Claude Agent SDK/MCP é executeQuestion(): em produção, cada ferramenta
 * abaixo vira um tool de um servidor MCP e o planner vira o próprio modelo.
 */

export const TOOL_LABELS: Record<string, string> = {
  "vtex.pedidos": "VTEX · Pedidos",
  "vtex.produtos": "VTEX · Produtos",
  "zendesk.tickets": "Zendesk · Tickets",
  "powerbi.relatorios": "Power BI · Relatórios",
  "cross.vendas_suporte": "Cruzamento Vendas × Suporte",
  "marketing.campanhas": "Marketing · Campanhas",
  "marketing.criativos": "Marketing · Criativos",
  "catalogo.busca": "Data Catalog · Busca",
};

type AgentRow = {
  id: number;
  nome: string;
  modelo: string;
  ferramentas: string;
  pode_exibir_pii: number;
  escopo_trabalho: string;
};

type Intent = {
  id: string;
  tools: string[]; // ferramentas exigidas (uma delas OU todas, ver cross)
  params: { minTotal?: number; days?: number; status?: string };
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseParams(q: string) {
  const params: Intent["params"] = {};
  const money = q.match(/acima de\s*r?\$?\s*([\d.]+)/i);
  if (money) params.minTotal = parseFloat(money[1].replace(/\.(?=\d{3})/g, ""));
  if (/hoje/i.test(q)) params.days = 0;
  else if (/semana/i.test(q)) params.days = 7;
  else if (/últim[oa]s?\s+(\d+)\s+dias/i.test(q)) params.days = parseInt(q.match(/últim[oa]s?\s+(\d+)\s+dias/i)![1]);
  else if (/últim[oa]\s+mês|mês passado|30 dias/i.test(q)) params.days = 30;
  if (/\babert/i.test(q)) params.status = "aberto";
  if (/\bresolvid/i.test(q)) params.status = "resolvido";
  return params;
}

export function detectIntent(q: string): Intent {
  const params = parseParams(q);
  const temTicket = /(ticket|suporte|atendimento|reclama|chamad)/i.test(q);
  const temVenda = /(pedido|compra|venda|fatur|receita|cliente|gasta|produto|r\$)/i.test(q);

  if (/(criativo|copy|anúncio para|texto de anúncio)/i.test(q))
    return { id: "marketing_criativo", tools: ["marketing.criativos"], params };
  if (/(roas|cac\b|campanha|mídia paga|ads\b|ctr\b|investimento em (mídia|marketing)|verba)/i.test(q))
    return { id: "marketing_analise", tools: ["marketing.campanhas"], params };
  if (temTicket && /(compra|pedido|acima de|gasta|clientes que)/i.test(q))
    return { id: "cross", tools: ["cross.vendas_suporte"], params: { minTotal: params.minTotal ?? 500, days: params.days ?? 30, ...params } };
  if (temTicket && /(kanban|quadro)/i.test(q))
    return { id: "tickets_kanban", tools: ["zendesk.tickets"], params };
  if (/(csat|satisfa)/i.test(q))
    return { id: "csat", tools: ["zendesk.tickets"], params };
  if (temTicket && /(frequente|comu[mn]s?|principais|categoria|top|mais)/i.test(q))
    return { id: "tickets_frequentes", tools: ["zendesk.tickets"], params };
  if (temTicket)
    return { id: "tickets_fila", tools: ["zendesk.tickets"], params };
  if (/(relat[óo]rio|power\s*bi|\bbi\b|dashboards? existentes?)/i.test(q))
    return { id: "relatorios", tools: ["powerbi.relatorios"], params };
  if (/produto/i.test(q) && /(mais vendid|top|melhores|ranking)/i.test(q))
    return { id: "top_produtos", tools: ["vtex.pedidos", "vtex.produtos"], params };
  if (/cliente/i.test(q) && temVenda)
    return { id: "top_clientes", tools: ["vtex.pedidos"], params: { days: params.days ?? 30, ...params } };
  if (/(fatur|receita|vendas|vendeu)/i.test(q))
    return { id: "faturamento", tools: ["vtex.pedidos"], params: { days: params.days ?? 30, ...params } };
  if (/pedido/i.test(q))
    return { id: "pedidos_lista", tools: ["vtex.pedidos"], params: { days: params.days ?? 30, ...params } };
  if (/(cat[áa]logo|ativos|tabelas|quais dados|governan)/i.test(q))
    return { id: "catalogo", tools: ["catalogo.busca"], params };
  return { id: "ajuda", tools: [], params };
}

/** Escolhe agentes do projeto que cobrem as ferramentas exigidas. */
function pickAgents(required: string[], forcedAgentId?: number): { agents: AgentRow[]; missing: string[] } {
  const db = getDb();
  const all = db.prepare("SELECT id, nome, modelo, ferramentas, pode_exibir_pii, escopo_trabalho FROM agents WHERE workspace_id = 1").all() as AgentRow[];
  const toolsOf = (a: AgentRow) => JSON.parse(a.ferramentas) as string[];

  if (forcedAgentId) {
    const agent = all.find((a) => a.id === forcedAgentId);
    if (!agent) return { agents: [], missing: required };
    const missing = required.filter((t) => !toolsOf(agent).includes(t));
    return { agents: [agent], missing };
  }
  if (required.length === 0) return { agents: [], missing: [] };

  // 1 agente que cobre tudo?
  const solo = all.find((a) => required.every((t) => toolsOf(a).includes(t)));
  if (solo) return { agents: [solo], missing: [] };

  // combinação de agentes (o Orchestrator encadeia)
  const chosen: AgentRow[] = [];
  const covered = new Set<string>();
  for (const t of required) {
    const a = all.find((x) => toolsOf(x).includes(t));
    if (a) {
      covered.add(t);
      if (!chosen.some((c) => c.id === a.id)) chosen.push(a);
    }
  }
  // cross pode ser coberto pela dupla pedidos+tickets
  if (required.includes("cross.vendas_suporte") && !covered.has("cross.vendas_suporte")) {
    const vendas = all.find((a) => toolsOf(a).includes("vtex.pedidos"));
    const suporte = all.find((a) => toolsOf(a).includes("zendesk.tickets"));
    if (vendas && suporte) {
      for (const a of [vendas, suporte]) if (!chosen.some((c) => c.id === a.id)) chosen.push(a);
      covered.add("cross.vendas_suporte");
    }
  }
  return { agents: chosen, missing: required.filter((t) => !covered.has(t)) };
}

// ── Executores de intenção (as "ferramentas" MCP do MVP) ────────────────

type ExecResult = { answer: string; blocks: UISpec[]; sources: ChatSource[]; usesPii: boolean };

function execIntent(intent: Intent, mask: boolean, question = ""): ExecResult {
  const db = getDb();
  const p = intent.params;

  switch (intent.id) {
    case "marketing_analise": {
      const canais = db.prepare(
        `SELECT canal, SUM(investimento) inv, SUM(receita) rec, SUM(conversoes) conv, SUM(cliques) cli, SUM(impressoes) imp
         FROM marketing_campaigns GROUP BY canal ORDER BY rec DESC`
      ).all() as { canal: string; inv: number; rec: number; conv: number; cli: number; imp: number }[];
      const camps = db.prepare(
        `SELECT nome, canal, status, investimento, receita, conversoes, cliques, impressoes FROM marketing_campaigns ORDER BY receita DESC`
      ).all() as { nome: string; canal: string; status: string; investimento: number; receita: number; conversoes: number; cliques: number; impressoes: number }[];
      if (!camps.length) {
        return { answer: "Nenhuma campanha sincronizada ainda — conecte uma fonte de mídia na aba Conexões.", usesPii: false, sources: [], blocks: [] };
      }
      const inv = canais.reduce((s, c) => s + c.inv, 0);
      const rec = canais.reduce((s, c) => s + c.rec, 0);
      const conv = canais.reduce((s, c) => s + c.conv, 0);
      const ruins = camps.filter((c) => c.status === "ativa" && c.receita / c.investimento < 1);
      const melhor = [...canais].sort((a, b) => b.rec / b.inv - a.rec / a.inv)[0];
      return {
        answer:
          `Nos dados de mídia: investimento total de ${fmtBRL(inv)}, receita atribuída de ${fmtBRL(rec)} (ROAS ${(rec / inv).toFixed(2)}) e CAC médio de ${fmtBRL(inv / Math.max(conv, 1))}. ` +
          `O melhor canal é ${melhor.canal} (ROAS ${(melhor.rec / melhor.inv).toFixed(2)}).` +
          (ruins.length ? ` Atenção: ${ruins.map((r) => `“${r.nome}”`).join(", ")} está(ão) com ROAS abaixo de 1 — candidata(s) a pausa.` : "") +
          ` Fonte: Campanhas de Mídia.`,
        usesPii: false,
        sources: [{ asset: "Campanhas de Mídia", connection: "Mídia Paga — Meta & Google (demo)" }],
        blocks: [
          {
            type: "kpi",
            items: [
              { label: "Investimento", value: fmtBRL(inv) },
              { label: "Receita atribuída", value: fmtBRL(rec), hint: `ROAS ${(rec / inv).toFixed(2)}` },
              { label: "CAC médio", value: fmtBRL(inv / Math.max(conv, 1)), hint: `${conv} conversões` },
            ],
          },
          {
            type: "chart",
            chartType: "bar",
            title: "ROAS por canal",
            data: canais.map((c) => ({ label: c.canal, value: Math.round((c.rec / c.inv) * 100) / 100 })),
          },
          {
            type: "table",
            title: "Campanhas (por receita)",
            columns: [
              { key: "nome", label: "Campanha" },
              { key: "canal", label: "Canal" },
              { key: "status", label: "Status" },
              { key: "investimento", label: "Investimento", align: "right" },
              { key: "receita", label: "Receita", align: "right" },
              { key: "roas", label: "ROAS", align: "right" },
              { key: "cac", label: "CAC", align: "right" },
            ],
            rows: camps.map((c) => ({
              nome: c.nome,
              canal: c.canal,
              status: c.status,
              investimento: fmtBRL(c.investimento),
              receita: fmtBRL(c.receita),
              roas: (c.receita / c.investimento).toFixed(2),
              cac: c.conversoes ? fmtBRL(c.investimento / c.conversoes) : "—",
            })),
          },
        ],
      };
    }

    case "marketing_criativo": {
      const produtos = db.prepare("SELECT id, nome, categoria, preco FROM vtex_products ORDER BY id").all() as
        { id: number; nome: string; categoria: string; preco: number }[];
      if (!produtos.length) {
        return { answer: "Não há produtos sincronizados para basear o criativo — sincronize a conexão VTEX primeiro.", usesPii: false, sources: [], blocks: [] };
      }
      const qLower = question.toLowerCase();
      const alvo =
        produtos.find((pr) => qLower.includes(pr.nome.toLowerCase())) ??
        produtos.find((pr) => pr.nome.toLowerCase().split(" ").some((w) => w.length > 4 && qLower.includes(w))) ??
        produtos[0];
      const canal = /google/i.test(question) ? "google" : /tiktok/i.test(question) ? "tiktok" : /e-?mail/i.test(question) ? "email" : "meta";
      const tom = /urgen/i.test(question) ? "urgente" : /amig|leve|descontra/i.test(question) ? "amigável" : "profissional";
      const variantes = gerarCriativos({ produto: alvo, canal, objetivo: "conversão", tom });
      return {
        answer: `Gerei 3 variações de criativo para “${alvo.nome}” (${canal}, tom ${tom}), usando preço e categoria reais do catálogo. Refine na aba Marketing → Estúdio de criativos.`,
        usesPii: false,
        sources: [
          { asset: "Produtos", connection: "VTEX" },
          { asset: "Campanhas de Mídia", connection: "Mídia Paga" },
        ],
        blocks: [
          {
            type: "table",
            title: `Criativos — ${alvo.nome} (${canal})`,
            columns: [
              { key: "angulo", label: "Ângulo" },
              { key: "headline", label: "Headline" },
              { key: "corpo", label: "Texto" },
              { key: "cta", label: "CTA" },
            ],
            rows: variantes.map((v) => ({ angulo: v.angulo, headline: v.headline, corpo: v.corpo, cta: v.cta })),
          },
        ],
      };
    }
    case "cross": {
      const min = p.minTotal ?? 500;
      const days = p.days ?? 30;
      const vips = db.prepare(
        `SELECT cliente_nome, cliente_email, SUM(total) AS total, COUNT(*) AS pedidos
         FROM vtex_orders
         WHERE criado_em >= datetime('now', ?) AND status != 'cancelado'
         GROUP BY cliente_email HAVING SUM(total) > ? ORDER BY total DESC`
      ).all(`-${days} days`, min) as { cliente_nome: string; cliente_email: string; total: number; pedidos: number }[];

      const emails = vips.map((v) => v.cliente_email);
      const marks = emails.map(() => "?").join(",");
      const cats = emails.length
        ? (db.prepare(
            `SELECT categoria, COUNT(*) AS qtd FROM zendesk_tickets
             WHERE requester_email IN (${marks}) GROUP BY categoria ORDER BY qtd DESC`
          ).all(...emails) as { categoria: string; qtd: number }[])
        : [];
      const tickets = emails.length
        ? (db.prepare(
            `SELECT t.assunto, t.categoria, t.status, t.requester_email, o.total
             FROM zendesk_tickets t
             JOIN (SELECT cliente_email, SUM(total) AS total FROM vtex_orders
                   WHERE criado_em >= datetime('now', ?) AND status != 'cancelado'
                   GROUP BY cliente_email HAVING SUM(total) > ?) o
               ON o.cliente_email = t.requester_email
             ORDER BY o.total DESC LIMIT 12`
          ).all(`-${days} days`, min) as { assunto: string; categoria: string; status: string; requester_email: string; total: number }[])
        : [];

      const totalTickets = cats.reduce((s, c) => s + c.qtd, 0);
      const answer =
        `Encontrei ${vips.length} clientes com compras acima de ${fmtBRL(min)} nos últimos ${days} dias. ` +
        `Eles abriram ${totalTickets} tickets de suporte` +
        (cats.length ? `, e a categoria mais frequente é “${cats[0].categoria}” (${cats[0].qtd} tickets).` : ".") +
        ` Cruzei Pedidos (VTEX) com Tickets (Zendesk) pelo email do cliente.`;

      return {
        answer,
        usesPii: true,
        sources: [
          { asset: "Pedidos", connection: "VTEX — Loja Acme" },
          { asset: "Tickets", connection: "Zendesk — Suporte Acme" },
        ],
        blocks: [
          {
            type: "kpi",
            items: [
              { label: "Clientes de alto valor", value: String(vips.length), hint: `compras > ${fmtBRL(min)} em ${days} dias` },
              { label: "Tickets desses clientes", value: String(totalTickets) },
              { label: "Categoria mais frequente", value: cats[0]?.categoria ?? "—" },
            ],
          },
          {
            type: "chart",
            chartType: "bar",
            title: "Tickets de clientes de alto valor, por categoria",
            unit: "tickets",
            data: cats.map((c) => ({ label: c.categoria, value: c.qtd })),
          },
          {
            type: "table",
            title: "Amostra dos tickets (clientes de maior valor primeiro)",
            columns: [
              { key: "assunto", label: "Assunto" },
              { key: "categoria", label: "Categoria" },
              { key: "status", label: "Status" },
              { key: "cliente", label: "Cliente (email)" },
              { key: "total", label: "Compras no período", align: "right" },
            ],
            rows: tickets.map((t) => ({
              assunto: t.assunto,
              categoria: t.categoria,
              status: t.status,
              cliente: mask ? maskEmail(t.requester_email) : t.requester_email,
              total: fmtBRL(t.total),
            })),
          },
        ],
      };
    }

    case "tickets_frequentes": {
      const cats = db.prepare(
        `SELECT categoria, COUNT(*) AS qtd FROM zendesk_tickets GROUP BY categoria ORDER BY qtd DESC`
      ).all() as { categoria: string; qtd: number }[];
      return {
        answer: `A categoria de ticket mais frequente é “${cats[0].categoria}”, com ${cats[0].qtd} ocorrências. Fonte: Tickets (Zendesk).`,
        usesPii: false,
        sources: [{ asset: "Tickets", connection: "Zendesk — Suporte Acme" }],
        blocks: [
          {
            type: "chart",
            chartType: "bar",
            title: "Tickets por categoria (todos os períodos)",
            unit: "tickets",
            data: cats.map((c) => ({ label: c.categoria, value: c.qtd })),
          },
        ],
      };
    }

    case "tickets_fila": {
      const rows = db.prepare(
        `SELECT status, COUNT(*) AS qtd FROM zendesk_tickets GROUP BY status`
      ).all() as { status: string; qtd: number }[];
      const abertos = rows.find((r) => r.status === "aberto")?.qtd ?? 0;
      const pendentes = rows.find((r) => r.status === "pendente")?.qtd ?? 0;
      const hoje = db.prepare(
        `SELECT COUNT(*) AS qtd FROM zendesk_tickets WHERE date(criado_em) = date('now')`
      ).get() as { qtd: number };
      const lista = db.prepare(
        `SELECT assunto, categoria, prioridade, requester_email, criado_em FROM zendesk_tickets
         WHERE status = 'aberto' ORDER BY criado_em DESC LIMIT 10`
      ).all() as { assunto: string; categoria: string; prioridade: string; requester_email: string; criado_em: string }[];
      return {
        answer: `Hoje temos ${abertos} tickets abertos e ${pendentes} pendentes (${hoje.qtd} criados hoje). Fonte: Tickets (Zendesk).`,
        usesPii: true,
        sources: [{ asset: "Tickets", connection: "Zendesk — Suporte Acme" }],
        blocks: [
          {
            type: "kpi",
            items: [
              { label: "Abertos", value: String(abertos) },
              { label: "Pendentes", value: String(pendentes) },
              { label: "Criados hoje", value: String(hoje.qtd) },
            ],
          },
          {
            type: "table",
            title: "Tickets abertos mais recentes",
            columns: [
              { key: "assunto", label: "Assunto" },
              { key: "categoria", label: "Categoria" },
              { key: "prioridade", label: "Prioridade" },
              { key: "cliente", label: "Solicitante" },
            ],
            rows: lista.map((t) => ({
              assunto: t.assunto,
              categoria: t.categoria,
              prioridade: t.prioridade,
              cliente: mask ? maskEmail(t.requester_email) : t.requester_email,
            })),
          },
        ],
      };
    }

    case "tickets_kanban": {
      const lista = db.prepare(
        `SELECT assunto, categoria, status, prioridade FROM zendesk_tickets ORDER BY criado_em DESC LIMIT 30`
      ).all() as { assunto: string; categoria: string; status: string; prioridade: string }[];
      const cols = ["aberto", "pendente", "resolvido"].map((st) => ({
        title: st.charAt(0).toUpperCase() + st.slice(1) + "s",
        cards: lista
          .filter((t) => t.status === st)
          .map((t) => ({ title: t.assunto, subtitle: t.categoria, badge: t.prioridade })),
      }));
      return {
        answer: "Quadro kanban da fila de suporte, montado a partir dos 30 tickets mais recentes do Zendesk.",
        usesPii: false,
        sources: [{ asset: "Tickets", connection: "Zendesk — Suporte Acme" }],
        blocks: [{ type: "kanban", title: "Fila de suporte (30 tickets mais recentes)", columns: cols }],
      };
    }

    case "csat": {
      const m = db.prepare(
        `SELECT AVG(csat) AS media, COUNT(csat) AS respostas FROM zendesk_tickets WHERE csat IS NOT NULL`
      ).get() as { media: number; respostas: number };
      const porCat = db.prepare(
        `SELECT categoria, ROUND(AVG(csat), 2) AS media FROM zendesk_tickets
         WHERE csat IS NOT NULL GROUP BY categoria ORDER BY media ASC`
      ).all() as { categoria: string; media: number }[];
      return {
        answer: `O CSAT médio é ${m.media.toFixed(2)} (escala 1–5, ${m.respostas} avaliações). A pior categoria é “${porCat[0].categoria}” (${porCat[0].media}). Para acompanhamento contínuo, o relatório “Satisfação do Cliente (CSAT/NPS)” do Power BI consolida esse indicador.`,
        usesPii: false,
        sources: [{ asset: "Tickets", connection: "Zendesk — Suporte Acme" }],
        blocks: [
          {
            type: "kpi",
            items: [
              { label: "CSAT médio", value: m.media.toFixed(2), hint: "escala 1–5" },
              { label: "Avaliações", value: String(m.respostas) },
              { label: "Pior categoria", value: porCat[0].categoria },
            ],
          },
          {
            type: "chart",
            chartType: "bar",
            title: "CSAT médio por categoria",
            data: porCat.map((c) => ({ label: c.categoria, value: c.media })),
          },
        ],
      };
    }

    case "faturamento": {
      const days = p.days ?? 30;
      const serie = db.prepare(
        `SELECT strftime('%d/%m', criado_em) AS dia, date(criado_em) AS d, SUM(total) AS total
         FROM vtex_orders
         WHERE criado_em >= datetime('now', ?) AND status != 'cancelado'
         GROUP BY date(criado_em) ORDER BY d`
      ).all(`-${days} days`) as { dia: string; total: number }[];
      const total = serie.reduce((s, r) => s + r.total, 0);
      const pedidos = db.prepare(
        `SELECT COUNT(*) AS qtd FROM vtex_orders WHERE criado_em >= datetime('now', ?) AND status != 'cancelado'`
      ).get(`-${days} days`) as { qtd: number };
      return {
        answer: `O faturamento dos últimos ${days} dias foi de ${fmtBRL(total)} em ${pedidos.qtd} pedidos (ticket médio ${fmtBRL(total / Math.max(pedidos.qtd, 1))}), excluindo cancelados. Fonte: Pedidos (VTEX).`,
        usesPii: false,
        sources: [{ asset: "Pedidos", connection: "VTEX — Loja Acme" }],
        blocks: [
          {
            type: "kpi",
            items: [
              { label: "Faturamento", value: fmtBRL(total), hint: `últimos ${days} dias` },
              { label: "Pedidos", value: String(pedidos.qtd) },
              { label: "Ticket médio", value: fmtBRL(total / Math.max(pedidos.qtd, 1)) },
            ],
          },
          {
            type: "chart",
            chartType: "line",
            title: `Faturamento diário — últimos ${days} dias`,
            unit: "R$",
            data: serie.map((r) => ({ label: r.dia, value: Math.round(r.total) })),
          },
        ],
      };
    }

    case "top_produtos": {
      const days = p.days ?? 60;
      const rows = db.prepare(
        `SELECT pr.nome, pr.categoria, SUM(o.quantidade) AS unidades, SUM(o.total) AS receita
         FROM vtex_orders o JOIN vtex_products pr ON pr.id = o.produto_id
         WHERE o.criado_em >= datetime('now', ?) AND o.status != 'cancelado'
         GROUP BY pr.id ORDER BY receita DESC`
      ).all(`-${days} days`) as { nome: string; categoria: string; unidades: number; receita: number }[];
      return {
        answer: `O produto com maior receita nos últimos ${days} dias é “${rows[0].nome}” (${fmtBRL(rows[0].receita)}). Fonte: Pedidos + Produtos (VTEX).`,
        usesPii: false,
        sources: [
          { asset: "Pedidos", connection: "VTEX — Loja Acme" },
          { asset: "Produtos", connection: "VTEX — Loja Acme" },
        ],
        blocks: [
          {
            type: "chart",
            chartType: "bar",
            title: `Receita por produto — últimos ${days} dias`,
            unit: "R$",
            data: rows.slice(0, 8).map((r) => ({ label: r.nome, value: Math.round(r.receita) })),
          },
          {
            type: "table",
            title: "Detalhe por produto",
            columns: [
              { key: "nome", label: "Produto" },
              { key: "categoria", label: "Categoria" },
              { key: "unidades", label: "Unidades", align: "right" },
              { key: "receita", label: "Receita", align: "right" },
            ],
            rows: rows.map((r) => ({ nome: r.nome, categoria: r.categoria, unidades: r.unidades, receita: fmtBRL(r.receita) })),
          },
        ],
      };
    }

    case "top_clientes": {
      const days = p.days ?? 30;
      const min = p.minTotal ?? 0;
      const rows = db.prepare(
        `SELECT cliente_nome, cliente_email, cliente_cpf, COUNT(*) AS pedidos, SUM(total) AS total
         FROM vtex_orders
         WHERE criado_em >= datetime('now', ?) AND status != 'cancelado'
         GROUP BY cliente_email HAVING SUM(total) > ? ORDER BY total DESC LIMIT 10`
      ).all(`-${days} days`, min) as { cliente_nome: string; cliente_email: string; cliente_cpf: string; pedidos: number; total: number }[];
      return {
        answer: `${rows.length ? `“${rows[0].cliente_nome}” lidera as compras dos últimos ${days} dias com ${fmtBRL(rows[0].total)}.` : "Nenhum cliente no filtro."} ${min ? `Filtro: compras acima de ${fmtBRL(min)}.` : ""} Fonte: Pedidos (VTEX).`,
        usesPii: true,
        sources: [{ asset: "Pedidos", connection: "VTEX — Loja Acme" }],
        blocks: [
          {
            type: "table",
            title: `Top clientes — últimos ${days} dias`,
            columns: [
              { key: "nome", label: "Cliente" },
              { key: "email", label: "Email" },
              { key: "cpf", label: "CPF" },
              { key: "pedidos", label: "Pedidos", align: "right" },
              { key: "total", label: "Total", align: "right" },
            ],
            rows: rows.map((r) => ({
              nome: r.cliente_nome,
              email: mask ? maskEmail(r.cliente_email) : r.cliente_email,
              cpf: mask ? maskCpf(r.cliente_cpf) : r.cliente_cpf,
              pedidos: r.pedidos,
              total: fmtBRL(r.total),
            })),
          },
        ],
      };
    }

    case "pedidos_lista": {
      const days = p.days ?? 30;
      const min = p.minTotal ?? 0;
      const rows = db.prepare(
        `SELECT o.criado_em, o.cliente_nome, pr.nome AS produto, o.total, o.status
         FROM vtex_orders o JOIN vtex_products pr ON pr.id = o.produto_id
         WHERE o.criado_em >= datetime('now', ?) AND o.total > ?
         ORDER BY o.criado_em DESC LIMIT 15`
      ).all(`-${days} days`, min) as { criado_em: string; cliente_nome: string; produto: string; total: number; status: string }[];
      return {
        answer: `Listando os pedidos dos últimos ${days} dias${min ? ` acima de ${fmtBRL(min)}` : ""} (15 mais recentes). Fonte: Pedidos (VTEX).`,
        usesPii: false,
        sources: [{ asset: "Pedidos", connection: "VTEX — Loja Acme" }],
        blocks: [
          {
            type: "table",
            title: "Pedidos recentes",
            columns: [
              { key: "data", label: "Data" },
              { key: "cliente", label: "Cliente" },
              { key: "produto", label: "Produto" },
              { key: "total", label: "Total", align: "right" },
              { key: "status", label: "Status" },
            ],
            rows: rows.map((r) => ({
              data: r.criado_em.slice(0, 10).split("-").reverse().join("/"),
              cliente: r.cliente_nome,
              produto: r.produto,
              total: fmtBRL(r.total),
              status: r.status,
            })),
          },
        ],
      };
    }

    case "relatorios": {
      const rows = db.prepare(
        `SELECT nome, dataset, descricao, atualizado_em FROM powerbi_reports ORDER BY nome`
      ).all() as { nome: string; dataset: string; descricao: string; atualizado_em: string }[];
      return {
        answer:
          `Existem ${rows.length} relatórios no workspace Power BI conectado. Em vez de recriar análises, ` +
          `posso apontar o relatório certo: por exemplo, “${rows[0].nome}” cobre ${rows[0].descricao.split(",")[0].toLowerCase()}. ` +
          `Fonte: Relatórios Power BI (REST API, leitura de metadados).`,
        usesPii: false,
        sources: [{ asset: "Relatórios Power BI", connection: "Power BI — Workspace Comercial" }],
        blocks: [
          {
            type: "table",
            title: "Relatórios existentes no Power BI",
            columns: [
              { key: "nome", label: "Relatório" },
              { key: "dataset", label: "Dataset" },
              { key: "descricao", label: "O que responde" },
            ],
            rows: rows.map((r) => ({ nome: r.nome, dataset: r.dataset, descricao: r.descricao })),
          },
        ],
      };
    }

    case "catalogo": {
      const rows = db.prepare(
        `SELECT a.nome, a.tipo, a.area, a.sensibilidade_lgpd, a.linhas, c.nome AS conexao
         FROM data_assets a LEFT JOIN connections c ON c.id = a.connection_id
         WHERE a.workspace_id = 1`
      ).all() as { nome: string; tipo: string; area: string; sensibilidade_lgpd: string; linhas: number; conexao: string }[];
      return {
        answer: `O catálogo tem ${rows.length} ativos de dados governados, vindos de 3 conexões (VTEX, Zendesk e Power BI).`,
        usesPii: false,
        sources: [{ asset: "Data Catalog", connection: "Governance Hub" }],
        blocks: [
          {
            type: "table",
            title: "Ativos no Data Catalog",
            columns: [
              { key: "nome", label: "Ativo" },
              { key: "tipo", label: "Tipo" },
              { key: "area", label: "Área" },
              { key: "lgpd", label: "Sensibilidade LGPD" },
              { key: "linhas", label: "Linhas", align: "right" },
              { key: "conexao", label: "Conexão" },
            ],
            rows: rows.map((r) => ({ nome: r.nome, tipo: r.tipo, area: r.area, lgpd: r.sensibilidade_lgpd, linhas: r.linhas, conexao: r.conexao })),
          },
        ],
      };
    }

    default:
      return {
        answer:
          "Posso responder perguntas sobre os dados conectados. Exemplos: “quais os tickets mais frequentes de clientes que compraram acima de R$500 no último mês?”, “qual o faturamento dos últimos 30 dias?”, “qual o ROAS por canal?”, “gere um criativo para o produto mais vendido”, “quantos tickets abertos temos hoje?”, “quais relatórios já existem no Power BI?”.",
        usesPii: false,
        sources: [],
        blocks: [],
      };
  }
}

// ── Ponto de entrada do Orchestrator ─────────────────────────────────────

export function executeQuestion(question: string, forcedAgentId?: number): ChatResponse {
  const started = Date.now();
  const db = getDb();
  const intent = detectIntent(question);
  const { agents, missing } = pickAgents(intent.tools, forcedAgentId);

  // Governança de escopo: agente fixado sem a ferramenta necessária recusa.
  if (missing.length > 0 && forcedAgentId) {
    const agent = agents[0];
    const nome = agent?.nome ?? "O agente selecionado";
    audit(nome, "agent.recusa", question, `Ferramentas fora do escopo: ${missing.join(", ")}`);
    return {
      answer:
        `${nome} não tem autorização para as ferramentas necessárias (${missing.map((m) => TOOL_LABELS[m] ?? m).join(", ")}). ` +
        (agent?.escopo_trabalho ? `Escopo definido deste agente: ${agent.escopo_trabalho} ` : "") +
        `Por governança, agentes só acessam o que foi explicitamente autorizado — selecione outro agente ou ajuste as skills dele na aba Agentes.`,
      blocks: [],
      agents: agent ? [{ id: agent.id, nome: agent.nome }] : [],
      sources: [],
      masked: false,
      custo: 0,
      duracao_ms: Date.now() - started,
      refused: true,
    };
  }

  if (missing.length > 0) {
    return {
      answer: `Nenhum agente do workspace tem as ferramentas necessárias (${missing.map((m) => TOOL_LABELS[m] ?? m).join(", ")}). Crie ou ajuste um agente na aba Agentes.`,
      blocks: [], agents: [], sources: [], masked: false, custo: 0, duracao_ms: Date.now() - started, refused: true,
    };
  }

  // LGPD: mascara PII a menos que TODOS os agentes executores tenham permissão explícita.
  const mask = agents.length === 0 || agents.some((a) => !a.pode_exibir_pii);
  const result = execIntent(intent, mask, question);

  // Custo simulado por execução (em produção: tokens reais do Agent SDK)
  const custo = agents.length ? Math.round((0.004 + result.answer.length * 0.00002) * agents.length * 10000) / 10000 : 0;
  for (const a of agents) {
    db.prepare("UPDATE agents SET custo_acumulado = custo_acumulado + ?, execucoes = execucoes + 1 WHERE id = ?").run(custo / agents.length, a.id);
  }
  if (agents.length) {
    audit(
      agents.map((a) => a.nome).join(" + "),
      "agent.execucao",
      question.slice(0, 120),
      `Intenção: ${intent.id}; fontes: ${result.sources.map((s) => s.asset).join(", ") || "—"}${result.usesPii && mask ? "; PII mascarado (LGPD)" : ""}`
    );
  }

  return {
    answer: result.answer,
    blocks: result.blocks,
    agents: agents.map((a) => ({ id: a.id, nome: a.nome })),
    sources: result.sources,
    masked: result.usesPii && mask,
    custo,
    duracao_ms: Date.now() - started,
  };
}
