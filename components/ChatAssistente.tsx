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
        <div className="text-center py-10 space-y-3">
          <div className="w-20 h-20 bg-[var(--leaf-container)]/50 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined fill-icon text-[var(--leaf)] text-[40px]">psychology</span>
          </div>
          <h2 className="text-xl font-semibold text-[var(--brand)]">Como posso ajudar hoje?</h2>
          <p className="text-[14px] text-[var(--ink-2)] max-w-md mx-auto">
            Respondo com base nos materiais, no prontuário e nos protocolos que a mentora preparou.
          </p>
          {sugestoes && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  onClick={() => perguntar(s)}
                  className="text-[13px] rounded-full border border-[var(--leaf)]/25 bg-white text-[var(--leaf)] px-4 py-2 shadow-sm hover:bg-[var(--leaf)]/5 active:scale-95 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {messages.map((msg, idx) =>
          msg.papel === "usuario" ? (
            <div key={idx} className="flex justify-end gap-3 items-start">
              <div className="max-w-[80%] bg-white border border-[var(--grid)] shadow-[var(--card-shadow)] rounded-2xl rounded-br-sm px-4 py-3 text-sm">
                {msg.texto}
              </div>
              <div className="w-8 h-8 rounded-full bg-[var(--surface-high)] shrink-0 flex items-center justify-center text-[var(--ink-2)]">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
            </div>
          ) : (
            <div key={idx} className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-[var(--leaf)] text-white shrink-0 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined fill-icon text-[18px]">psychology</span>
              </div>
              <div className="max-w-[88%] space-y-2">
                <div
                  className={`rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm leading-relaxed border ${
                    msg.recusado ? "border-amber-300 bg-amber-50" : "border-[var(--leaf)]/10 bg-[var(--leaf)]/8"
                  }`}
                >
                  <Markdown>{msg.texto}</Markdown>
                </div>
                {msg.fontes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 text-[11.5px] text-[var(--ink-muted)]">
                    {msg.fontes.map((f, i) => (
                      <span key={i} className="rounded-full bg-[var(--surface-low)] border border-[var(--grid)] px-2.5 py-0.5">
                        {ROTULO_FONTE[f.tipo] ?? "•"} {f.titulo}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {loading && <div className="text-sm text-[var(--ink-muted)] animate-pulse pl-11">Consultando os materiais da mentora…</div>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          perguntar(input);
        }}
        className="sticky bottom-4"
      >
        <div className="flex items-center bg-white rounded-[24px] border border-[var(--grid)] shadow-lg p-2 gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta…"
            className="flex-1 bg-transparent border-none px-3 py-2.5 text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--ink-muted)]/70">
          A IA pode errar. Confirme informações clínicas antes de registrá-las no prontuário.
        </p>
      </form>
    </div>
  );
}
