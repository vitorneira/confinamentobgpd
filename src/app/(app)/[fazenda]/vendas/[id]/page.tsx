import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";
import { getFazendaByCodigo, getPapelUsuario } from "@/lib/queries/fazenda";
import { getApuracaoVenda } from "@/lib/queries/vendas";
import { corResultado, formatData, formatMoeda, formatNumero, formatPercentual } from "@/lib/format";

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{titulo}</h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Linha({ label, valor, destaque }: { label: string; valor: React.ReactNode; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 last:border-b-0 dark:border-zinc-800">
      <span className="text-sm text-zinc-500">{label}</span>
      <span
        className={`tabular-nums text-black dark:text-zinc-50 ${destaque ? "text-base font-semibold" : "text-sm font-medium"}`}
      >
        {valor}
      </span>
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

  const [ap, papel] = await Promise.all([getApuracaoVenda(fazenda.id, id), getPapelUsuario(fazenda.id)]);
  if (!ap) notFound();
  const ehDono = papel === "dono";

  const lucroPositivo = (ap.lucroLote ?? 0) >= 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/${codigo.toLowerCase()}/vendas`}
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ← vendas
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">Curral {ap.curralCodigo}</h1>
          <p className="text-sm text-zinc-500">
            {ap.tipoVenda === "direta" ? (ap.comprador ?? "—") : (ap.frigorifico ?? "—")}
            {ap.nf && ` · ${ap.nf}`} · saída {formatData(ap.dataSaida)}
            {ap.dataAbate && ` · abate ${formatData(ap.dataAbate)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {ehDono && (
            <Link
              href={`/${codigo.toLowerCase()}/vendas/${ap.vendaLoteId}/editar`}
              className="flex items-center gap-1.5 rounded-btn border border-zinc-300 px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              <Pencil size={15} /> Editar venda
            </Link>
          )}
          <a
            href={`/api/venda-recibo?fazenda=${codigo}&id=${ap.vendaLoteId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white dark:bg-primary-500 dark:text-white"
          >
            <FileDown size={15} /> Baixar PDF
          </a>
        </div>
      </div>

      <div
        className={`rounded-card border p-5 ${
          lucroPositivo
            ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
            : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {lucroPositivo ? "Lucro do lote" : "Prejuízo do lote"}
        </p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${corResultado(ap.lucroLote)}`}>
          {formatMoeda(ap.lucroLote)}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatMoeda(ap.lucroPorCab)} / cabeça · margem {formatPercentual(ap.margem, 1)} · ROI{" "}
          {formatPercentual(ap.roi, 1)}
        </p>
      </div>

      <Card titulo="Dados da venda">
        <Linha label="Cabeças" valor={ap.cabecas} />
        {ap.tipoVenda === "abate" ? (
          <>
            <Linha label="Preço da @ (venda)" valor={formatMoeda(ap.precoArroba)} />
            <Linha label="Peso de carcaça total (kg)" valor={formatNumero(ap.pesoCarcacaTotal)} />
            <Linha label="Arrobas de carcaça (@)" valor={formatNumero(ap.arrobasCarcaca, 2)} />
            <Linha label="Carcaça média por cabeça (kg)" valor={formatNumero(ap.carcacaMediaPorCab, 1)} />
            <Linha label="Rendimento de carcaça (calculado)" valor={formatPercentual(ap.rendimentoCalculado, 2)} />
          </>
        ) : (
          <Linha label="Comprador" valor={ap.comprador ?? "—"} />
        )}
        <Linha label="Valor bruto" valor={formatMoeda(ap.valorBruto)} />
        <Linha label="(−) Frete" valor={formatMoeda(ap.frete)} />
        <Linha label="(−) Comissão" valor={formatMoeda(ap.comissao)} />
        <Linha label="(−) Outras deduções" valor={formatMoeda(ap.deducoes)} />
        <Linha label="Valor líquido" valor={formatMoeda(ap.valorLiquido)} destaque />
      </Card>

      <Card titulo="Custo do lote">
        <Linha label="Custo de entrada" valor={formatMoeda(ap.custoEntrada)} />
        <Linha label="Custo de ração (real, até a saída)" valor={formatMoeda(ap.custoRacaoVendidos)} />
        <Linha label="Custo fixo" valor={formatMoeda(ap.custoFixoVendidos)} />
        <Linha label="Custo total" valor={formatMoeda(ap.custoTotal)} destaque />
        <Linha label="Custo total por cabeça" valor={formatMoeda(ap.custoTotalPorCab)} />
      </Card>

      <Card titulo="Resultado">
        <Linha label="Lucro do lote" valor={<span className={corResultado(ap.lucroLote)}>{formatMoeda(ap.lucroLote)}</span>} destaque />
        <Linha label="Lucro por cabeça" valor={<span className={corResultado(ap.lucroPorCab)}>{formatMoeda(ap.lucroPorCab)}</span>} />
        <Linha label="Margem sobre a receita" valor={formatPercentual(ap.margem, 1)} />
        <Linha label="ROI sobre o custo" valor={formatPercentual(ap.roi, 1)} />
        <Linha label="Custo da @ produzida (só ração)" valor={formatMoeda(ap.custoArrobaSoRacao)} />
        <Linha label="Custo da @ produzida (ração + fixo)" valor={formatMoeda(ap.custoArrobaTotal)} />
      </Card>

      <Card titulo="Composição da venda">
        {ap.porCategoria.map((c) => (
          <Linha key={c.categoriaNome} label={c.categoriaNome} valor={`${c.quantidade} cab.`} />
        ))}
        {ap.itensIndividuais.length > 0 && (
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Animais individuais</p>
            {ap.itensIndividuais.map((it, i) => (
              <Linha
                key={`${it.brinco}-${i}`}
                label={it.brinco}
                valor={it.valorNegociado !== null ? formatMoeda(it.valorNegociado) : "—"}
              />
            ))}
          </div>
        )}
      </Card>

      <Card titulo="Zootécnico">
        <Linha label="Peso médio de entrada (kg)" valor={formatNumero(ap.pesoMedioEntradaKg, 1)} />
        <Linha label="Peso médio de saída (kg)" valor={formatNumero(ap.pesoMedioSaidaKg, 1)} />
        <Linha label="Ganho total do lote (kg)" valor={formatNumero(ap.ganhoTotalKg)} />
        <Linha label="GMD médio (kg/dia)" valor={formatNumero(ap.gmdMedio, 2)} />
        <Linha label="Dias de confinamento (média)" valor={formatNumero(ap.diasConfinamentoMedio, 1)} />
      </Card>
    </div>
  );
}
