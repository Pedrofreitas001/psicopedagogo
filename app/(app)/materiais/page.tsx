import { listCategories, listLibraryDocuments } from "@/lib/data";

type Cat = { id: number; nome: string; parentId: number | null };
type Doc = { id: number; categoriaId: number | null; nome: string; tipo: string };

const ICONE: Record<string, string> = { pdf: "📕", docx: "📘", doc: "📘", pptx: "📙", ppt: "📙", xlsx: "📗", xls: "📗" };

function Pasta({ cat, cats, docs, nivel }: { cat: Cat; cats: Cat[]; docs: Doc[]; nivel: number }) {
  const filhas = cats.filter((c) => c.parentId === cat.id);
  const arquivos = docs.filter((d) => d.categoriaId === cat.id);
  if (filhas.length === 0 && arquivos.length === 0) return null;
  return (
    <div style={{ marginLeft: nivel * 16 }} className="mt-3">
      <div className="text-[14px] font-semibold text-[var(--ink-1)]">📁 {cat.nome}</div>
      {arquivos.map((d) => (
        <a
          key={d.id}
          href={`/api/documentos/${d.id}`}
          className="mt-1.5 ml-5 flex items-center gap-2 text-[13.5px] text-[var(--ink-2)] hover:text-[var(--brand-deep)]"
        >
          {ICONE[d.tipo] ?? "📄"} {d.nome}
        </a>
      ))}
      {filhas.map((f) => (
        <Pasta key={f.id} cat={f} cats={cats} docs={docs} nivel={nivel + 1} />
      ))}
    </div>
  );
}

export default async function MateriaisPage() {
  const [cats, docsFull] = await Promise.all([listCategories(), listLibraryDocuments()]);
  const docs: Doc[] = docsFull.map((d) => ({ id: d.id, categoriaId: d.categoriaId, nome: d.nome, tipo: d.tipo }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-[26px] font-bold text-[var(--brand)]">Materiais</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">Os conteúdos que sua mentora preparou, organizados por tema.</p>
      <div className="mt-6 card rounded-2xl p-6">
        {cats.filter((c) => !c.parentId).map((c) => (
          <Pasta key={c.id} cat={c} cats={cats} docs={docs} nivel={0} />
        ))}
        {docs.length === 0 && <p className="text-sm text-[var(--ink-muted)]">Sua mentora ainda não publicou materiais.</p>}
      </div>
    </div>
  );
}
