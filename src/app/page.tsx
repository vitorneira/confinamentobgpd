const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
      </main>
    </div>
  );
}
