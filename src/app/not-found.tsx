import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-card border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-xl font-semibold text-black dark:text-zinc-50">Página não encontrada</h1>
        <p className="mb-6 text-sm text-zinc-500">
          O que você procura não existe ou foi movido — confira o endereço ou volte para o início.
        </p>
        <Link
          href="/"
          className="inline-block rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white dark:bg-primary-500 dark:text-white"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
