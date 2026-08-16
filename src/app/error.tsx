"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-xl font-semibold text-black dark:text-zinc-50">Algo deu errado</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Não conseguimos carregar essa página. Tente de novo — se continuar acontecendo, avise o suporte.
        </p>
        <button
          onClick={reset}
          className="inline-block rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
