"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NovaPasta({ categorias }: { categorias: { id: number; nome: string }[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [parent, setParent] = useState("");
  const [loading, setLoading] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, parentId: parent ? Number(parent) : null }),
    });
    setLoading(false);
    setAberto(false);
    setNome("");
    router.refresh();
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/4">
        + Nova pasta
      </button>
    );
  }
  return (
    <form onSubmit={criar} className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        <span className="block text-[var(--ink-2)] text-[12px]">Nome da pasta</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} required className="mt-1 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="block text-[var(--ink-2)] text-[12px]">Dentro de</span>
        <select value={parent} onChange={(e) => setParent(e.target.value)} className="mt-1 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm">
          <option value="">(raiz)</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={loading || !nome.trim()} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm disabled:opacity-50">
        Criar
      </button>
      <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-black/10 px-3 py-2 text-sm">
        Cancelar
      </button>
    </form>
  );
}
