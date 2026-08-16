import { notFound } from "next/navigation";
import { getFazendaByCodigo, getParametros } from "@/lib/queries/fazenda";
import {
  getCompras,
  getCurraisComVigencias,
  getDietasComComposicao,
  getIngredientesComEstoque,
} from "@/lib/queries/insumos";
import { CompraForm } from "./CompraForm";
import { DietasEditor } from "./DietasEditor";
import { VigenciaForm } from "./VigenciaForm";
import { StatusBadge } from "@/components/StatusBadge";
import { ScrollHint } from "@/components/ScrollHint";
import { formatData, formatMoeda, formatNumero } from "@/lib/format";

export default async function InsumosPage({
  params,
}: {
  params: Promise<{ fazenda: string }>;
}) {
  const { fazenda: codigo } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const parametros = await getParametros(fazenda.id);
  if (!parametros) notFound();

  const [compras, ingredientes, dietas, currais] = await Promise.all([
    getCompras(fazenda.id),
    getIngredientesComEstoque(fazenda.id),
    getDietasComComposicao(fazenda.id),
    getCurraisComVigencias(fazenda.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Insumos, estoque e dietas</h1>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Compras</h2>
        <div className="mb-4 rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <CompraForm fazendaCodigo={codigo} fazendaId={fazenda.id} ingredientes={ingredientes} />
        </div>
        <ScrollHint />
        <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Insumo</th>
                <th className="px-3 py-2 text-right">Preço/kg</th>
                <th className="px-3 py-2 text-right">Qtd (kg)</th>
                <th className="px-3 py-2">Fornecedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {compras.map((c) => (
                <tr key={c.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-3 py-2">{formatData(c.data)}</td>
                  <td className="px-3 py-2">{c.ingredienteNome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(c.precoKg, 4)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumero(c.qtdKg)}</td>
                  <td className="px-3 py-2">{c.fornecedor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Estoque</h2>
        <ScrollHint />
        <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Insumo</th>
                <th className="px-3 py-2 text-right">Preço atual (R$/kg)</th>
                <th className="px-3 py-2 text-right">Estoque atual (kg)</th>
                <th className="px-3 py-2 text-right">Dias de estoque</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ingredientes.map((i) => {
                const status =
                  i.diasDeEstoque === null
                    ? null
                    : i.diasDeEstoque < parametros.alerta_estoque_dias / 2
                      ? "critico"
                      : i.diasDeEstoque < parametros.alerta_estoque_dias
                        ? "atencao"
                        : "ok";
                return (
                  <tr key={i.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-3 py-2">{i.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(i.precoAtual, 4)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {i.estoqueAtualKg === null ? "indisponível" : formatNumero(i.estoqueAtualKg)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {i.diasDeEstoque === null ? "—" : formatNumero(i.diasDeEstoque, 1)}
                    </td>
                    <td className="px-3 py-2">{status && <StatusBadge status={status} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Dietas (composição — só dono edita)
        </h2>
        <DietasEditor
          fazendaCodigo={codigo}
          fazendaId={fazenda.id}
          dietas={dietas}
          todosIngredientes={ingredientes.map((i) => ({ id: i.id, nome: i.nome }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Vigência de dieta por curral
        </h2>
        <VigenciaForm
          fazendaCodigo={codigo}
          currais={currais}
          dietas={dietas.map((d) => ({ id: d.id, nome: d.nome }))}
        />
      </section>
    </div>
  );
}
