import { listCategories, listLibraryDocuments } from "@/lib/data";

type Cat = { id: number; nome: string; parentId: number | null };
type Doc = { id: number; categoriaId: number | null; nome: string; tipo: string };

const ICONE: Record<string, string> = {
  pdf: "picture_as_pdf",
  docx: "description",
  doc: "description",
  pptx: "slideshow",
  ppt: "slideshow",
  xlsx: "table_chart",
  xls: "table_chart",
};

function SubPasta({ cat, cats, docs }: { cat: Cat; cats: Cat[]; docs: Doc[] }) {
  const filhas = cats.filter((c) => c.parentId === cat.id);
  const arquivos = docs.filter((d) => d.categoriaId === cat.id);
  if (filhas.length === 0 && arquivos.length === 0) return null;
  return (
    <div className="mt-3 pl-4 border-l-2 border-[var(--grid)]">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-1)]">
        <span className="material-symbols-outlined text-[16px] text-[var(--brand-deep)]">folder</span>
        {cat.nome}
      </div>
      {arquivos.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {arquivos.map((d) => (
            <a
              key={d.id}
              href={`/api/documentos/${d.id}`}
              className="flex items-center gap-2 text-[13px] text-[var(--ink-2)] hover:text-[var(--brand-deep)]"
            >
              <span
                className={`shrink-0 grid place-items-center w-7 h-7 rounded-md material-symbols-outlined text-[16px] ${
                  ICONE[d.tipo] ? "bg-[var(--brand)]/10 text-[var(--brand-deep)]" : "bg-black/5 text-[var(--ink-muted)]"
                }`}
              >
                {ICONE[d.tipo] ?? "description"}
              </span>
              {d.nome}
            </a>
          ))}
        </div>
      )}
      {filhas.map((f) => (
        <SubPasta key={f.id} cat={f} cats={cats} docs={docs} />
      ))}
    </div>
  );
}

function PastaRaiz({ cat, cats, docs }: { cat: Cat; cats: Cat[]; docs: Doc[] }) {
  const filhas = cats.filter((c) => c.parentId === cat.id);
  const arquivos = docs.filter((d) => d.categoriaId === cat.id);
  if (filhas.length === 0 && arquivos.length === 0) return null;
  return (
    <div className="card rounded-2xl p-5">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-[var(--brand)]/10 text-[var(--brand-deep)] grid place-items-center">
          <span className="material-symbols-outlined text-[20px]">folder</span>
        </span>
        <span className="text-[15px] font-semibold truncate">{cat.nome}</span>
      </div>
      {arquivos.length > 0 && (
        <div className="mt-3 space-y-1">
          {arquivos.map((d) => (
            <a
              key={d.id}
              href={`/api/documentos/${d.id}`}
              className="flex items-center gap-2 text-[13px] text-[var(--ink-2)] hover:text-[var(--brand-deep)]"
            >
              <span
                className={`shrink-0 grid place-items-center w-7 h-7 rounded-md material-symbols-outlined text-[16px] ${
                  ICONE[d.tipo] ? "bg-[var(--brand)]/10 text-[var(--brand-deep)]" : "bg-black/5 text-[var(--ink-muted)]"
                }`}
              >
                {ICONE[d.tipo] ?? "description"}
              </span>
              {d.nome}
            </a>
          ))}
        </div>
      )}
      {filhas.map((f) => (
        <SubPasta key={f.id} cat={f} cats={cats} docs={docs} />
      ))}
    </div>
  );
}

export default async function MateriaisPage() {
  const [cats, docsFull] = await Promise.all([listCategories(), listLibraryDocuments()]);
  const docs: Doc[] = docsFull.map((d) => ({ id: d.id, categoriaId: d.categoriaId, nome: d.nome, tipo: d.tipo }));
  const raizes = cats.filter((c) => !c.parentId);

  return (
    <div className="max-w-5xl">
      <h1 className="text-[26px] font-bold text-[var(--brand)]">Materiais</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">Os conteúdos que sua mentora preparou, organizados por tema.</p>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {raizes.map((c) => (
          <PastaRaiz key={c.id} cat={c} cats={cats} docs={docs} />
        ))}
        {docs.length === 0 && <p className="text-sm text-[var(--ink-muted)]">Sua mentora ainda não publicou materiais.</p>}
      </div>
    </div>
  );
}
