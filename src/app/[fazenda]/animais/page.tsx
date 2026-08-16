import Link from "next/link";
import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getAnimaisIndicadores, getCurraisEcategorias } from "@/lib/queries/animais";
import { StatusBadge } from "@/components/StatusBadge";
import { ScrollHint } from "@/components/ScrollHint";
import { formatNumero } from "@/lib/format";

export default async function AnimaisPage({
  params,
  searchParams,
}: {
  params: Promise<{ fazenda: string }>;
  searchParams: Promise<{ curral?: string; categoria?: string }>;
}) {
  const { fazenda: codigo } = await params;
  const { curral, categoria } = await searchParams;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const [{ currais, categorias }, animais] = await Promise.all([
    getCurraisEcategorias(fazenda.id),
    getAnimaisIndicadores(fazenda.id, { curralCodigo: curral, categoriaNome: categoria }),
  ]);

  const base = `/${codigo.toLowerCase()}/animais`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Animais</h1>

      <form className="mb-4 flex flex-wrap gap-3" method="get">
        <select
          name="curral"
          defaultValue={curral ?? ""}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Todos os currais</option>
          {currais.map((c) => (
            <option key={c.id} value={c.codigo}>
              Curral {c.codigo}
            </option>
          ))}
        </select>
        <select
          name="categoria"
          defaultValue={categoria ?? ""}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Filtrar
        </button>
        {(curral || categoria) && (
          <Link href={base} className="self-center text-sm text-zinc-500 underline">
            limpar
          </Link>
        )}
      </form>

      <p className="mb-2 text-sm text-zinc-500">{animais.length} animais</p>

      <ScrollHint />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Brinco</th>
              <th className="px-3 py-2">Curral</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2 text-right">Peso (kg)</th>
              <th className="px-3 py-2 text-right">Dias conf.</th>
              <th className="px-3 py-2 text-right">GMD</th>
              <th className="px-3 py-2 text-right">@ viva</th>
              <th className="px-3 py-2">Pesagem</th>
              <th className="px-3 py-2">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {animais.map((a) => (
              <tr key={a.animalId} className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                <td className="px-3 py-2">
                  <Link href={`${base}/${a.animalId}`} className="font-medium text-black underline dark:text-zinc-50">
                    {a.brinco}
                  </Link>
                </td>
                <td className="px-3 py-2">{a.curralCodigo}</td>
                <td className="px-3 py-2">{a.categoriaNome}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumero(a.pesoAtualKg)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumero(a.diasConfinado)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumero(a.gmdKgDia, 3)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumero(a.arrobaViva, 1)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={a.alertaPesagem} />
                </td>
                <td className="px-3 py-2">
                  {a.atingiuMetaGmd === null ? "—" : a.atingiuMetaGmd ? "✓" : "✗"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
