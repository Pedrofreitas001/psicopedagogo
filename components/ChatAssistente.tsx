"use client";

import { useRef, useState } from "react";
import Markdown from "./Markdown";

type Fonte = { tipo: string; titulo: string };
type Msg =
  | { papel: "usuario"; texto: string }
  | { papel: "assistente"; texto: string; fontes: Fonte[]; recusado: boolean };

const ROTULO_FONTE: Record<string, string> = { documento: "📄", metodologia: "🧭", historico: "🕰️", prontuario: "🗒️", protocolo: "🧩" };

export default function ChatAssistente({
  clientes,
  clienteFixo,
  sugestoes,
}: {
  /** Para a mentora: lista de clientes para escolher o contexto da conversa */
  clientes?: { id: number; nome: string }[];
  /** Conversa presa a um cliente (página do cliente ou visão do próprio cliente) */
  clienteFixo?: number;
  sugestoes?: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [clienteId, setClienteId] = useState<string>(clienteFixo ? String(clienteFixo) : (clientes?.[0]?.id ? String(clientes[0].id) : ""));
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function perguntar(texto: string) {
    const q = texto.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { papel: "usuario", texto: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: q, clientId: clienteId ? Number(clienteId) : undefined, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { papel: "assistente", texto: data.error ?? "Algo deu errado. Tente de novo.", fontes: [], recusado: true }]);
        return;
      }
      setConversationId(data.conversationId);
      setMessages((m) => [...m, { papel: "assistente", texto: data.resposta, fontes: data.fontes ?? [], recusado: data.recusado }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function trocarCliente(id: string) {
    setClienteId(id);
    setConversationId(undefined);
    setMessages([]);
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {clientes && clientes.length > 0 && !clienteFixo && (
        <label className="text-sm text-[var(--ink-2)] flex items-center gap-2">
          Conversando no contexto de:
          <select value={clienteId} onChange={(e) => trocarCliente(e.target.value)} className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-sm">
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
      )}

      {messages.length === 0 && (
        <div className="rounded-2xl border border-black/8 bg-[var(--surface-1)] p-8 text-center">
          <div className="text-3xl">🌱</div>
          <h2 className="mt-3 text-xl font-semibold">Olá!</h2>
          <p className="text-[15px] text-[var(--ink-2)]">Como posso ajudar?</p>
          {sugestoes && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  onClick={() => perguntar(s)}
                  className="text-[13px] rounded-full border border-[var(--brand)]/25 bg-[var(--brand)]/5 text-[var(--brand-deep)] px-3 py-1.5 hover:bg-[var(--brand)]/10"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {messages.map((msg, idx) =>
          msg.papel === "usuario" ? (
            <div key={idx} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--brand)] text-white px-4 py-2.5 text-sm">{msg.texto}</div>
            </div>
          ) : (
            <div key={idx} className="max-w-[92%] space-y-2">
              <div
                className={`rounded-2xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed ${
                  msg.recusado ? "border-amber-300 bg-amber-50" : "border-black/8 bg-[var(--surface-1)]"
                }`}
              >
                <Markdown>{msg.texto}</Markdown>
              </div>
              {msg.fontes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[11.5px] text-[var(--ink-muted)]">
                  {msg.fontes.map((f, i) => (
                    <span key={i} className="rounded-full bg-black/4 px-2 py-0.5">
                      {ROTULO_FONTE[f.tipo] ?? "•"} {f.titulo}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        {loading && <div className="text-sm text-[var(--ink-muted)] animate-pulse">Consultando os materiais da mentora…</div>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          perguntar(input);
        }}
        className="sticky bottom-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua pergunta…"
          className="flex-1 rounded-xl border border-black/12 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:border-[var(--brand)]"
        />
        <button type="submit" disabled={loading || !input.trim()} className="rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-5 text-sm font-medium disabled:opacity-40">
          Enviar
        </button>
      </form>
    </div>
  );
}
