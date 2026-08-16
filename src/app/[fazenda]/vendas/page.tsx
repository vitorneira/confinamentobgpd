import Link from "next/link";
import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getCurraisComAtivos, getAnimaisAtivosDoCurral, getVendasFechadas } from "@/lib/queries/vendas";
import { FechamentoForm } from "./FechamentoForm";
import { formatData, formatMoeda } from "@/lib/format";

export default async function VendasPage({
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

  const [currais, vendas] = await Promise.all([getCurraisComAtivos(fazenda.id), getVendasFechadas(fazenda.id)]);
  const animais = curralId ? await getAnimaisAtivosDoCurral(fazenda.id, curralId) : [];

  const base = `/${codigo.toLowerCase()}/vendas`;

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Fechamento de lote / Venda</h1>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Vendas fechadas</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Data saída</th>
                <th className="px-3 py-2">Curral</th>
                <th className="px-3 py-2">Frigorífico</th>
                <th className="px-3 py-2 text-right">Cabeças</th>
                <th className="px-3 py-2 text-right">Lucro/lote</th>
                <th className="px-3 py-2 text-right">Lucro/cab</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {vendas.map((v) => (
                <tr key={v.vendaLoteId} className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                  <td className="px-3 py-2">
                    <Link href={`${base}/${v.vendaLoteId}`} className="font-medium text-black underline dark:text-zinc-50">
                      {formatData(v.dataSaida)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{v.curralCodigo}</td>
                  <td className="px-3 py-2">{v.frigorifico ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.cabecas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(v.lucroLote)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(v.lucroPorCab)}</td>
                </tr>
              ))}
              {vendas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                    Nenhuma venda fechada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Fechar novo lote</h2>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Curral</span>
            <select
              name="curral"
              defaultValue={curralId ?? ""}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Selecione um curral</option>
              {currais.map((c) => (
                <option key={c.curralId} value={c.curralId}>
                  {c.curralCodigo} ({c.cabecasAtivas} cabeças ativas)
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Selecionar
          </button>
        </form>

        {curralId && (
          <FechamentoForm fazendaCodigo={codigo} fazendaId={fazenda.id} curralId={curralId} animais={animais} />
        )}
      </section>
    </div>
  );
}
