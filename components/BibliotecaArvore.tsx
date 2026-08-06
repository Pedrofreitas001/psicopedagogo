"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Cat = { id: number; nome: string; parentId: number | null };
export type Doc = { id: number; categoriaId: number | null; nome: string; tipo: string; conteudo: string; disponivelAssistente: boolean };

const ICONE: Record<string, string> = {
  pdf: "picture_as_pdf",
  docx: "description",
  doc: "description",
  pptx: "slideshow",
  ppt: "slideshow",
  xlsx: "table_chart",
  xls: "table_chart",
};

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
    <div className="rounded-lg hover:bg-[var(--surface-low)] px-2 py-1.5 -mx-2 text-[13px] text-[var(--ink-2)]">
      <div className="flex items-center gap-2 flex-wrap">
        <a href={`/api/documentos/${doc.id}`} className="flex items-center gap-2 min-w-0 hover:text-[var(--brand-deep)]">
          <span
            className={`shrink-0 grid place-items-center w-7 h-7 rounded-md material-symbols-outlined text-[16px] ${
              ICONE[doc.tipo] ? "bg-[var(--brand)]/10 text-[var(--brand-deep)]" : "bg-black/5 text-[var(--ink-muted)]"
            }`}
          >
            {ICONE[doc.tipo] ?? "description"}
          </span>
          <span className="truncate">{doc.nome}</span>
        </a>
        {temConteudo ? (
          <button
            onClick={alternarDisponibilidade}
            title="Clique para tirar do cérebro do assistente"
            className={`shrink-0 text-[10.5px] rounded-full px-1.5 py-0.5 ${disponivel ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
          >
            {disponivel ? "assistente ✓" : "revisão pendente"}
          </button>
        ) : (
          <span
            title="Sem resumo de conteúdo — o assistente não usa este arquivo"
            className="shrink-0 text-[10.5px] rounded-full bg-black/5 text-[var(--ink-muted)] px-1.5 py-0.5"
          >
            sem conteúdo
          </span>
        )}
        <button onClick={() => setEditando((v) => !v)} className="shrink-0 text-[11px] text-[var(--brand-deep)] hover:underline">
          {editando ? "fechar" : temConteudo ? "editar" : "completar conteúdo"}
        </button>
        <button onClick={excluir} className="shrink-0 text-[11px] text-[var(--ink-muted)] hover:text-red-600">
          excluir
        </button>
      </div>
      {editando && (
        <div className="mt-2 rounded-lg border border-black/10 bg-white p-3">
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

async function excluirPastaSeVazia(catId: number, nome: string, temFilhos: boolean, router: ReturnType<typeof useRouter>) {
  if (temFilhos) {
    alert("Essa pasta não está vazia. Mova ou exclua as subpastas e os arquivos primeiro.");
    return;
  }
  if (!confirm(`Excluir a pasta "${nome}"?`)) return;
  const res = await fetch(`/api/categorias/${catId}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error ?? "Não foi possível excluir a pasta.");
    return;
  }
  router.refresh();
}

function SubPasta({ cat, cats, docs }: { cat: Cat; cats: Cat[]; docs: Doc[] }) {
  const router = useRouter();
  const filhas = cats.filter((c) => c.parentId === cat.id);
  const arquivos = docs.filter((d) => d.categoriaId === cat.id);

  return (
    <div className="mt-3 pl-4 border-l-2 border-[var(--grid)]">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-[var(--brand-deep)]">folder</span>
        <span className="text-[13px] font-semibold">{cat.nome}</span>
        <button
          onClick={() => excluirPastaSeVazia(cat.id, cat.nome, filhas.length > 0 || arquivos.length > 0, router)}
          className="text-[11px] text-[var(--ink-muted)] hover:text-red-600"
        >
          excluir pasta
        </button>
      </div>
      {arquivos.length > 0 && <div className="mt-1.5 space-y-0.5">{arquivos.map((d) => <DocumentoLinha key={d.id} doc={d} />)}</div>}
      {filhas.map((f) => (
        <SubPasta key={f.id} cat={f} cats={cats} docs={docs} />
      ))}
    </div>
  );
}

function PastaRaiz({ cat, cats, docs }: { cat: Cat; cats: Cat[]; docs: Doc[] }) {
  const router = useRouter();
  const filhas = cats.filter((c) => c.parentId === cat.id);
  const arquivos = docs.filter((d) => d.categoriaId === cat.id);

  return (
    <div className="card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 w-9 h-9 rounded-lg bg-[var(--brand)]/10 text-[var(--brand-deep)] grid place-items-center">
            <span className="material-symbols-outlined text-[20px]">folder</span>
          </span>
          <span className="text-[15px] font-semibold truncate">{cat.nome}</span>
        </div>
        <button
          onClick={() => excluirPastaSeVazia(cat.id, cat.nome, filhas.length > 0 || arquivos.length > 0, router)}
          className="shrink-0 text-[11px] text-[var(--ink-muted)] hover:text-red-600"
        >
          excluir pasta
        </button>
      </div>
      {arquivos.length > 0 && <div className="mt-3 space-y-0.5">{arquivos.map((d) => <DocumentoLinha key={d.id} doc={d} />)}</div>}
      {filhas.map((f) => (
        <SubPasta key={f.id} cat={f} cats={cats} docs={docs} />
      ))}
      {arquivos.length === 0 && filhas.length === 0 && <p className="mt-3 text-[12.5px] text-[var(--ink-muted)]">Pasta vazia.</p>}
    </div>
  );
}

export default function BibliotecaArvore({ cats, docs }: { cats: Cat[]; docs: Doc[] }) {
  const raizes = cats.filter((c) => !c.parentId);
  if (raizes.length === 0) return <p className="text-sm text-[var(--ink-muted)]">Crie a primeira pasta para começar.</p>;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {raizes.map((c) => (
        <PastaRaiz key={c.id} cat={c} cats={cats} docs={docs} />
      ))}
    </div>
  );
}
