import { notFound } from "next/navigation";
import {
  getCategoriasResumo,
  getCurraisIndicadores,
  getFazendaByCodigo,
  getIngredienteEstoque,
  getParametros,
} from "@/lib/queries/fazenda";
import { calcularFazendaRollup } from "@/lib/kpi/fazenda-rollup";
import { calcularAlertas } from "@/lib/kpi/alertas";
import { AlertList } from "@/components/AlertList";
import { StatCard } from "@/components/StatCard";
import { formatMoeda, formatNumero, formatPercentual } from "@/lib/format";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ fazenda: string }>;
}) {
  const { fazenda: codigo } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const parametros = await getParametros(fazenda.id);
  if (!parametros) notFound();

  const [currais, ingredientes, categorias] = await Promise.all([
    getCurraisIndicadores(fazenda.id),
    getIngredienteEstoque(fazenda.id),
    getCategoriasResumo(fazenda.id),
  ]);

  const rollup = calcularFazendaRollup(currais, parametros);
  const alertas = calcularAlertas(codigo, currais, ingredientes, parametros);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Alertas</h2>
        <AlertList alertas={alertas} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Rebanho</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total de animais" value={formatNumero(rollup.numCabecas)} />
          <StatCard label="Peso vivo total" value={`${formatNumero(rollup.pesoTotalAtualKg)} kg`} />
          <StatCard label="@ vivas em estoque" value={formatNumero(rollup.arrobaVivaTotal, 1)} />
          <StatCard
            label="Por categoria"
            value={String(categorias.length)}
            sublabel={categorias.map((c) => `${c.nome}: ${c.numCabecas}`).join(" · ")}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Desempenho</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="GMD médio (só válidos)" value={`${formatNumero(rollup.gmdMedio, 3)} kg/dia`} />
          <StatCard label="Ganho acumulado" value={`${formatNumero(rollup.ganhoTotalKg)} kg`} />
          <StatCard label="@ vivas produzidas" value={formatNumero(rollup.arrobaProduzida, 1)} />
          <StatCard
            label="% na meta de GMD"
            value={formatPercentual(rollup.pctNaMetaGmd)}
            sublabel={`${rollup.numNaMeta}/${rollup.numNaoVencidos} não vencidos`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Econômico</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Custo dieta médio (real)" value={`${formatMoeda(rollup.custoDietaMedioPorKg, 4)}/kg`} />
          <StatCard label="Custo ração/cab/dia" value={formatMoeda(rollup.custoCabDiaMedioRacao)} />
          <StatCard label="Custo/@ produzida (só ração)" value={formatMoeda(rollup.custoRacaoPorArroba)} />
          <StatCard label="Custo/@ produzida (total)" value={formatMoeda(rollup.custoTotalPorArroba)} />
        </div>
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Valor de referência do rebanho</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-black dark:text-zinc-50">
            {formatMoeda(rollup.valorReferencial)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            @ a {formatMoeda(parametros.preco_arroba_referencia)} (preço de referência)
          </p>
        </div>
      </section>
    </div>
  );
}
