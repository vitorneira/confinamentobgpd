const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null;
const supabaseConfigured = !!url && !!key;

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-6 py-32 px-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Sistema de Gestão de Confinamento
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Barra Grande (BG) e Pau D&apos;Arco (PD)
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Conexão com Supabase:{" "}
          <span className={supabaseConfigured ? "text-green-600" : "text-red-600"}>
            {supabaseConfigured ? "configurada" : "não configurada"}
          </span>
        </p>
        {/* DEBUG TEMPORÁRIO — remover depois de diagnosticar o env var na Vercel */}
        <div className="mt-8 max-w-lg rounded border border-zinc-300 bg-white p-4 text-left text-xs font-mono text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <div>NEXT_PUBLIC_SUPABASE_URL = {url === null ? "(undefined)" : `"${url}"`}</div>
          <div>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = {key === null ? "(undefined)" : `"${key}"`}</div>
        </div>
      </main>
    </div>
  );
}
