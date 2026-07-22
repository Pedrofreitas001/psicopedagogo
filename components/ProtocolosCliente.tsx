"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Assignment = {
  id: number;
  protocolId: number;
  protocolNome: string;
  dataAplicacao: string;
  status: "em_andamento" | "concluido";
  criadoPor: string;
};

type ProtocolSummary = { id: number; nome: string; descricao: string; versao: string };

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function dataBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Aba de Protocolos do cliente: associar protocolos internalizados e acompanhar o resultado de cada aplicação. */
export default function ProtocolosCliente({ clienteId, assignments }: { clienteId: number; assignments: Assignment[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [protocolos, setProtocolos] = useState<ProtocolSummary[] | null>(null);
  const [protocolId, setProtocolId] = useState<string>("");
  const [data, setData] = useState(hoje());
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || protocolos) return;
    fetch("/api/protocolos")
      .then((r) => r.json())
      .then((lista: ProtocolSummary[]) => {
        setProtocolos(lista);
        if (lista.length > 0) setProtocolId(String(lista[0].id));
      });
  }, [aberto, protocolos]);

  async function associar(e: React.FormEvent) {
    e.preventDefault();
    if (!protocolId) return;
    setLoading(true);
    setErro(null);
    const res = await fetch(`/api/clientes/${clienteId}/protocolos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolId: Number(protocolId), dataAplicacao: data }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErro(body.error ?? "Não foi possível associar o protocolo.");
      return;
    }
    setAberto(false);
    setData(hoje());
    router.refresh();
    router.push(`/protocolos/${body.id}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><span className="material-symbols-outlined text-[20px] text-[var(--brand)]">fact_check</span> Protocolos</h2>
        {!aberto && (
          <button onClick={() => setAberto(true)} className="rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium">
            + Associar protocolo
          </button>
        )}
      </div>

      {aberto && (
        <form onSubmit={associar} className="mt-3 rounded-xl border border-[var(--grid)] bg-[var(--surface-low)] p-4 space-y-3">
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Protocolo</span>
            {protocolos === null ? (
              <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Carregando…</p>
            ) : protocolos.length === 0 ? (
              <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Nenhum protocolo internalizado ainda.</p>
            ) : (
              <select value={protocolId} onChange={(e) => setProtocolId(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm">
                {protocolos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} (v{p.versao})
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Data de aplicação</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="mt-1 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm" />
          </label>
          {erro && <p className="text-[13px] text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading || !protocolId} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm disabled:opacity-50">
              {loading ? "Associando…" : "Associar"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-black/10 px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {assignments.map((a) => (
          <Link
            key={a.id}
            href={`/protocolos/${a.id}`}
            className="flex items-center justify-between rounded-xl border border-[var(--grid)] bg-[var(--surface-low)] p-4 hover:border-[var(--brand)]/40"
          >
            <div>
              <div className="text-[13.5px] font-medium">{a.protocolNome}</div>
              <div className="text-[11.5px] text-[var(--ink-muted)]">Aplicado em {dataBr(a.dataAplicacao)} · por {a.criadoPor}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                a.status === "concluido" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {a.status === "concluido" ? "Concluído" : "Em andamento"}
            </span>
          </Link>
        ))}
        {assignments.length === 0 && <p className="mt-2 text-sm text-[var(--ink-muted)]">Nenhum protocolo associado ainda.</p>}
      </div>
    </div>
  );
}
