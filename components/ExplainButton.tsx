"use client";

import { useState } from "react";

export default function ExplainButton({ queryId }: { queryId: number }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function explain() {
    setLoading(true);
    const res = await fetch(`/api/queries/${queryId}/explain`, { method: "POST" });
    const data = await res.json();
    setText(data.explicacao ?? data.error);
    setLoading(false);
  }

  return (
    <div>
      {text ? (
        <p className="text-[13px] text-[var(--ink-2)] bg-[var(--brand)]/5 border border-[var(--brand)]/20 rounded-lg px-3 py-2 leading-relaxed">
          <span className="font-medium text-[var(--brand)]">Explicação: </span>
          {text.replace(/\*\*/g, "")}
        </p>
      ) : (
        <button onClick={explain} disabled={loading} className="text-[13px] text-[var(--brand)] border border-[var(--brand)]/30 rounded-lg px-3 py-1.5 hover:bg-[var(--brand)]/5 disabled:opacity-50">
          {loading ? "Analisando…" : "✨ Explicar com IA"}
        </button>
      )}
    </div>
  );
}
