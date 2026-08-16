import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getApuracaoVenda } from "@/lib/queries/vendas";
import { formatData, formatMoeda, formatNumero, formatPercentual } from "@/lib/format";

function Linha({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-zinc-100 py-1.5 text-sm dark:border-zinc-800">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium tabular-nums text-black dark:text-zinc-50">{valor}</span>
    </div>
  );
}

export default async function ApuracaoVendaPage({
  params,
}: {
  params: Promise<{ fazenda: string; id: string }>;
}) {
  const { fazenda: codigo, id } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const ap = await getApuracaoVenda(fazenda.id, id);
  if (!ap) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Fechamento — Curral {ap.curralCodigo}
        </h1>
        <p className="text-sm text-zinc-500">
          {ap.frigorifico ?? "—"} {ap.nf && `· ${ap.nf}`} · saída {formatData(ap.dataSaida)}
          {ap.dataAbate && ` · abate ${formatData(ap.dataAbate)}`}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Dados da venda</h2>
        <Linha label="Cabeças" valor={ap.cabecas} />
        <Linha label="Preço da @ (venda)" valor={formatMoeda(ap.precoArroba)} />
        <Linha label="Peso de carcaça total (kg)" valor={formatNumero(ap.pesoCarcacaTotal)} />
        <Linha label="Arrobas de carcaça (@)" valor={formatNumero(ap.arrobasCarcaca, 2)} />
        <Linha label="Carcaça média por cabeça (kg)" valor={formatNumero(ap.carcacaMediaPorCab, 1)} />
        <Linha label="Rendimento de carcaça (calculado)" valor={formatPercentual(ap.rendimentoCalculado, 2)} />
        <Linha label="Valor bruto" valor={formatMoeda(ap.valorBruto)} />
        <Linha label="(−) Deduções" valor={formatMoeda(ap.deducoes)} />
        <Linha label="Valor líquido" valor={formatMoeda(ap.valorLiquido)} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Custo do lote</h2>
        <Linha label="Custo de entrada" valor={formatMoeda(ap.custoEntrada)} />
        <Linha label="Custo de ração (real, até a saída)" valor={formatMoeda(ap.custoRacaoVendidos)} />
        <Linha label="Custo fixo" valor={formatMoeda(ap.custoFixoVendidos)} />
        <Linha label="Custo total" valor={formatMoeda(ap.custoTotal)} />
        <Linha label="Custo total por cabeça" valor={formatMoeda(ap.custoTotalPorCab)} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Resultado</h2>
        <Linha label="Lucro do lote" valor={formatMoeda(ap.lucroLote)} />
        <Linha label="Lucro por cabeça" valor={formatMoeda(ap.lucroPorCab)} />
        <Linha label="Margem sobre a receita" valor={formatPercentual(ap.margem, 1)} />
        <Linha label="ROI sobre o custo" valor={formatPercentual(ap.roi, 1)} />
        <Linha label="Custo da @ produzida (só ração)" valor={formatMoeda(ap.custoArrobaSoRacao)} />
        <Linha label="Custo da @ produzida (ração + fixo)" valor={formatMoeda(ap.custoArrobaTotal)} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Zootécnico</h2>
        <Linha label="Peso médio de entrada (kg)" valor={formatNumero(ap.pesoMedioEntradaKg, 1)} />
        <Linha label="Peso médio de saída (kg)" valor={formatNumero(ap.pesoMedioSaidaKg, 1)} />
        <Linha label="Ganho total do lote (kg)" valor={formatNumero(ap.ganhoTotalKg)} />
        <Linha label="GMD médio (kg/dia)" valor={formatNumero(ap.gmdMedio, 2)} />
        <Linha label="Dias de confinamento (média)" valor={formatNumero(ap.diasConfinamentoMedio, 1)} />
      </section>
    </div>
  );
}
