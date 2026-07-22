"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renderização de markdown (negrito, listas, tabelas) com o espaçamento/tipografia do app. */
export default function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => <ul className="mb-2 last:mb-0 list-disc pl-5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 last:mb-0 list-decimal pl-5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h3 className="font-semibold text-[15px] mt-3 mb-1.5 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h3 className="font-semibold text-[14px] mt-3 mb-1.5 first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="font-semibold mt-2 mb-1 first:mt-0">{children}</h4>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="underline text-[var(--brand-deep)]">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="text-[13px] border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-black/10 px-2 py-1 bg-black/4 text-left">{children}</th>,
          td: ({ children }) => <td className="border border-black/10 px-2 py-1">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
