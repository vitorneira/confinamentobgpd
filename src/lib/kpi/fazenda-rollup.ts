import type { CurralIndicadores, Parametros } from "./types";

export type FazendaRollup = {
  numCabecas: number;
  pesoTotalAtualKg: number;
  arrobaVivaTotal: number;
  ganhoTotalKg: number;
  arrobaProduzida: number;
  gmdMedio: number | null;
  numGmdValidos: number;
  numNaoVencidos: number;
  numNaMeta: number;
  pctNaMetaGmd: number | null;
  custoRacaoAcumulado: number;
  custoTotalAcumulado: number;
  custoRacaoPorArroba: number | null;
  custoTotalPorArroba: number | null;
  custoCabDiaMedioRacao: number | null;
  custoDietaMedioPorKg: number | null;
  valorReferencial: number;
};

function soma(valores: Array<number | null | undefined>): number {
  return valores.reduce((acc: number, v) => acc + (v ?? 0), 0);
}

/** Junta os indicadores por curral (Etapa 2) num total de fazenda. Pura — sem I/O. */
export function calcularFazendaRollup(
  currais: CurralIndicadores[],
  parametros: Parametros,
): FazendaRollup {
  const numCabecas = soma(currais.map((c) => c.num_cabecas));
  const pesoTotalAtualKg = soma(currais.map((c) => c.peso_total_atual_kg));
  const ganhoTotalKg = soma(currais.map((c) => c.ganho_total_kg));
  const numGmdValidos = soma(currais.map((c) => c.num_gmd_validos));
  const numNaoVencidos = soma(currais.map((c) => c.num_nao_vencidos));
  const numNaMeta = soma(currais.map((c) => c.num_na_meta));
  const custoRacaoAcumulado = soma(currais.map((c) => c.custo_racao_acumulado));
  const custoTotalAcumulado = soma(currais.map((c) => c.custo_total_acumulado));
  const consumoRacaoTotalKg = soma(currais.map((c) => c.consumo_racao_total_kg));
  const somaDiasCabecas = soma(
    currais.map((c) => (c.dias_com_trato ?? 0) * c.num_cabecas),
  );
  // média ponderada por nº de animais válidos em cada curral (não média das médias)
  const somaGmdPonderada = soma(currais.map((c) => (c.gmd_medio ?? 0) * c.num_gmd_validos));

  const arrobaVivaTotal = pesoTotalAtualKg / 30;
  const arrobaProduzida = ganhoTotalKg / 30;

  return {
    numCabecas,
    pesoTotalAtualKg,
    arrobaVivaTotal,
    ganhoTotalKg,
    arrobaProduzida,
    gmdMedio: numGmdValidos > 0 ? somaGmdPonderada / numGmdValidos : null,
    numGmdValidos,
    numNaoVencidos,
    numNaMeta,
    pctNaMetaGmd: numNaoVencidos > 0 ? numNaMeta / numNaoVencidos : null,
    custoRacaoAcumulado,
    custoTotalAcumulado,
    custoRacaoPorArroba: arrobaProduzida > 0 ? custoRacaoAcumulado / arrobaProduzida : null,
    custoTotalPorArroba: arrobaProduzida > 0 ? custoTotalAcumulado / arrobaProduzida : null,
    custoCabDiaMedioRacao: somaDiasCabecas > 0 ? custoRacaoAcumulado / somaDiasCabecas : null,
    custoDietaMedioPorKg: consumoRacaoTotalKg > 0 ? custoRacaoAcumulado / consumoRacaoTotalKg : null,
    valorReferencial: arrobaVivaTotal * parametros.preco_arroba_referencia,
  };
}
