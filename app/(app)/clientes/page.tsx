import Link from "next/link";
import { redirect } from "next/navigation";
import { listClientsWithLastEvent } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ClienteForm from "@/components/ClienteForm";

export default async function ClientesPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");
  const clientes = await listClientsWithLastEvent();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold text-[var(--brand)]">Clientes</h1>
        <ClienteForm />
      </div>
      <div className="mt-6 card rounded-2xl divide-y divide-black/5">
        {clientes.map((c) => (
          <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-black/2">
            <div className="h-9 w-9 rounded-full bg-[var(--brand)]/12 text-[var(--brand-deep)] grid place-items-center text-sm font-semibold shrink-0">
              {c.nome.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                {c.nome}
                {c.idade ? <span className="text-[var(--ink-muted)] font-normal"> · {c.idade} anos</span> : null}
              </div>
              <div className="text-[12.5px] text-[var(--ink-muted)] truncate">{c.queixaPrincipal || c.objetivo || "Sem informações ainda"}</div>
            </div>
            <div className="text-[11.5px] text-[var(--ink-muted)] shrink-0">
              {c.ultimoEvento ? `último registro ${c.ultimoEvento.slice(0, 10).split("-").reverse().join("/")}` : "sem registros"}
            </div>
          </Link>
        ))}
        {clientes.length === 0 && <p className="px-5 py-6 text-sm text-[var(--ink-muted)]">Cadastre o primeiro cliente para começar o acompanhamento.</p>}
      </div>
    </div>
  );
}
