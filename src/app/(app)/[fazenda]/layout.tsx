import Link from "next/link";
import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileBottomNav } from "@/components/nav/MobileBottomNav";

export default async function FazendaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ fazenda: string }>;
}) {
  const { fazenda: codigo } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const base = `/${codigo.toLowerCase()}`;

  return (
    <div className="flex flex-1 flex-col">
      {/* Desktop: nav horizontal completa. Mobile: só branding + fazenda + tema
          (a navegação em si vira a barra inferior fixa, ver MobileBottomNav). */}
      <nav className="border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto hidden max-w-4xl items-center gap-6 overflow-x-auto py-3 text-sm font-medium text-zinc-600 sm:flex dark:text-zinc-400">
          <Link href="/" className="whitespace-nowrap text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            ← fazendas
          </Link>
          <span className="whitespace-nowrap font-semibold text-black dark:text-zinc-50">
            {fazenda.codigo}
          </span>
          <Link href={`${base}/dashboard`} className="whitespace-nowrap hover:text-black dark:hover:text-zinc-50">
            Dashboard
          </Link>
          <Link href={`${base}/animais`} className="whitespace-nowrap hover:text-black dark:hover:text-zinc-50">
            Animais
          </Link>
          <Link href={`${base}/pesagens`} className="whitespace-nowrap hover:text-black dark:hover:text-zinc-50">
            Pesagens
          </Link>
          <Link href={`${base}/currais`} className="whitespace-nowrap hover:text-black dark:hover:text-zinc-50">
            Currais
          </Link>
          <Link href={`${base}/guia-trato`} className="whitespace-nowrap hover:text-black dark:hover:text-zinc-50">
            Guia de Trato
          </Link>
          <Link href={`${base}/insumos`} className="whitespace-nowrap hover:text-black dark:hover:text-zinc-50">
            Insumos
          </Link>
          <Link href={`${base}/vendas`} className="whitespace-nowrap hover:text-black dark:hover:text-zinc-50">
            Vendas
          </Link>
          <Link href={`${base}/simulacao`} className="whitespace-nowrap hover:text-black dark:hover:text-zinc-50">
            Simulação
          </Link>
          <span className="ml-auto">
            <ThemeToggle />
          </span>
        </div>

        <div className="flex items-center justify-between py-3 sm:hidden">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            ← fazendas
          </Link>
          <span className="text-sm font-semibold text-black dark:text-zinc-50">{fazenda.codigo}</span>
          <ThemeToggle />
        </div>
      </nav>

      <div className="flex-1 bg-zinc-50 pb-16 sm:pb-0 dark:bg-black">{children}</div>

      <MobileBottomNav base={base} />
    </div>
  );
}
