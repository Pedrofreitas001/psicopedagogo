"use client";

import { useRef, useState } from "react";
import type { ChatResponse } from "@/lib/types";
import SpecRenderer from "./SpecRenderer";

const SUGESTOES = [
  "Quais os tickets de suporte mais frequentes de clientes que compraram acima de R$500 no último mês?",
  "Qual o faturamento dos últimos 30 dias?",
  "Quantos tickets abertos temos hoje?",
  "Quais os produtos mais vendidos?",
  "Qual o CSAT médio por categoria?",
  "Quais relatórios já existem no Power BI?",
  "Mostre a fila de suporte em kanban",
];

type Msg = { role: "user"; text: string } | { role: "assistant"; res: ChatResponse; question: string };

export default function ChatClient({ agents }: { agents: { id: number; nome: string }[] }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, agentId: agentId || undefined }),
      });
      const data: ChatResponse = await res.json();
      setMessages((m) => [...m, { role: "assistant", res: data, question: q }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  async function saveDashboard(idx: number, msg: Extract<Msg, { role: "assistant" }>) {
    const titulo = window.prompt("Nome do dashboard:", msg.question.slice(0, 60));
    if (!titulo) return;
    await fetch("/api/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, descricao: msg.question, spec_json: msg.res.blocks }),
    });
    setSavedIdx((s) => new Set(s).add(idx));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-[var(--ink-2)]">Roteamento:</label>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">Automático (Orchestrator escolhe o agente)</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>Fixar: {a.nome}</option>
          ))}
        </select>
      </div>

      {messages.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/15 bg-white/60 p-5">
          <p className="text-sm text-[var(--ink-2)] mb-3">
            Pergunte em linguagem natural sobre os dados conectados (VTEX, Zendesk, Power BI). Experimente:
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-left text-[13px] rounded-full border border-[var(--brand)]/25 bg-[var(--brand)]/5 text-[var(--brand)] px-3 py-1.5 hover:bg-[var(--brand)]/10"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {messages.map((msg, idx) =>
          msg.role === "user" ? (
            <div key={idx} className="flex justify-end">
              <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-[var(--brand)] text-white px-4 py-2.5 text-sm">
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={idx} className="max-w-[95%] space-y-3">
              <div className={`rounded-2xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed ${msg.res.refused ? "border-amber-300 bg-amber-50" : "border-black/10 bg-white"}`}>
                {msg.res.answer}
              </div>
              {msg.res.blocks.map((spec, i) => (
                <SpecRenderer key={i} spec={spec} />
              ))}
              <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-muted)]">
                {msg.res.agents.map((a) => (
                  <span key={a.id} className="rounded-full bg-violet-100 text-violet-800 px-2 py-0.5">🤖 {a.nome}</span>
                ))}
                {msg.res.sources.map((s) => (
                  <span key={s.asset} className="rounded-full bg-blue-50 text-blue-800 px-2 py-0.5">
                    Fonte: {s.asset} · {s.connection}
                  </span>
                ))}
                {msg.res.masked && (
                  <span className="rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5">🔒 PII mascarado (LGPD)</span>
                )}
                {msg.res.agents.length > 0 && <span>custo ~US$ {msg.res.custo.toFixed(4)} · {msg.res.duracao_ms}ms</span>}
                {msg.res.blocks.length > 0 &&
                  (savedIdx.has(idx) ? (
                    <span className="text-emerald-700">✓ salvo em Dashboards</span>
                  ) : (
                    <button
                      onClick={() => saveDashboard(idx, msg)}
                      className="rounded-md border border-black/10 bg-white px-2 py-0.5 hover:bg-black/4 text-[var(--ink-2)]"
                    >
                      Salvar como dashboard
                    </button>
                  ))}
              </div>
            </div>
          )
        )}
        {loading && <div className="text-sm text-[var(--ink-muted)] animate-pulse">Orquestrando agentes…</div>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Faça uma pergunta sobre os dados…"
          className="flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:border-[var(--brand)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-[var(--brand)] text-white px-5 text-sm font-medium disabled:opacity-40"
        >
          Perguntar
        </button>
      </form>
    </div>
  );
}
