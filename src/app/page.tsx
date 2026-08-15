import { createClient } from "@/lib/supabase/server";
import { signOut } from "./logout/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fazendas } = await supabase.from("fazendas").select("id, codigo, nome").order("codigo");

  const fazendasComContagem = await Promise.all(
    (fazendas ?? []).map(async (f) => {
      const { count } = await supabase
        .from("animais")
        .select("*", { count: "exact", head: true })
        .eq("fazenda_id", f.id);
      return { ...f, numAnimais: count ?? 0 };
    }),
  );

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 px-4 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Sistema de Gestão de Confinamento
            </h1>
            <p className="text-sm text-zinc-500">{user?.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Sair
            </button>
          </form>
        </div>

        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Suas fazendas
        </h2>
        <div className="space-y-3">
          {fazendasComContagem.length === 0 && (
            <p className="text-zinc-500">Nenhuma fazenda vinculada a este usuário.</p>
          )}
          {fazendasComContagem.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <p className="font-medium text-black dark:text-zinc-50">
                  {f.codigo} — {f.nome}
                </p>
              </div>
              <p className="text-lg font-semibold text-black dark:text-zinc-50">
                {f.numAnimais} <span className="text-sm font-normal text-zinc-500">animais</span>
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
