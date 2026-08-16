"use client";

import { useMemo, useState } from "react";
import type { CurralIndicadores } from "@/lib/kpi/types";
import { formatData, formatMoeda, formatNumero, formatPercentual, corResultado } from "@/lib/format";

function somarDias(dataIso: string, dias: number): string {
  const d = new Date(dataIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.round(dias));
  return d.toISOString().slice(0, 10);
}

export function SimuladorCurral({
  curral,
  dataReferencia,
  precoArrobaReferencia,
  pesoAbateAlvoPadrao,
  custoFixoDia,
}: {
  curral: CurralIndicadores;
  dataReferencia: string;
  precoArrobaReferencia: number;
  pesoAbateAlvoPadrao: number | null;
  custoFixoDia: number;
}) {
  const semDadosValidos = curral.peso_medio_atual_kg === null;
  const pesoAtual = curral.peso_medio_atual_kg ?? 0;
  const [gmd, setGmd] = useState(String(curral.gmd_medio?.toFixed(3) ?? "0"));
  const [pesoAbate, setPesoAbate] = useState(String(pesoAbateAlvoPadrao ?? Math.round(pesoAtual) ?? 0));
  const [rendimento, setRendimento] = useState("50");
  const [precoArroba, setPrecoArroba] = useState(String(precoArrobaReferencia));

  const resultado = useMemo(() => {
    const gmdNum = Number(gmd) || 0;
    const pesoAbateNum = Number(pesoAbate) || 0;
    const rendimentoNum = (Number(rendimento) || 0) / 100;
    const precoArrobaNum = Number(precoArroba) || 0;
    const numCabecas = curral.num_cabecas;

    const ganhoNecessarioKg = Math.max(pesoAbateNum - pesoAtual, 0);
    const diasNecessarios = ganhoNecessarioKg <= 0 ? 0 : gmdNum > 0 ? ganhoNecessarioKg / gmdNum : null;
    const dataEstimada = diasNecessarios === null ? null : somarDias(dataReferencia, diasNecessarios);

    const arrobaCarcacaTotal = (pesoAbateNum * rendimentoNum * numCabecas) / 15;
    const receitaProjetada = arrobaCarcacaTotal * precoArrobaNum;

    const custoRacaoFuturo =
      diasNecessarios === null ? null : (curral.custo_cab_dia_medio_racao ?? 0) * numCabecas * diasNecessarios;
    const custoFixoFuturo = diasNecessarios === null ? null : custoFixoDia * numCabecas * diasNecessarios;
    const custoTotalProjetado =
      custoRacaoFuturo === null || custoFixoFuturo === null
        ? null
        : (curral.custo_total_acumulado ?? 0) + custoRacaoFuturo + custoFixoFuturo;

    const ganhoArrobaVivaProjetado = (pesoAbateNum - (curral.peso_medio_entrada_kg ?? pesoAtual)) / 30;
    const arrobaProduzidaProjetadaTotal = ganhoArrobaVivaProjetado * numCabecas;
    const custoArrobaProjetado =
      custoTotalProjetado === null
        ? null
        : arrobaProduzidaProjetadaTotal > 0
          ? custoTotalProjetado / arrobaProduzidaProjetadaTotal
          : null;

    const lucroProjetado = custoTotalProjetado === null ? null : receitaProjetada - custoTotalProjetado;
    const lucroPorCab = lucroProjetado === null ? null : lucroProjetado / numCabecas;
    const margem = lucroProjetado === null || receitaProjetada === 0 ? null : lucroProjetado / receitaProjetada;
    const roi = lucroProjetado === null || !custoTotalProjetado ? null : lucroProjetado / custoTotalProjetado;

    return {
      diasNecessarios,
      dataEstimada,
      arrobaCarcacaTotal,
      receitaProjetada,
      custoTotalProjetado,
      custoArrobaProjetado,
      lucroProjetado,
      lucroPorCab,
      margem,
      roi,
    };
  }, [gmd, pesoAbate, rendimento, precoArroba, curral, pesoAtual, dataReferencia, custoFixoDia]);

  if (semDadosValidos) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm dark:border-amber-900 dark:bg-amber-950/40">
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">GMD assumido (kg/dia)</span>
          <input
            type="number"
            step="0.01"
            value={gmd}
            onChange={(e) => setGmd(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Peso de abate alvo (kg)</span>
          <input
            type="number"
            step="1"
            value={pesoAbate}
            onChange={(e) => setPesoAbate(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Rendimento de carcaça (%)</span>
          <input
            type="number"
            step="0.1"
            value={rendimento}
            onChange={(e) => setRendimento(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Preço da @ (R$)</span>
          <input
            type="number"
            step="0.01"
            value={precoArroba}
            onChange={(e) => setPrecoArroba(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        Ponto de partida real do curral {curral.codigo}: {curral.num_cabecas} cabeças, peso médio atual{" "}
        {formatNumero(pesoAtual)} kg, custo acumulado {formatMoeda(curral.custo_total_acumulado)}. Nada aqui é
        gravado — é só projeção.
      </p>

      <div
        className={`rounded-xl border p-5 ${
          (resultado.lucroProjetado ?? 0) >= 0
            ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
            : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Resultado projetado do confinamento
        </p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${corResultado(resultado.lucroProjetado)}`}>
          {resultado.lucroProjetado === null ? "—" : formatMoeda(resultado.lucroProjetado)}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {resultado.lucroPorCab === null ? "—" : formatMoeda(resultado.lucroPorCab)} / cabeça · margem{" "}
          {formatPercentual(resultado.margem, 1)} · ROI {formatPercentual(resultado.roi, 1)}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Não inclui o custo de entrada (compra do lote) — só receita de abate menos custo de confinamento
          (ração real + fixo) daqui até a data simulada. Pra ver o resultado completo de um lote já vendido, veja
          o fechamento em Vendas.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Projeção</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-zinc-500">Dias até o abate</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {resultado.diasNecessarios === null ? "nunca (GMD ≤ 0)" : formatNumero(resultado.diasNecessarios, 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Data estimada</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {resultado.dataEstimada ? formatData(resultado.dataEstimada) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Arrobas de carcaça (lote)</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {formatNumero(resultado.arrobaCarcacaTotal, 1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Receita projetada</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {formatMoeda(resultado.receitaProjetada)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Custo total projetado</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {resultado.custoTotalProjetado === null ? "—" : formatMoeda(resultado.custoTotalProjetado)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Custo da @ produzida projetado</p>
            <p className="tabular-nums font-medium text-black dark:text-zinc-50">
              {resultado.custoArrobaProjetado === null ? "—" : formatMoeda(resultado.custoArrobaProjetado)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
