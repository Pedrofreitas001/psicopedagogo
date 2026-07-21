import { redirect } from "next/navigation";
import { listCategories, listLibraryDocuments } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import UploadForm from "@/components/UploadForm";
import NovaPasta from "@/components/NovaPasta";
import BibliotecaArvore, { type Cat } from "@/components/BibliotecaArvore";

function caminho(cat: Cat, cats: Cat[]): string {
  const partes = [cat.nome];
  let atual = cat;
  while (atual.parentId) {
    const pai = cats.find((c) => c.id === atual.parentId);
    if (!pai) break;
    partes.unshift(pai.nome);
    atual = pai;
  }
  return partes.join(" › ");
}

export default async function BibliotecaPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");
  const [cats, docs] = await Promise.all([listCategories(), listLibraryDocuments()]);

  const opcoesCategoria = cats.map((c) => ({ id: c.id, nome: caminho(c, cats) })).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Biblioteca</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">
        PDF, Word, PowerPoint e Excel organizados por pastas. Revise o conteúdo de cada arquivo e disponibilize para o assistente quando estiver pronto.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <UploadForm categorias={opcoesCategoria} />
        <NovaPasta categorias={opcoesCategoria} />
      </div>
      <div className="mt-6 rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6">
        <BibliotecaArvore cats={cats} docs={docs.map((d) => ({ id: d.id, categoriaId: d.categoriaId, nome: d.nome, tipo: d.tipo, conteudo: d.conteudo, disponivelAssistente: d.disponivelAssistente }))} />
      </div>
    </div>
  );
}
