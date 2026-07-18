import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import UploadForm from "@/components/UploadForm";
import NovaPasta from "@/components/NovaPasta";

type Cat = { id: number; nome: string; parent_id: number | null };
type Doc = { id: number; categoria_id: number; nome: string; tipo: string; conteudo: string };

const ICONE: Record<string, string> = { pdf: "📕", docx: "📘", doc: "📘", pptx: "📙", ppt: "📙", xlsx: "📗", xls: "📗" };

function caminho(cat: Cat, cats: Cat[]): string {
  const partes = [cat.nome];
  let atual = cat;
  while (atual.parent_id) {
    const pai = cats.find((c) => c.id === atual.parent_id);
    if (!pai) break;
    partes.unshift(pai.nome);
    atual = pai;
  }
  return partes.join(" › ");
}

function Pasta({ cat, cats, docs, nivel }: { cat: Cat; cats: Cat[]; docs: Doc[]; nivel: number }) {
  const filhas = cats.filter((c) => c.parent_id === cat.id);
  const arquivos = docs.filter((d) => d.categoria_id === cat.id);
  return (
    <div style={{ marginLeft: nivel * 16 }} className="mt-3">
      <div className="text-[14px] font-semibold">📁 {cat.nome}</div>
      {arquivos.map((d) => (
        <div key={d.id} className="mt-1.5 ml-5 flex items-center gap-2 text-[13.5px] text-[var(--ink-2)]">
          <a href={`/api/documentos/${d.id}`} className="flex items-center gap-2 hover:text-[var(--brand-deep)]">
            {ICONE[d.tipo] ?? "📄"} {d.nome}
          </a>
          {d.conteudo ? (
            <span title="Faz parte da base do assistente" className="text-[10.5px] rounded-full bg-emerald-50 text-emerald-700 px-1.5 py-0.5">
              assistente ✓
            </span>
          ) : (
            <span title="Sem resumo de conteúdo — o assistente não usa este arquivo" className="text-[10.5px] rounded-full bg-black/5 text-[var(--ink-muted)] px-1.5 py-0.5">
              sem conteúdo
            </span>
          )}
        </div>
      ))}
      {filhas.map((f) => (
        <Pasta key={f.id} cat={f} cats={cats} docs={docs} nivel={nivel + 1} />
      ))}
    </div>
  );
}

export default async function BibliotecaPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");
  const db = getDb();
  const cats = db.prepare("SELECT id, nome, parent_id FROM categories WHERE workspace_id = 1 ORDER BY nome").all() as Cat[];
  const docs = db
    .prepare("SELECT id, categoria_id, nome, tipo, conteudo FROM documents WHERE workspace_id = 1 AND categoria_id IS NOT NULL ORDER BY nome")
    .all() as Doc[];

  const opcoesCategoria = cats.map((c) => ({ id: c.id, nome: caminho(c, cats) })).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Biblioteca</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">
        PDF, Word, PowerPoint e Excel organizados por pastas. O que tiver resumo de conteúdo vira base do assistente.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <UploadForm categorias={opcoesCategoria} />
        <NovaPasta categorias={opcoesCategoria} />
      </div>
      <div className="mt-6 rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6">
        {cats.filter((c) => !c.parent_id).map((c) => (
          <Pasta key={c.id} cat={c} cats={cats} docs={docs} nivel={0} />
        ))}
        {cats.length === 0 && <p className="text-sm text-[var(--ink-muted)]">Crie a primeira pasta para começar.</p>}
      </div>
    </div>
  );
}
