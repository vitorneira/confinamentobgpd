"use client";

import { useMemo, useState } from "react";
import type { CurralIndicadores } from "@/lib/kpi/types";
import {
  baseSimulacaoDoCurral,
  calcularBreakEven,
  calcularPontoOtimo,
  calcularSpread,
  diasParaAtingirPeso,
  gmdForaDaFaixa,
  projetarCenario,
  type Cenario,
  type ParametrosCenario,
} from "@/lib/kpi/simulacao";
import { formatData, formatMoeda, formatNumero, formatPercentual, corResultado } from "@/lib/format";

const DELTAS_SENSIBILIDADE = [-20, -10, 0, 10, 20];

function somarDias(dataIso: string, dias: number): string {
  const d = new Date(dataIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.round(dias));
  return d.toISOString().slice(0, 10);
}

/** Vermelho quando produzir mais @ está dando prejuízo (custo da @ produzida >= preço de venda). */
function corCustoArroba(custoArroba: number | null, precoArroba: number): string {
  if (custoArroba === null) return "text-zinc-500";
  return custoArroba >= precoArroba ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400";
}

export function SimuladorCurral({
  curral,
  dataReferencia,
  precoArrobaReferencia,
  pesoAbateAlvoPadrao,
}: {
  curral: CurralIndicadores;
  dataReferencia: string;
  precoArrobaReferencia: number;
  pesoAbateAlvoPadrao: number | null;
}) {
  const base = useMemo(() => baseSimulacaoDoCurral(curral), [curral]);

  const [gmd, setGmd] = useState(String(curral.gmd_medio?.toFixed(3) ?? "0"));
  const [pesoAbate, setPesoAbate] = useState(
    String(pesoAbateAlvoPadrao ?? Math.round(curral.peso_medio_atual_kg ?? 0)),
  );
  const [rendimento, setRendimento] = useState("50");
  const [precoArroba, setPrecoArroba] = useState(String(precoArrobaReferencia));
  const [valorCompraLote, setValorCompraLote] = useState("");
  const [horizonte2, setHorizonte2] = useState("30");
  const [horizonte3, setHorizonte3] = useState("60");

  const gmdNum = Number(gmd) || 0;
  const gmdAlerta = gmdForaDaFaixa(gmdNum);

  const calculo = useMemo(() => {
    if (!base) return null;

    const pesoAbateNum = Number(pesoAbate) || 0;
    const rendimentoNum = (Number(rendimento) || 0) / 100;
    const precoArrobaNum = Number(precoArroba) || 0;
    const valorCompraLoteNum = valorCompraLote.trim() === "" ? null : Number(valorCompraLote) || 0;
    const horizonte2Num = Math.max(Number(horizonte2) || 0, 0);
    const horizonte3Num = Math.max(Number(horizonte3) || 0, 0);

    const parametros: ParametrosCenario = {
      gmdKgDia: gmdNum,
      rendimentoCarcaca: rendimentoNum,
      precoArrobaCarcaca: precoArrobaNum,
      valorCompraLote: valorCompraLoteNum,
    };

    const diasNecessarios = diasParaAtingirPeso(base.pesoAtualKg, gmdNum, pesoAbateNum);
    const jaNoAlvo = diasNecessarios === 0;
    // Sem GMD suficiente pra chegar no alvo (diasNecessarios null): usa "vender
    // agora" como referência pra não deixar toda a projeção em branco.
    const diasReferencia = diasNecessarios ?? 0;
    const dataEstimada = diasNecessarios === null ? null : somarDias(dataReferencia, diasNecessarios);

    const cenarioAlvo = projetarCenario(base, parametros, diasReferencia);
    const pontoOtimo = calcularPontoOtimo(base, parametros, diasNecessarios);
    const spread = calcularSpread(pontoOtimo.custoArrobaMarginal, precoArrobaNum);
    const breakEven = calcularBreakEven(cenarioAlvo);

    const cenarios: Array<{ label: string; cenario: Cenario }> = [
      { label: "Vender agora", cenario: projetarCenario(base, parametros, 0) },
      { label: `+${formatNumero(horizonte2Num)} dias`, cenario: projetarCenario(base, parametros, horizonte2Num) },
      { label: `+${formatNumero(horizonte3Num)} dias`, cenario: projetarCenario(base, parametros, horizonte3Num) },
    ];

    const sensibilidade = DELTAS_SENSIBILIDADE.map((delta) => ({
      delta,
      precoArroba: precoArrobaNum + delta,
      cenario: projetarCenario(base, { ...parametros, precoArrobaCarcaca: precoArrobaNum + delta }, diasReferencia),
    }));

    return {
      pesoAbateNum,
      precoArrobaNum,
      diasNecessarios,
      jaNoAlvo,
      dataEstimada,
      cenarioAlvo,
      pontoOtimo,
      spread,
      breakEven,
      cenarios,
      sensibilidade,
    };
  }, [base, gmdNum, pesoAbate, rendimento, precoArroba, valorCompraLote, horizonte2, horizonte3, dataReferencia]);

  if (!base || !calculo) {
    return (
      <div className="rounded-card border border-amber-200 bg-amber-50 p-5 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          Sem ponto de partida real pra simular o curral {curral.codigo} ainda.
        </p>
        <p className="mt-1 text-amber-800 dark:text-amber-300">
          Nenhum dos {curral.num_cabecas} animais desse curral tem 2 ou mais pesagens (peso médio e GMD válidos
          precisam disso). Registre uma pesagem — pela folha de campo ou lançamento manual — pra liberar a
          simulação aqui.
        </p>
      </div>
    );
  }

  const { jaNoAlvo, cenarioAlvo, pontoOtimo, spread, breakEven, cenarios, sensibilidade } = calculo;
  const spreadIndefinido = spread === null;

  return (
    <div className="space-y-6">
      {/* Premissas */}
      <div className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Premissas — o que você ajusta
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">GMD assumido (kg/dia)</span>
            <input
              type="number"
              step="0.01"
              value={gmd}
              onChange={(e) => setGmd(e.target.value)}
              className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Peso de abate alvo (kg)</span>
            <input
              type="number"
              step="1"
              value={pesoAbate}
              onChange={(e) => setPesoAbate(e.target.value)}
              className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Rendimento de carcaça (%)</span>
            <input
              type="number"
              step="0.1"
              value={rendimento}
              onChange={(e) => setRendimento(e.target.value)}
              className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label
            className="text-sm"
            title="A receita de abate usa arroba de CARCAÇA (peso × rendimento ÷ 15). O custo da @ produzida usa arroba VIVA (peso ÷ 30), padrão do resto do sistema. A 50% de rendimento os dois coincidem — em outro rendimento hipotético, deixam de ser a mesma unidade."
          >
            <span className="mb-1 block text-zinc-500">Preço da @ carcaça (R$)</span>
            <input
              type="number"
              step="0.01"
              value={precoArroba}
              onChange={(e) => setPrecoArroba(e.target.value)}
              className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Valor de compra do lote (R$)</span>
            <input
              type="number"
              step="100"
              placeholder="opcional — não existe no sistema ainda"
              value={valorCompraLote}
              onChange={(e) => setValorCompraLote(e.target.value)}
              className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
          <span>
            Peso médio atual: <b className="text-black dark:text-zinc-50">{formatNumero(base.pesoAtualKg)} kg</b>
          </span>
          <span>
            Custo acumulado:{" "}
            <b className="text-black dark:text-zinc-50">{formatMoeda(base.custoTotalAcumulado)}</b>
          </span>
          <span>
            Cabeças: <b className="text-black dark:text-zinc-50">{formatNumero(base.numCabecas)}</b>
          </span>
        </div>
      </div>

      {(gmdAlerta || jaNoAlvo) && (
        <div className="space-y-2">
          {gmdAlerta && (
            <div className="flex items-start gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
              <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-amber-500" />
              <p>
                <strong>GMD fora da faixa esperada</strong> (0 a 2,5 kg/dia) — verifique as pesagens deste curral. O
                cálculo continua rodando com o valor informado; o spread e o break-even marginal ficam em branco
                porque dependem de um GMD positivo.
              </p>
            </div>
          )}
          {jaNoAlvo && (
            <div className="flex items-start gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
              <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-amber-500" />
              <p>
                <strong>Este lote já está no peso alvo</strong> — a decisão é vender agora, não engordar mais.
                Cenários de espera e ponto ótimo ficam escondidos abaixo.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Herói: spread por @ produzida */}
      <div
        className={`rounded-card border p-5 shadow-sm ${
          spreadIndefinido
            ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            : spread! >= 0
              ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Spread por @ produzida — segurar ou vender
        </p>
        <p
          className={`mt-1 text-4xl font-bold tabular-nums ${
            spreadIndefinido ? "text-zinc-400 dark:text-zinc-600" : corResultado(spread)
          }`}
        >
          {spreadIndefinido ? "—" : `${formatMoeda(spread)}/@`}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {spreadIndefinido ? (
            <>GMD ≤ 0 — sem produção diária de @, o spread marginal não se aplica. Corrija o GMD assumido acima.</>
          ) : (
            <>
              preço da @ <b className="text-black dark:text-zinc-50">{formatMoeda(calculo.precoArrobaNum)}</b> −
              custo marginal da @ produzida{" "}
              <b className="text-black dark:text-zinc-50">{formatMoeda(pontoOtimo.custoArrobaMarginal)}</b>
            </>
          )}
        </p>
      </div>

      {/* Resultados pareados */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Contribuição do confinamento
          </p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${corResultado(cenarioAlvo.contribuicaoConfinamento)}`}>
            {formatMoeda(cenarioAlvo.contribuicaoConfinamento)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Receita de abate − custo real de ração − custo fixo. Margem sobre custo de operação:{" "}
            {formatPercentual(cenarioAlvo.margemOperacional, 1)}. NÃO inclui a compra do lote.
          </p>
        </div>
        <div
          className={`rounded-card border-2 p-5 shadow-sm ${
            cenarioAlvo.resultadoCheio === null
              ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              : cenarioAlvo.resultadoCheio >= 0
                ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40"
                : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Resultado cheio</p>
            <span className="rounded-full border border-primary-500 bg-primary-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
              Este manda
            </span>
          </div>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${corResultado(cenarioAlvo.resultadoCheio)}`}>
            {cenarioAlvo.resultadoCheio === null ? "—" : formatMoeda(cenarioAlvo.resultadoCheio)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {cenarioAlvo.resultadoCheio === null ? (
              <>Informe o valor de compra do lote acima pra ver o resultado completo (com a compra).</>
            ) : (
              <>Contribuição − valor de compra do lote. ROI: {formatPercentual(cenarioAlvo.roi, 1)}.</>
            )}
          </p>
        </div>
      </div>

      {/* KPIs secundários: custo da @ produzida (base viva) + conversão alimentar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Custo da @ produzida (só ração)</p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${corCustoArroba(cenarioAlvo.custoArrobaSoRacao, calculo.precoArrobaNum)}`}
          >
            {cenarioAlvo.custoArrobaSoRacao === null ? "—" : formatMoeda(cenarioAlvo.custoArrobaSoRacao)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">base viva (peso ÷ 30), média do período</p>
        </div>
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Custo da @ produzida (total, com fixo)</p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${corCustoArroba(cenarioAlvo.custoArrobaTotal, calculo.precoArrobaNum)}`}
          >
            {cenarioAlvo.custoArrobaTotal === null ? "—" : formatMoeda(cenarioAlvo.custoArrobaTotal)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">base viva, ração + fixo</p>
        </div>
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Conversão alimentar projetada</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-black dark:text-zinc-50">
            {cenarioAlvo.conversaoAlimentarProjetada === null
              ? "—"
              : `${formatNumero(cenarioAlvo.conversaoAlimentarProjetada, 2)} kg/kg`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">kg de ração ÷ kg de ganho, no GMD assumido</p>
        </div>
      </div>

      <div className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Projeção no peso alvo</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-zinc-500">Dias até o abate</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {calculo.diasNecessarios === null ? "nunca (GMD ≤ 0)" : formatNumero(calculo.diasNecessarios, 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Data estimada</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {calculo.dataEstimada ? formatData(calculo.dataEstimada) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Arrobas de carcaça (lote)</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {formatNumero(cenarioAlvo.arrobaCarcacaTotal, 1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Receita projetada</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {formatMoeda(cenarioAlvo.receitaProjetada)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Custo total projetado</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {formatMoeda(cenarioAlvo.custoTotalReais)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">@ viva produzida (lote)</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {formatNumero(cenarioAlvo.arrobaProduzidaTotal, 1)}
            </p>
          </div>
        </div>
      </div>

      {!jaNoAlvo && (
        <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
          <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Cenários — vender agora vs. esperar
            </span>
            <label className="text-xs text-zinc-500">
              Horizonte 2 (dias)
              <input
                type="number"
                value={horizonte2}
                onChange={(e) => setHorizonte2(e.target.value)}
                className="ml-1 w-16 rounded-input border border-zinc-300 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Horizonte 3 (dias)
              <input
                type="number"
                value={horizonte3}
                onChange={(e) => setHorizonte3(e.target.value)}
                className="ml-1 w-16 rounded-input border border-zinc-300 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-3">
            {cenarios.map((c) => (
              <div
                key={c.label}
                className="rounded-card border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <h3 className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">{c.label}</h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
                    <dt className="text-zinc-500">Peso projetado</dt>
                    <dd className="tabular-nums font-medium">{formatNumero(c.cenario.pesoProjetadoKg, 0)} kg</dd>
                  </div>
                  <div className="flex justify-between border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
                    <dt className="text-zinc-500">@ viva produzida</dt>
                    <dd className="tabular-nums font-medium">{formatNumero(c.cenario.arrobaProduzidaTotal, 1)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Contribuição</dt>
                    <dd className="tabular-nums font-medium">{formatMoeda(c.cenario.contribuicaoConfinamento)}</dd>
                  </div>
                </dl>
                <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500">Resultado cheio</p>
                  <p className={`text-lg font-bold tabular-nums ${corResultado(c.cenario.resultadoCheio)}`}>
                    {c.cenario.resultadoCheio === null ? "—" : formatMoeda(c.cenario.resultadoCheio)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2" colSpan={sensibilidade.length}>
                Sensibilidade ao preço da @ ({jaNoAlvo ? "vender agora" : "no peso alvo"})
              </th>
            </tr>
            <tr>
              {sensibilidade.map((s) => (
                <th key={s.delta} className="px-3 py-2 text-right">
                  {s.delta === 0 ? "base" : `${s.delta > 0 ? "+" : ""}${s.delta}`} ({formatMoeda(s.precoArroba)})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white dark:bg-zinc-950">
              {sensibilidade.map((s) => {
                const valor = s.cenario.resultadoCheio ?? s.cenario.contribuicaoConfinamento;
                return (
                  <td key={s.delta} className={`px-3 py-2 text-right tabular-nums font-medium ${corResultado(valor)}`}>
                    {formatMoeda(valor)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Resultado cheio (ou contribuição, se o valor de compra não foi informado) — o que muda é só o preço da @
        de venda; tudo o mais fica no cenário {jaNoAlvo ? "de vender agora" : "no peso alvo"}.
      </p>

      {!jaNoAlvo && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-card border-y border-r border-zinc-200 border-l-4 border-l-primary-500 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Ponto ótimo de abate</p>
            <p className="mt-2 text-lg font-bold text-black dark:text-zinc-50">
              {pontoOtimo.valeEsperar
                ? `No peso alvo${pontoOtimo.diaOtimo === null ? "" : `, ~dia ${formatNumero(pontoOtimo.diaOtimo, 0)}`}`
                : "Vender agora"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {pontoOtimo.valeEsperar
                ? `Cada dia extra ainda gera ${formatMoeda(pontoOtimo.margemDiariaReais)} de margem pro lote inteiro.`
                : `Mais um dia de trato já custa ${formatMoeda(Math.abs(pontoOtimo.margemDiariaReais))} mais do que produz.`}{" "}
              Assume GMD e custo diário constantes — nunca um dia intermediário, só um dos dois extremos.
            </p>
          </div>
          <div className="rounded-card border-y border-r border-zinc-200 border-l-4 border-l-primary-500 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Break-even marginal</p>
            <p className="mt-2 text-lg font-bold text-black dark:text-zinc-50">
              {pontoOtimo.custoArrobaMarginal === null ? "—" : `${formatMoeda(pontoOtimo.custoArrobaMarginal)}/@`}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Abaixo desse preço, mais um dia de trato já destrói valor — companheiro do ponto ótimo ao lado.
            </p>
          </div>
          <div className="rounded-card border-y border-r border-zinc-200 border-l-4 border-l-primary-500 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Break-even do ciclo (com compra)
            </p>
            <p className="mt-2 text-lg font-bold text-black dark:text-zinc-50">
              {breakEven.precoArrobaComCompra !== null
                ? `${formatMoeda(breakEven.precoArrobaComCompra)}/@`
                : breakEven.precoArrobaSemCompra !== null
                  ? `${formatMoeda(breakEven.precoArrobaSemCompra)}/@`
                  : "—"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {breakEven.precoArrobaComCompra !== null
                ? "Abaixo disso, o ciclo inteiro dá prejuízo — já contando o que foi pago pelo lote."
                : "Esse valor ainda não inclui a compra do lote — informe o valor de compra acima pra ver o break-even completo."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
