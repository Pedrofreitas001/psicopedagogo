"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CampoTipo = "texto" | "textarea" | "numero" | "single_select" | "multi_select" | "tabela";
type TabelaConfig = {
  linhas: { key: string; label: string }[];
  colunas: { key: string; label: string; tipo: "texto" | "numero" | "select"; opcoes?: string[] }[];
};
type Campo = { id: number; chave: string; label: string; tipo: CampoTipo; opcoes: string[] | TabelaConfig | null };
type Secao = { id: number; titulo: string; campos: Campo[] };
type Protocolo = { id: number; nome: string; descricao: string; versao: string; secoes: Secao[] };

type ValorCampo = string | number | string[] | Record<string, Record<string, string | number>> | null;
type Respostas = Record<number, ValorCampo>;

export default function ProtocolForm({
  assignmentId,
  clientId,
  protocolo,
  respostasIniciais,
  status,
}: {
  assignmentId: number;
  clientId: number;
  protocolo: Protocolo;
  respostasIniciais: { fieldId: number; valor: ValorCampo }[];
  status: "em_andamento" | "concluido";
}) {
  const router = useRouter();
  const [valores, setValores] = useState<Respostas>(() => Object.fromEntries(respostasIniciais.map((r) => [r.fieldId, r.valor])));
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [statusAtual, setStatusAtual] = useState(status);

  function set(fieldId: number, valor: ValorCampo) {
    setValores((v) => ({ ...v, [fieldId]: valor }));
    setSalvo(false);
  }

  function setTabelaCelula(fieldId: number, linhaKey: string, colunaKey: string, valor: string) {
    setValores((v) => {
      const atual = (v[fieldId] as Record<string, Record<string, string | number>>) ?? {};
      const linha = { ...(atual[linhaKey] ?? {}), [colunaKey]: valor };
      return { ...v, [fieldId]: { ...atual, [linhaKey]: linha } };
    });
    setSalvo(false);
  }

  async function salvar() {
    setSalvando(true);
    const respostas = Object.entries(valores).map(([fieldId, valor]) => ({ fieldId: Number(fieldId), valor }));
    await fetch(`/api/protocolos/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respostas }),
    });
    setSalvando(false);
    setSalvo(true);
    router.refresh();
  }

  async function alternarStatus() {
    const novo = statusAtual === "concluido" ? "em_andamento" : "concluido";
    setStatusAtual(novo);
    await fetch(`/api/protocolos/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    router.refresh();
  }

  async function excluir() {
    if (!confirm(`Excluir esta aplicação de "${protocolo.nome}"? As respostas registradas serão perdidas.`)) return;
    await fetch(`/api/protocolos/assignments/${assignmentId}`, { method: "DELETE" });
    router.push(`/clientes/${clientId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={alternarStatus}
          className={`rounded-full px-3 py-1 text-[12px] font-medium border ${
            statusAtual === "concluido" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {statusAtual === "concluido" ? "✓ Concluído — clique para reabrir" : "Em andamento — marcar como concluído"}
        </button>
        <button onClick={excluir} className="ml-auto text-[12px] text-[var(--ink-muted)] hover:text-red-600">
          Excluir aplicação
        </button>
      </div>

      {protocolo.secoes.map((secao) => (
        <div key={secao.id} className="rounded-2xl border border-black/8 bg-[var(--surface-1)] p-5">
          <h3 className="text-[14px] font-semibold mb-3">{secao.titulo}</h3>
          <div className="space-y-4">
            {secao.campos.map((campo) => (
              <CampoInput key={campo.id} campo={campo} valor={valores[campo.id] ?? null} onChange={(v) => set(campo.id, v)} onChangeCelula={(l, c, v) => setTabelaCelula(campo.id, l, c, v)} />
            ))}
          </div>
        </div>
      ))}

      <div className="sticky bottom-4 flex items-center gap-3">
        <button onClick={salvar} disabled={salvando} className="rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-5 py-2.5 text-sm font-medium shadow disabled:opacity-50">
          {salvando ? "Salvando…" : "Salvar respostas"}
        </button>
        {salvo && <span className="text-[12.5px] text-emerald-700">Salvo ✓</span>}
      </div>
    </div>
  );
}

function CampoInput({
  campo,
  valor,
  onChange,
  onChangeCelula,
}: {
  campo: Campo;
  valor: ValorCampo;
  onChange: (v: ValorCampo) => void;
  onChangeCelula: (linhaKey: string, colunaKey: string, valor: string) => void;
}) {
  const inputCls = "mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm";

  if (campo.tipo === "texto") {
    return (
      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">{campo.label}</span>
        <input type="text" value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      </label>
    );
  }

  if (campo.tipo === "textarea") {
    return (
      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">{campo.label}</span>
        <textarea rows={3} value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      </label>
    );
  }

  if (campo.tipo === "numero") {
    return (
      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">{campo.label}</span>
        <input
          type="number"
          value={valor === null || valor === undefined ? "" : (valor as number)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={inputCls}
        />
      </label>
    );
  }

  if (campo.tipo === "single_select") {
    const opcoes = (campo.opcoes as string[]) ?? [];
    return (
      <div className="text-sm">
        <span className="text-[var(--ink-2)]">{campo.label}</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {opcoes.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onChange(op)}
              className={`rounded-full border px-3 py-1 text-[12px] ${
                valor === op ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-deep)] font-medium" : "border-black/10 bg-white hover:bg-black/4"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (campo.tipo === "multi_select") {
    const opcoes = (campo.opcoes as string[]) ?? [];
    const selecionadas = Array.isArray(valor) ? (valor as string[]) : [];
    function alternar(op: string) {
      onChange(selecionadas.includes(op) ? selecionadas.filter((o) => o !== op) : [...selecionadas, op]);
    }
    return (
      <div className="text-sm">
        <span className="text-[var(--ink-2)]">{campo.label}</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {opcoes.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => alternar(op)}
              className={`rounded-full border px-3 py-1 text-[12px] ${
                selecionadas.includes(op) ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-deep)] font-medium" : "border-black/10 bg-white hover:bg-black/4"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // tabela
  const config = campo.opcoes as TabelaConfig | null;
  if (!config) return null;
  const registro = (valor as Record<string, Record<string, string | number>>) ?? {};
  return (
    <div className="text-sm">
      <span className="text-[var(--ink-2)]">{campo.label}</span>
      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr>
              <th className="border border-black/10 px-2 py-1.5 bg-black/4 text-left"> </th>
              {config.colunas.map((c) => (
                <th key={c.key} className="border border-black/10 px-2 py-1.5 bg-black/4 text-left whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.linhas.map((linha) => (
              <tr key={linha.key}>
                <td className="border border-black/10 px-2 py-1.5 font-medium">{linha.label}</td>
                {config.colunas.map((coluna) => {
                  const cellVal = registro[linha.key]?.[coluna.key] ?? "";
                  if (coluna.tipo === "select") {
                    return (
                      <td key={coluna.key} className="border border-black/10 px-1 py-1">
                        <select
                          value={String(cellVal)}
                          onChange={(e) => onChangeCelula(linha.key, coluna.key, e.target.value)}
                          className="w-full rounded border border-black/10 bg-white px-1.5 py-1 text-[12px]"
                        >
                          <option value=""></option>
                          {(coluna.opcoes ?? []).map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  }
                  return (
                    <td key={coluna.key} className="border border-black/10 px-1 py-1">
                      <input
                        type={coluna.tipo === "numero" ? "number" : "text"}
                        value={cellVal}
                        onChange={(e) => onChangeCelula(linha.key, coluna.key, e.target.value)}
                        className="w-full rounded border border-black/10 bg-white px-1.5 py-1 text-[12px]"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
