"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";

type Fonte = { tipo: string; titulo: string };
type Msg =
  | { papel: "usuario"; texto: string }
  | { papel: "assistente"; texto: string; fontes: Fonte[]; recusado: boolean };

const ROTULO_FONTE: Record<string, string> = {
  documento: "attach_file",
  metodologia: "explore",
  historico: "timeline",
  prontuario: "history_edu",
  protocolo: "fact_check",
  hipotese: "lightbulb",
};

const GERAL = "";

export default function ChatAssistente({
  casos,
  casoFixo,
  permiteGeral,
  sugestoes,
  alturaFixa,
}: {
  /** Para a mentora (ou participante fora de um caso fixo): lista de casos para escolher o contexto da conversa */
  casos?: { id: number; nome: string }[];
  /** Conversa presa a um caso (página do caso) */
  casoFixo?: number;
  /** Permite conversar sem escolher um caso (dúvidas gerais da participante) */
  permiteGeral?: boolean;
  sugestoes?: string[];
  /** Aba Assistente: ocupa a altura fixa do contêiner pai, só a lista de mensagens rola.
   * Sem isso (uso inline na página do caso): flui com a página, input fica sticky. */
  alturaFixa?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [caseId, setCaseId] = useState<string>(casoFixo ? String(casoFixo) : permiteGeral ? GERAL : casos?.[0]?.id ? String(casos[0].id) : GERAL);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [naLinhaDoTempo, setNaLinhaDoTempo] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function adicionarALinhaDoTempo() {
    if (!conversationId || adicionando) return;
    setAdicionando(true);
    try {
      const res = await fetch(`/api/conversas/${conversationId}`, { method: "POST" });
      if (res.ok) setNaLinhaDoTempo(true);
    } finally {
      setAdicionando(false);
    }
  }

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
        body: JSON.stringify({ pergunta: q, caseId: caseId ? Number(caseId) : undefined, conversationId }),
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

  function trocarCaso(id: string) {
    setCaseId(id);
    setConversationId(undefined);
    setMessages([]);
    setNaLinhaDoTempo(false);
  }

  // O agente pode "falar primeiro": o card de próximo passo (ProximoPassoCaso)
  // dispara este evento com a pergunta certa para a etapa atual do caso.
  const perguntarRef = useRef(perguntar);
  perguntarRef.current = perguntar;
  useEffect(() => {
    function aoIniciar(e: Event) {
      const pergunta = (e as CustomEvent<{ pergunta: string }>).detail?.pergunta;
      if (pergunta) perguntarRef.current(pergunta);
    }
    window.addEventListener("iniciar-mentor", aoIniciar);
    return () => window.removeEventListener("iniciar-mentor", aoIniciar);
  }, []);

  const seletorCaso = casos && casos.length > 0 && !casoFixo && (
    <div className={alturaFixa ? "shrink-0 pb-3 mb-1 border-b border-[var(--grid)]" : ""}>
      <label className="text-sm text-[var(--ink-2)] flex items-center gap-2">
        Conversando sobre:
        <select value={caseId} onChange={(e) => trocarCaso(e.target.value)} className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-sm">
          {permiteGeral && <option value={GERAL}>Conversa geral (sem caso específico)</option>}
          {casos.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>
    </div>
  );

  const listaMensagens = (
    <>
      {messages.length === 0 && (
        <div className="text-center py-10 space-y-3">
          <div className="w-20 h-20 bg-[var(--leaf-container)]/50 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined fill-icon text-[var(--leaf)] text-[40px]">psychology</span>
          </div>
          <h2 className="text-xl font-semibold text-[var(--brand)]">Vamos pensar juntos sobre este caso?</h2>
          <p className="text-[14px] text-[var(--ink-2)] max-w-md mx-auto">
            Eu não dou respostas prontas — conduzo você pelas perguntas que ajudam a organizar o raciocínio clínico.
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

      <div className="space-y-6 py-1">
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
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-low)] border border-[var(--grid)] px-2.5 py-0.5">
                        {ROTULO_FONTE[f.tipo] && (
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                            {ROTULO_FONTE[f.tipo]}
                          </span>
                        )}
                        {f.titulo}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {loading && <div className="text-sm text-[var(--ink-muted)] animate-pulse pl-11">Organizando o raciocínio…</div>}
        {conversationId && !loading && (
          <div className="pl-11">
            {naLinhaDoTempo ? (
              <span className="text-[12px] text-[var(--leaf)]">✓ Adicionada à linha do tempo do caso</span>
            ) : (
              <button
                onClick={adicionarALinhaDoTempo}
                disabled={adicionando}
                className="text-[12px] text-[var(--ink-muted)] hover:text-[var(--brand-deep)] underline decoration-dotted disabled:opacity-50"
              >
                {adicionando ? "Adicionando…" : "+ Adicionar esta conversa à linha do tempo do caso"}
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </>
  );

  const formulario = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        perguntar(input);
      }}
      className={alturaFixa ? "shrink-0 pt-4" : "sticky bottom-4"}
    >
      <div className="flex items-center bg-white rounded-[24px] border border-[var(--grid)] shadow-lg p-2 gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Conte o que você observou…"
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
        O agente não diagnostica nem substitui a supervisão da mentora — a decisão final é sempre sua.
      </p>
    </form>
  );

  if (alturaFixa) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {seletorCaso}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">{listaMensagens}</div>
        {formulario}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {seletorCaso}
      {listaMensagens}
      {formulario}
    </div>
  );
}
