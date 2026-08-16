import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getCurraisComAtivos, getAnimaisAtivosDoCurral, getVendasFechadas } from "@/lib/queries/vendas";
import { FechamentoForm } from "./FechamentoForm";
import { ScrollHint } from "@/components/ScrollHint";
import { corResultado, formatData, formatMoeda } from "@/lib/format";

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
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Fechamento de lote / Venda</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Apuração completa (custo real, lucro, margem, ROI) ao vender um lote ou parte dele.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Vendas fechadas</h2>
        <ScrollHint />
        <div className="overflow-hidden rounded-card border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-4 py-3">Data saída</th>
                  <th className="px-4 py-3">Curral</th>
                  <th className="px-4 py-3">Frigorífico</th>
                  <th className="px-4 py-3 text-right">Cabeças</th>
                  <th className="px-4 py-3 text-right">Lucro/lote</th>
                  <th className="px-4 py-3 text-right">Lucro/cab</th>
                  <th className="px-4 py-3 text-right">Relatório</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {vendas.map((v) => (
                  <tr key={v.vendaLoteId} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`${base}/${v.vendaLoteId}`}
                        className="font-medium text-black hover:underline dark:text-zinc-50"
                      >
                        {formatData(v.dataSaida)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{v.curralCodigo}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{v.frigorifico ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{v.cabecas}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${corResultado(v.lucroLote)}`}>
                      {formatMoeda(v.lucroLote)}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${corResultado(v.lucroPorCab)}`}>
                      {formatMoeda(v.lucroPorCab)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/api/venda-recibo?fazenda=${codigo}&id=${v.vendaLoteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-btn border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <FileDown size={13} /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
                {vendas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      Nenhuma venda fechada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Fechar novo lote</h2>
        <div className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Curral</span>
              <select
                name="curral"
                defaultValue={curralId ?? ""}
                className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
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
              className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white dark:bg-primary-500 dark:text-white"
            >
              Selecionar
            </button>
          </form>

          {curralId && (
            <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <FechamentoForm fazendaCodigo={codigo} fazendaId={fazenda.id} curralId={curralId} animais={animais} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
