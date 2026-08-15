import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getFichaAnimal } from "@/lib/queries/animais";
import { WeightChart } from "@/components/WeightChart";
import { formatData, formatNumero } from "@/lib/format";

export default async function FichaAnimalPage({
  params,
}: {
  params: Promise<{ fazenda: string; id: string }>;
}) {
  const { fazenda: codigo, id } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const ficha = await getFichaAnimal(fazenda.id, id);
  if (!ficha) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{ficha.brinco}</h1>
        <p className="text-sm text-zinc-500">
          Curral {ficha.curralCodigo} · {ficha.categoriaNome}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Origem</p>
          <p className="font-medium text-black dark:text-zinc-50">{ficha.loteOrigem ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Entrada</p>
          <p className="font-medium tabular-nums text-black dark:text-zinc-50">
            {formatData(ficha.dataEntrada)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Peso entrada</p>
          <p className="font-medium tabular-nums text-black dark:text-zinc-50">
            {formatNumero(ficha.pesoEntradaKg)} kg
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Dieta vigente</p>
          <p className="font-medium text-black dark:text-zinc-50">{ficha.dietaAtualNome ?? "—"}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Peso ao longo do tempo
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <WeightChart pontos={ficha.historicoPesagens.map((p) => ({ data: p.data, pesoKg: p.pesoKg }))} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Histórico de pesagens
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2 text-right">Peso (kg)</th>
                <th className="px-3 py-2">Obs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ficha.historicoPesagens.map((p, i) => (
                <tr key={i} className="bg-white dark:bg-zinc-950">
                  <td className="px-3 py-2 tabular-nums">{formatData(p.data)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumero(p.pesoKg)}</td>
                  <td className="px-3 py-2 text-zinc-500">{p.obs ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
