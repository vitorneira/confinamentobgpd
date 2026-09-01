"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Warehouse } from "lucide-react";

// Nível superior novo (handoff Ordens de Serviço §1) — "Confinamento" e
// "Ordens de Serviço" lado a lado. Cada um carrega sua própria navegação
// interna (a barra de abas por fazenda continua em [fazenda]/layout.tsx; a
// Fila tem seus próprios filtros). Este componente só decide qual dos dois
// mundos está ativo.
export function TopNav() {
  const pathname = usePathname();
  const emOrdensServico = pathname?.startsWith("/ordens-servico");

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4">
        <span className="mr-4 py-3 text-sm font-semibold text-black dark:text-zinc-50">
          Confinamento BG/PD
        </span>
        <Link
          href="/"
          className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium ${
            emOrdensServico
              ? "border-transparent text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              : "border-primary-500 text-black dark:text-zinc-50"
          }`}
        >
          <Warehouse size={16} />
          Confinamento
        </Link>
        <Link
          href="/ordens-servico"
          className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium ${
            emOrdensServico
              ? "border-primary-500 text-black dark:text-zinc-50"
              : "border-transparent text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          }`}
        >
          <ClipboardList size={16} />
          Ordens de Serviço
        </Link>
      </div>
    </header>
  );
}
