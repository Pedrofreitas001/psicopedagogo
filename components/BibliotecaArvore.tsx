"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Cat = { id: number; nome: string; parentId: number | null };
export type Doc = { id: number; categoriaId: number | null; nome: string; tipo: string; conteudo: string; disponivelAssistente: boolean };

const ICONE: Record<string, string> = { pdf: "📕", docx: "📘", doc: "📘", pptx: "📙", ppt: "📙", xlsx: "📗", xls: "📗" };

function DocumentoLinha({ doc }: { doc: Doc }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [conteudo, setConteudo] = useState(doc.conteudo);
  const [disponivel, setDisponivel] = useState(doc.disponivelAssistente);
  const [loading, setLoading] = useState(false);

  async function salvar() {
    setLoading(true);
    await fetch(`/api/documentos/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo, disponivelAssistente: disponivel }),
    });
    setLoading(false);
    setEditando(false);
    router.refresh();
  }

  async function alternarDisponibilidade() {
    const novo = !disponivel;
    setDisponivel(novo);
    await fetch(`/api/documentos/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disponivelAssistente: novo }),
    });
    router.refresh();
  }

  async function excluir() {
    if (!confirm(`Excluir "${doc.nome}"? Essa ação não pode ser desfeita.`)) return;
    await fetch(`/api/documentos/${doc.id}`, { method: "DELETE" });
    router.refresh();
  }

  const temConteudo = conteudo.trim().length > 0;

  return (
    <div className="mt-1.5 ml-5 text-[13.5px] text-[var(--ink-2)]">
      <div className="flex items-center gap-2 flex-wrap">
        <a href={`/api/documentos/${doc.id}`} className="flex items-center gap-2 hover:text-[var(--brand-deep)]">
          {ICONE[doc.tipo] ?? "📄"} {doc.nome}
        </a>
        {temConteudo ? (
          <button
            onClick={alternarDisponibilidade}
            title="Clique para tirar do cérebro do assistente"
            className={`text-[10.5px] rounded-full px-1.5 py-0.5 ${disponivel ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
          >
            {disponivel ? "assistente ✓" : "revisão pendente"}
          </button>
        ) : (
          <span title="Sem resumo de conteúdo — o assistente não usa este arquivo" className="text-[10.5px] rounded-full bg-black/5 text-[var(--ink-muted)] px-1.5 py-0.5">
            sem conteúdo
          </span>
        )}
        <button onClick={() => setEditando((v) => !v)} className="text-[11px] text-[var(--brand-deep)] hover:underline">
          {editando ? "fechar" : temConteudo ? "editar" : "completar conteúdo"}
        </button>
        <button onClick={excluir} className="text-[11px] text-[var(--ink-muted)] hover:text-red-600">
          excluir
        </button>
      </div>
      {editando && (
        <div className="mt-2 rounded-lg border border-black/10 bg-white p-3 max-w-xl">
          <label className="text-[12px] text-[var(--ink-muted)]">Resumo de conteúdo (base do assistente)</label>
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-black/10 px-2 py-1.5 text-[13px]"
            placeholder="Cole aqui os pontos principais do material — depois de revisar, disponibilize para o assistente."
          />
          <label className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--ink-2)]">
            <input type="checkbox" checked={disponivel} onChange={(e) => setDisponivel(e.target.checked)} />
            Disponível para o assistente
          </label>
          <button onClick={salvar} disabled={loading} className="mt-2 rounded-md bg-[var(--brand)] text-white px-3 py-1.5 text-[12.5px] disabled:opacity-50">
            {loading ? "Salvando…" : "Salvar"}
          </button>
        </div>
      )}
    </div>
  );
}

function Pasta({ cat, cats, docs, nivel }: { cat: Cat; cats: Cat[]; docs: Doc[]; nivel: number }) {
  const router = useRouter();
  const filhas = cats.filter((c) => c.parentId === cat.id);
  const arquivos = docs.filter((d) => d.categoriaId === cat.id);

  async function excluirPasta() {
    if (filhas.length > 0 || arquivos.length > 0) {
      alert("Essa pasta não está vazia. Mova ou exclua as subpastas e os arquivos primeiro.");
      return;
    }
    if (!confirm(`Excluir a pasta "${cat.nome}"?`)) return;
    const res = await fetch(`/api/categorias/${cat.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Não foi possível excluir a pasta.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ marginLeft: nivel * 16 }} className="mt-3">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold">📁 {cat.nome}</span>
        <button onClick={excluirPasta} className="text-[11px] text-[var(--ink-muted)] hover:text-red-600">
          excluir pasta
        </button>
      </div>
      {arquivos.map((d) => (
        <DocumentoLinha key={d.id} doc={d} />
      ))}
      {filhas.map((f) => (
        <Pasta key={f.id} cat={f} cats={cats} docs={docs} nivel={nivel + 1} />
      ))}
    </div>
  );
}

export default function BibliotecaArvore({ cats, docs }: { cats: Cat[]; docs: Doc[] }) {
  const raizes = cats.filter((c) => !c.parentId);
  if (raizes.length === 0) return <p className="text-sm text-[var(--ink-muted)]">Crie a primeira pasta para começar.</p>;
  return (
    <div>
      {raizes.map((c) => (
        <Pasta key={c.id} cat={c} cats={cats} docs={docs} nivel={0} />
      ))}
    </div>
  );
}
