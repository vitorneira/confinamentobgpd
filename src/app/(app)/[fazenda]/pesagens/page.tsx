import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { createClient } from "@/lib/supabase/server";
import { compararCodigo } from "@/lib/format";
import { ImportarPlanilha } from "./ImportarPlanilha";
import { LancamentoManual } from "./LancamentoManual";

export default async function PesagensPage({
  params,
}: {
  params: Promise<{ fazenda: string }>;
}) {
  const { fazenda: codigo } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const supabase = await createClient();
  const { data: curraisRaw } = await supabase
    .from("currais")
    .select("id, codigo")
    .eq("fazenda_id", fazenda.id);
  const currais = [...(curraisRaw ?? [])].sort((a, b) => compararCodigo(a.codigo as string, b.codigo as string));

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Pesagens</h1>
        <a
          href={`/api/pesagens-planilha?fazenda=${codigo}`}
          className="flex items-center gap-1 text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          <FileDown size={14} /> Exportar histórico (Excel)
        </a>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Gerar folha de campo (PDF)
        </h2>
        <form
          action="/api/folha-campo"
          method="get"
          target="_blank"
          className="flex flex-wrap items-end gap-3 rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <input type="hidden" name="fazenda" value={fazenda.codigo} />
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Curral</span>
            <select
              name="curral"
              className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {(currais ?? []).map((c) => (
                <option key={c.id} value={c.codigo}>
                  {c.codigo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Modo</span>
            <select
              name="modo"
              className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="individual">Individual (brincos já cadastrados)</option>
              <option value="agregado">Agregado (linhas numeradas)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Qtd (só agregado)</span>
            <input
              type="number"
              name="quantidade"
              defaultValue={0}
              className="w-24 rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white dark:bg-primary-500 dark:text-white"
          >
            Gerar PDF
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Importar planilha preenchida
        </h2>
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <ImportarPlanilha fazendaCodigo={codigo} fazendaId={fazenda.id} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Lançamento manual
        </h2>
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <LancamentoManual fazendaCodigo={codigo} fazendaId={fazenda.id} currais={currais ?? []} />
        </div>
      </section>
    </div>
  );
}
