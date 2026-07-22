"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Fluxo do produto: Novo documento → Categoria → Salvar. */
export default function UploadForm({
  categorias,
  clientId,
  comConteudo = true,
}: {
  /** Upload para a biblioteca (mentora): escolhe a pasta */
  categorias?: { id: number; nome: string }[];
  /** Upload para os arquivos de um cliente */
  clientId?: number;
  comConteudo?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<string>(categorias?.[0]?.id ? String(categorias[0].id) : "");
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setLoading(true);
    setErro(null);
    const form = new FormData();
    form.set("arquivo", arquivo);
    if (categoria) form.set("categoriaId", categoria);
    if (clientId) form.set("clientId", String(clientId));
    if (conteudo.trim()) form.set("conteudo", conteudo.trim());
    const res = await fetch("/api/documentos", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErro(data.error ?? "Falha no envio.");
      return;
    }
    setAberto(false);
    setArquivo(null);
    setConteudo("");
    router.refresh();
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium">
        + Novo documento
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="card rounded-2xl p-5 space-y-3 max-w-lg">
      <label className="block text-sm">
        <span className="text-[var(--ink-2)]">Arquivo (PDF, Word, PowerPoint ou Excel)</span>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md"
          required
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)]/10 file:px-3 file:py-1.5 file:text-[var(--brand-deep)] file:text-sm"
        />
      </label>
      {categorias && (
        <label className="block text-sm">
          <span className="text-[var(--ink-2)]">Categoria</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm">
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
      )}
      {comConteudo && (
        <label className="block text-sm">
          <span className="text-[var(--ink-2)]">Resumo do conteúdo para o assistente (opcional)</span>
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={4}
            placeholder="Cole aqui os pontos principais do material — é isso que o assistente usa para responder."
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm"
          />
        </label>
      )}
      {erro && <p className="text-[13px] text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !arquivo} className="rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          {loading ? "Enviando…" : "Salvar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-black/10 px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
