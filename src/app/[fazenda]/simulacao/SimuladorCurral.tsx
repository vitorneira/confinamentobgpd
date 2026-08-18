"use client";

import { useMemo, useState } from "react";
import type { CurralIndicadores } from "@/lib/kpi/types";
import {
  baseSimulacaoDoCurral,
  calcularBreakEven,
  calcularPontoOtimo,
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
  return custoArroba >= precoArroba
    ? "text-red-600 dark:text-red-400"
    : "text-green-700 dark:text-green-400";
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
  const [precoArrobaEntrada, setPrecoArrobaEntrada] = useState("");
  const [horizonte2, setHorizonte2] = useState("30");
  const [horizonte3, setHorizonte3] = useState("60");

  const gmdNum = Number(gmd) || 0;
  const gmdAlerta = gmdForaDaFaixa(gmdNum);

  const calculo = useMemo(() => {
    if (!base) return null;

    const pesoAbateNum = Number(pesoAbate) || 0;
    const rendimentoNum = (Number(rendimento) || 0) / 100;
    const precoArrobaNum = Number(precoArroba) || 0;
    const precoArrobaEntradaNum = precoArrobaEntrada.trim() === "" ? null : Number(precoArrobaEntrada) || 0;
    const horizonte2Num = Math.max(Number(horizonte2) || 0, 0);
    const horizonte3Num = Math.max(Number(horizonte3) || 0, 0);

    const parametros: ParametrosCenario = {
      gmdKgDia: gmdNum,
      rendimentoCarcaca: rendimentoNum,
      precoArrobaCarcaca: precoArrobaNum,
      precoArrobaEntrada: precoArrobaEntradaNum,
    };

    const diasNecessarios = diasParaAtingirPeso(base.pesoAtualKg, gmdNum, pesoAbateNum);
    const jaNoAlvo = diasNecessarios === 0;
    // Sem GMD suficiente pra chegar no alvo (diasNecessarios null): usa "vender
    // agora" como referência pra não deixar toda a projeção em branco.
    const diasReferencia = diasNecessarios ?? 0;
    const dataEstimada = diasNecessarios === null ? null : somarDias(dataReferencia, diasNecessarios);

    const cenarioAlvo = projetarCenario(base, parametros, diasReferencia);
    const pontoOtimo = calcularPontoOtimo(base, parametros, diasNecessarios);
    const breakEven = calcularBreakEven(cenarioAlvo);

    const cenarios: Array<{ label: string; cenario: Cenario }> = [
      { label: "Vender agora", cenario: projetarCenario(base, parametros, 0) },
      { label: `+${formatNumero(horizonte2Num)} dias`, cenario: projetarCenario(base, parametros, horizonte2Num) },
      { label: `+${formatNumero(horizonte3Num)} dias`, cenario: projetarCenario(base, parametros, horizonte3Num) },
    ];

    const sensibilidade = DELTAS_SENSIBILIDADE.map((delta) => ({
      delta,
      precoArroba: precoArrobaNum + delta,
      cenario: projetarCenario(
        base,
        { ...parametros, precoArrobaCarcaca: precoArrobaNum + delta },
        diasReferencia,
      ),
    }));

    return {
      pesoAbateNum,
      precoArrobaNum,
      diasNecessarios,
      jaNoAlvo,
      dataEstimada,
      cenarioAlvo,
      pontoOtimo,
      breakEven,
      cenarios,
      sensibilidade,
    };
  }, [base, gmdNum, pesoAbate, rendimento, precoArroba, precoArrobaEntrada, horizonte2, horizonte3, dataReferencia]);

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

  const { jaNoAlvo, cenarioAlvo, pontoOtimo, breakEven, cenarios, sensibilidade } = calculo;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 rounded-card border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900">
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
      </div>

      {gmdAlerta && (
        <p className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          GMD fora da faixa esperada (0 a 2,5 kg/dia) — verifique as pesagens deste curral. O cálculo continua
          rodando com o valor informado; ajuste o campo acima se quiser sobrescrever.
        </p>
      )}

      {jaNoAlvo && (
        <p className="rounded-card border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          Este lote já está no peso alvo — a decisão aqui é <strong>vender agora</strong>, não engordar mais. Os
          números abaixo são do resultado da venda imediata (sem projeção de ganho futuro).
        </p>
      )}

      <p className="text-xs text-zinc-500">
        Ponto de partida real do curral {curral.codigo}: {curral.num_cabecas} cabeças, peso médio atual{" "}
        {formatNumero(base.pesoAtualKg)} kg, custo acumulado {formatMoeda(base.custoTotalAcumulado)}. Nada aqui é
        gravado — é só projeção.
      </p>

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
          className={`rounded-card border p-5 shadow-sm ${
            cenarioAlvo.resultadoCheio === null
              ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              : cenarioAlvo.resultadoCheio >= 0
                ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
                : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Resultado cheio</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${corResultado(cenarioAlvo.resultadoCheio)}`}>
            {cenarioAlvo.resultadoCheio === null ? "—" : formatMoeda(cenarioAlvo.resultadoCheio)}
          </p>
          {cenarioAlvo.resultadoCheio === null ? (
            <p className="mt-1 text-xs text-zinc-500">
              Informe abaixo o preço da @ pago na entrada pra ver o resultado completo (com a compra do lote).
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              Contribuição − custo de entrada. ROI: {formatPercentual(cenarioAlvo.roi, 1)}.
            </p>
          )}
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-zinc-500">Preço da @ pago na entrada (R$) — opcional</span>
            <input
              type="number"
              step="0.01"
              placeholder="não existe no sistema pra lote ainda não vendido — informe pra calcular"
              value={precoArrobaEntrada}
              onChange={(e) => setPrecoArrobaEntrada(e.target.value)}
              className="w-full rounded-input border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Custo da @ produzida (só ração)</p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${corCustoArroba(cenarioAlvo.custoArrobaSoRacao, calculo.precoArrobaNum)}`}
          >
            {cenarioAlvo.custoArrobaSoRacao === null ? "—" : formatMoeda(cenarioAlvo.custoArrobaSoRacao)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">vs. preço de venda {formatMoeda(calculo.precoArrobaNum)}</p>
        </div>
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Custo da @ produzida (total, com fixo)</p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${corCustoArroba(cenarioAlvo.custoArrobaTotal, calculo.precoArrobaNum)}`}
          >
            {cenarioAlvo.custoArrobaTotal === null ? "—" : formatMoeda(cenarioAlvo.custoArrobaTotal)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">vs. preço de venda {formatMoeda(calculo.precoArrobaNum)}</p>
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

      <div className="rounded-card border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
          Break-even
        </h2>
        {breakEven.precoArrobaComCompra !== null ? (
          <p className="text-sm text-amber-900 dark:text-amber-300">
            Abaixo de <strong>{formatMoeda(breakEven.precoArrobaComCompra)}/@</strong> este curral dá prejuízo (com
            a compra do lote).
          </p>
        ) : (
          <p className="text-sm text-amber-900 dark:text-amber-300">
            Sem a compra do lote, abaixo de <strong>{formatMoeda(breakEven.precoArrobaSemCompra)}/@</strong> este
            curral dá prejuízo. Informe o preço da @ na entrada acima pra ver o break-even completo (com a
            compra).
          </p>
        )}
      </div>

      {!jaNoAlvo && (
        <div className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Ponto ótimo de abate</h2>
          <p className="text-sm text-black dark:text-zinc-50">
            {pontoOtimo.valeEsperar
              ? `Ponto ótimo estimado: no peso alvo${
                  pontoOtimo.diaOtimo === null ? "" : `, ~dia ${formatNumero(pontoOtimo.diaOtimo, 0)}`
                } — cada dia extra de trato ainda gera mais valor do que custa.`
              : "Ponto ótimo estimado: agora — o custo de mais um dia de trato já supera a @ adicional produzida."}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Valor de +1 dia: {formatMoeda(pontoOtimo.valorMarginalDiaReais)} · Custo de +1 dia:{" "}
            {formatMoeda(pontoOtimo.custoMarginalDiaReais)} · margem diária:{" "}
            <span className={corResultado(pontoOtimo.margemDiariaReais)}>
              {formatMoeda(pontoOtimo.margemDiariaReais)}
            </span>
            . Assume GMD e custo diário constantes (o sistema não modela desaceleração de GMD por peso) — por
            isso o resultado é sempre &ldquo;vá até o alvo&rdquo; ou &ldquo;venda agora&rdquo;, nunca um dia
            intermediário.
          </p>
        </div>
      )}

      {!jaNoAlvo && (
        <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
          <div className="flex items-end gap-3 border-b border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Cenários — horizontes
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
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2"></th>
                {cenarios.map((c) => (
                  <th key={c.label} className="px-3 py-2 text-right">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <tr className="bg-white dark:bg-zinc-950">
                <td className="px-3 py-2 text-zinc-500">Peso projetado (kg)</td>
                {cenarios.map((c) => (
                  <td key={c.label} className="px-3 py-2 text-right tabular-nums">
                    {formatNumero(c.cenario.pesoProjetadoKg)}
                  </td>
                ))}
              </tr>
              <tr className="bg-white dark:bg-zinc-950">
                <td className="px-3 py-2 text-zinc-500">@ viva produzida</td>
                {cenarios.map((c) => (
                  <td key={c.label} className="px-3 py-2 text-right tabular-nums">
                    {formatNumero(c.cenario.arrobaProduzidaTotal, 1)}
                  </td>
                ))}
              </tr>
              <tr className="bg-white dark:bg-zinc-950">
                <td className="px-3 py-2 text-zinc-500">Custo da @ (só ração)</td>
                {cenarios.map((c) => (
                  <td key={c.label} className="px-3 py-2 text-right tabular-nums">
                    {c.cenario.custoArrobaSoRacao === null ? "—" : formatMoeda(c.cenario.custoArrobaSoRacao)}
                  </td>
                ))}
              </tr>
              <tr className="bg-white dark:bg-zinc-950">
                <td className="px-3 py-2 text-zinc-500">Custo da @ (total)</td>
                {cenarios.map((c) => (
                  <td key={c.label} className="px-3 py-2 text-right tabular-nums">
                    {c.cenario.custoArrobaTotal === null ? "—" : formatMoeda(c.cenario.custoArrobaTotal)}
                  </td>
                ))}
              </tr>
              <tr className="bg-white dark:bg-zinc-950">
                <td className="px-3 py-2 text-zinc-500">Contribuição do confinamento</td>
                {cenarios.map((c) => (
                  <td
                    key={c.label}
                    className={`px-3 py-2 text-right tabular-nums font-medium ${corResultado(c.cenario.contribuicaoConfinamento)}`}
                  >
                    {formatMoeda(c.cenario.contribuicaoConfinamento)}
                  </td>
                ))}
              </tr>
              <tr className="bg-white dark:bg-zinc-950">
                <td className="px-3 py-2 text-zinc-500">Resultado cheio</td>
                {cenarios.map((c) => (
                  <td
                    key={c.label}
                    className={`px-3 py-2 text-right tabular-nums font-medium ${corResultado(c.cenario.resultadoCheio)}`}
                  >
                    {c.cenario.resultadoCheio === null ? "—" : formatMoeda(c.cenario.resultadoCheio)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
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
        Resultado cheio (ou contribuição, se o preço de entrada não foi informado) — o que muda é só o preço da @
        de venda; tudo o mais fica no cenário {jaNoAlvo ? "de vender agora" : "no peso alvo"}.
      </p>
    </div>
  );
}
