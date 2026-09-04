"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Calculator,
  Fence,
  LayoutDashboard,
  Menu,
  PawPrint,
  Receipt,
  Scale,
  Trees,
  Truck,
  Package,
  X,
} from "lucide-react";

type ItemNav = { href: string; label: string; Icone: typeof LayoutDashboard };

export function MobileBottomNav({ base }: { base: string }) {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);

  const principais: ItemNav[] = [
    { href: `${base}/dashboard`, label: "Painel", Icone: LayoutDashboard },
    { href: `${base}/animais`, label: "Animais", Icone: PawPrint },
    { href: `${base}/pesagens`, label: "Pesagens", Icone: Scale },
    { href: `${base}/dashboard#alertas`, label: "Alertas", Icone: Bell },
  ];

  const maisItens: ItemNav[] = [
    { href: `${base}/currais`, label: "Currais", Icone: Fence },
    { href: `${base}/pastos`, label: "Pastos", Icone: Trees },
    { href: `${base}/guia-trato`, label: "Guia de Trato", Icone: Truck },
    { href: `${base}/insumos`, label: "Insumos", Icone: Package },
    { href: `${base}/vendas`, label: "Vendas", Icone: Receipt },
    { href: `${base}/simulacao`, label: "Simulação", Icone: Calculator },
  ];

  function ativo(href: string) {
    return pathname === href.split("#")[0];
  }

  return (
    <>
      {maisAberto && (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMaisAberto(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-card border-t border-zinc-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-black dark:text-zinc-50">Mais</p>
              <button
                aria-label="Fechar"
                onClick={() => setMaisAberto(false)}
                className="flex h-8 w-8 items-center justify-center rounded-btn text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {maisItens.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMaisAberto(false)}
                  className="flex flex-col items-center gap-1.5 rounded-card border border-zinc-200 p-3 text-center text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                >
                  <item.Icone size={20} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="Navegação principal"
      >
        <div className="grid grid-cols-5">
          {principais.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                ativo(item.href) ? "text-primary-700 dark:text-primary-300" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <item.Icone size={20} />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400"
          >
            <Menu size={20} />
            Mais
          </button>
        </div>
      </nav>
    </>
  );
}
