import { getDb } from "@/lib/db";

type Cat = { id: number; nome: string; parent_id: number | null };
type Doc = { id: number; categoria_id: number; nome: string; tipo: string; criado_em: string };

const ICONE: Record<string, string> = { pdf: "📕", docx: "📘", doc: "📘", pptx: "📙", ppt: "📙", xlsx: "📗", xls: "📗" };

function Pasta({ cat, cats, docs, nivel }: { cat: Cat; cats: Cat[]; docs: Doc[]; nivel: number }) {
  const filhas = cats.filter((c) => c.parent_id === cat.id);
  const arquivos = docs.filter((d) => d.categoria_id === cat.id);
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
  const db = getDb();
  const cats = db.prepare("SELECT id, nome, parent_id FROM categories WHERE workspace_id = 1 ORDER BY nome").all() as Cat[];
  const docs = db
    .prepare("SELECT id, categoria_id, nome, tipo, criado_em FROM documents WHERE workspace_id = 1 AND categoria_id IS NOT NULL ORDER BY nome")
    .all() as Doc[];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Materiais</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">Os conteúdos que sua mentora preparou, organizados por tema.</p>
      <div className="mt-6 rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6">
        {cats.filter((c) => !c.parent_id).map((c) => (
          <Pasta key={c.id} cat={c} cats={cats} docs={docs} nivel={0} />
        ))}
        {docs.length === 0 && <p className="text-sm text-[var(--ink-muted)]">Sua mentora ainda não publicou materiais.</p>}
      </div>
    </div>
  );
}
