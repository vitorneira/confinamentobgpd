import Link from "next/link";
import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getItensConfirmacao } from "@/lib/queries/guia-trato";
import { getCurraisEcategorias } from "@/lib/queries/animais";
import { LinhaConfirmacao } from "./LinhaConfirmacao";
import { ScrollHint } from "@/components/ScrollHint";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function ConfirmacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ fazenda: string }>;
  searchParams: Promise<{ curral?: string; status?: string; dataInicio?: string; dataFim?: string }>;
}) {
  const { fazenda: codigo } = await params;
  const { curral: curralId, status, dataInicio, dataFim } = await searchParams;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const filtroDataInicio = dataInicio ?? diasAtras(14);
  const filtroDataFim = dataFim ?? hojeISO();

  const [{ currais }, itensTodos] = await Promise.all([
    getCurraisEcategorias(fazenda.id),
    getItensConfirmacao(fazenda.id, { curralId, dataInicio: filtroDataInicio, dataFim: filtroDataFim }),
  ]);

  const itens =
    status === "pendente"
      ? itensTodos.filter((i) => !i.confirmado)
      : status === "confirmado"
        ? itensTodos.filter((i) => i.confirmado)
        : itensTodos;

  const base = `/${codigo.toLowerCase()}/guia-trato`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={base} className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
        ← guia de trato
      </Link>
      <h1 className="mt-1 mb-1 text-xl font-semibold text-black dark:text-zinc-50">Confirmação de tratos</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Confirme se a quantidade servida por curral/dia foi mesmo a planejada, ou edite antes de confirmar. Só ao
        confirmar o custo real é gravado.
      </p>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Curral</span>
          <select
            name="curral"
            defaultValue={curralId ?? ""}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todos os currais</option>
            {currais.map((c) => (
              <option key={c.id as string} value={c.id as string}>
                {c.codigo as string}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Status</span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">De</span>
          <input
            type="date"
            name="dataInicio"
            defaultValue={filtroDataInicio}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Até</span>
          <input
            type="date"
            name="dataFim"
            defaultValue={filtroDataFim}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Filtrar
        </button>
      </form>

      <p className="mb-2 text-sm text-zinc-500">
        {itens.length} {itens.length === 1 ? "item" : "itens"} · {itensTodos.filter((i) => !i.confirmado).length}{" "}
        pendente(s) no período
      </p>

      <ScrollHint />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Curral</th>
              <th className="px-3 py-2">Dieta</th>
              <th className="px-3 py-2 text-right">Kg planejado</th>
              <th className="px-3 py-2 text-right">Kg a confirmar</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {itens.map((item) => (
              <LinhaConfirmacao
                key={`${item.curralId}|${item.data}`}
                fazendaCodigo={codigo}
                fazendaId={fazenda.id}
                item={item}
              />
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  Nada nesse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
