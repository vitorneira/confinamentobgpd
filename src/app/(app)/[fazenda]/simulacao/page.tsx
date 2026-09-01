import { notFound } from "next/navigation";
import { getCurraisIndicadores, getFazendaByCodigo, getParametros } from "@/lib/queries/fazenda";
import { SimuladorCurral } from "./SimuladorCurral";

export default async function SimulacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ fazenda: string }>;
  searchParams: Promise<{ curral?: string }>;
}) {
  const { fazenda: codigo } = await params;
  const { curral: curralId } = await searchParams;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const parametros = await getParametros(fazenda.id);
  if (!parametros) notFound();

  const currais = await getCurraisIndicadores(fazenda.id);
  const curralSelecionado = curralId ? currais.find((c) => c.curral_id === curralId) : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Simulação</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Projeta peso de abate, receita, custo e lucro com rendimento e preço hipotéticos. Não grava nada —
          é só um &quot;e se&quot;.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Curral</span>
          <select
            name="curral"
            defaultValue={curralId ?? ""}
            className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Selecione um curral</option>
            {currais.map((c) => (
              <option key={c.curral_id} value={c.curral_id}>
                {c.codigo} ({c.num_cabecas} cabeças)
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white dark:bg-primary-500 dark:text-white"
        >
          Selecionar
        </button>
      </form>

      {curralSelecionado && (
        <SimuladorCurral
          key={curralSelecionado.curral_id}
          curral={curralSelecionado}
          dataReferencia={parametros.data_referencia}
          precoArrobaReferencia={parametros.preco_arroba_referencia}
          pesoAbateAlvoPadrao={parametros.peso_abate_alvo}
        />
      )}
    </div>
  );
}
