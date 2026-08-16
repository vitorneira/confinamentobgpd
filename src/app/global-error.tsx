"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm rounded-card border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-black">Algo deu errado</h1>
          <p className="mb-6 text-sm text-zinc-500">
            O sistema encontrou um problema inesperado. Tente de novo — se continuar acontecendo, avise o suporte.
          </p>
          <button
            onClick={reset}
            className="inline-block rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white"
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
