"use client";

import { usePathname } from "next/navigation";

/** Aba Assistente ocupa 100% da área principal, sem o padding/scroll padrão
 * das demais páginas — o chat preenche a aba inteira, sem rolagem de página. */
export default function MainArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cheia = pathname === "/assistente";

  return (
    <main
      className={
        cheia
          ? "flex-1 min-h-0 overflow-hidden max-w-[1700px] w-full flex flex-col"
          : "flex-1 min-h-0 overflow-y-auto px-4 py-6 md:px-10 md:py-8 max-w-[1700px] w-full"
      }
    >
      {children}
    </main>
  );
}
