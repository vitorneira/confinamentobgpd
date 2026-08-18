import type { CurralIndicadores } from "./types";

// GMD < 0 (erro de digitação/pesagem) ou > 2,5 kg/dia (fora da realidade de
// confinamento de corte) dispara alerta visível — não bloqueia o cálculo.
export const GMD_MIN_PLAUSIVEL = 0;
export const GMD_MAX_PLAUSIVEL = 2.5;

export function gmdForaDaFaixa(gmdKgDia: number): boolean {
  return gmdKgDia < GMD_MIN_PLAUSIVEL || gmdKgDia > GMD_MAX_PLAUSIVEL;
}

export type BaseSimulacao = {
  numCabecas: number;
  pesoAtualKg: number;
  /** Peso médio de entrada de TODOS os cabeças do curral (fato — peso_total_atual_kg − ganho_total_kg —, não filtrado por GMD válido). */
  pesoEntradaMedioKg: number;
  custoRacaoAcumulado: number;
  custoTotalAcumulado: number;
  /** kg de ração por cabeça/dia, média real histórica. */
  consumoRacaoCabDiaMedioKg: number;
  /** R$ de ração por cabeça/dia, média real histórica (preço da dieta já congelado por trato). */
  custoRacaoCabDiaMedioReais: number;
  custoFixoDia: number;
};

/** Deriva a base de simulação a partir do indicador de curral já calculado (view). Pura, sem I/O. */
export function baseSimulacaoDoCurral(curral: CurralIndicadores): BaseSimulacao | null {
  if (curral.peso_medio_atual_kg === null || curral.peso_total_atual_kg === null || curral.ganho_total_kg === null) {
    return null;
  }
  const numCabecas = curral.num_cabecas;
  if (numCabecas <= 0) return null;

  const pesoEntradaTotalKg = curral.peso_total_atual_kg - curral.ganho_total_kg;

  return {
    numCabecas,
    pesoAtualKg: curral.peso_medio_atual_kg,
    pesoEntradaMedioKg: pesoEntradaTotalKg / numCabecas,
    custoRacaoAcumulado: curral.custo_racao_acumulado ?? 0,
    custoTotalAcumulado: curral.custo_total_acumulado ?? 0,
    consumoRacaoCabDiaMedioKg:
      curral.dias_com_trato > 0 ? (curral.consumo_racao_total_kg ?? 0) / curral.dias_com_trato / numCabecas : 0,
    custoRacaoCabDiaMedioReais: curral.custo_cab_dia_medio_racao ?? 0,
    custoFixoDia: curral.custo_fixo_dia,
  };
}

export type ParametrosCenario = {
  gmdKgDia: number;
  /** 0–1. Só 50% é exatamente equivalente à arroba viva usada no custo/@ — ver nomenclatura na tela. */
  rendimentoCarcaca: number;
  precoArrobaCarcaca: number;
  /** Preço da @ pago na entrada (R$) — informado pelo usuário; null = desconhecido (não existe no sistema pra lote ainda não vendido). */
  precoArrobaEntrada: number | null;
};

export type Cenario = {
  diasProjetados: number;
  pesoProjetadoKg: number;
  arrobaCarcacaTotal: number;
  receitaProjetada: number;
  custoRacaoFuturoReais: number;
  custoFixoFuturoReais: number;
  custoRacaoTotalReais: number;
  custoTotalReais: number;
  /** @ VIVA (peso/30) — padrão do sistema pra custo/@ produzida, nunca a de carcaça. */
  arrobaProduzidaTotal: number;
  custoArrobaSoRacao: number | null;
  custoArrobaTotal: number | null;
  conversaoAlimentarProjetada: number | null;
  /** receita de abate − custo de trato real − custo fixo (SEM a compra do lote). */
  contribuicaoConfinamento: number;
  custoEntradaReais: number | null;
  /** contribuição − custo de entrada (compra do lote). */
  resultadoCheio: number | null;
  /** contribuição ÷ custo de operação (ração + fixo) — NÃO é ROI, não inclui a compra. */
  margemOperacional: number | null;
  /** resultado cheio ÷ (custo de operação + custo de entrada) — só existe atrelado ao resultado cheio. */
  roi: number | null;
};

/**
 * Projeta um cenário pra `dias` a partir de hoje (dias pode ser 0 = vender
 * agora). Arroba de CARCAÇA só entra na receita de abate (peso × rendimento
 * ÷ 15); custo da @ produzida usa sempre arroba VIVA (peso/30), padrão do
 * resto do sistema — nunca misturar as duas.
 */
export function projetarCenario(base: BaseSimulacao, p: ParametrosCenario, dias: number): Cenario {
  const { numCabecas } = base;
  const pesoProjetadoKg = base.pesoAtualKg + p.gmdKgDia * dias;

  const arrobaCarcacaTotal = (pesoProjetadoKg * p.rendimentoCarcaca * numCabecas) / 15;
  const receitaProjetada = arrobaCarcacaTotal * p.precoArrobaCarcaca;

  const custoRacaoFuturoReais = base.custoRacaoCabDiaMedioReais * numCabecas * dias;
  const custoFixoFuturoReais = base.custoFixoDia * numCabecas * dias;
  const custoRacaoTotalReais = base.custoRacaoAcumulado + custoRacaoFuturoReais;
  const custoTotalReais = base.custoTotalAcumulado + custoRacaoFuturoReais + custoFixoFuturoReais;

  const ganhoTotalKg = Math.max(pesoProjetadoKg - base.pesoEntradaMedioKg, 0) * numCabecas;
  const arrobaProduzidaTotal = ganhoTotalKg / 30;

  const custoArrobaSoRacao = arrobaProduzidaTotal > 0 ? custoRacaoTotalReais / arrobaProduzidaTotal : null;
  const custoArrobaTotal = arrobaProduzidaTotal > 0 ? custoTotalReais / arrobaProduzidaTotal : null;

  // dias/numCabecas cancelam — vira consumo médio kg/cab/dia ÷ GMD assumido.
  const consumoFuturoKgTotal = base.consumoRacaoCabDiaMedioKg * numCabecas * dias;
  const ganhoFuturoKgTotal = Math.max(p.gmdKgDia, 0) * numCabecas * dias;
  const conversaoAlimentarProjetada = ganhoFuturoKgTotal > 0 ? consumoFuturoKgTotal / ganhoFuturoKgTotal : null;

  const contribuicaoConfinamento = receitaProjetada - custoTotalReais;

  const custoEntradaReais =
    p.precoArrobaEntrada === null ? null : ((base.pesoEntradaMedioKg * numCabecas * 0.5) / 15) * p.precoArrobaEntrada;
  const resultadoCheio = custoEntradaReais === null ? null : contribuicaoConfinamento - custoEntradaReais;

  const margemOperacional = custoTotalReais > 0 ? contribuicaoConfinamento / custoTotalReais : null;
  const custoCheioTotal = custoEntradaReais === null ? null : custoTotalReais + custoEntradaReais;
  const roi = resultadoCheio === null || !custoCheioTotal ? null : resultadoCheio / custoCheioTotal;

  return {
    diasProjetados: dias,
    pesoProjetadoKg,
    arrobaCarcacaTotal,
    receitaProjetada,
    custoRacaoFuturoReais,
    custoFixoFuturoReais,
    custoRacaoTotalReais,
    custoTotalReais,
    arrobaProduzidaTotal,
    custoArrobaSoRacao,
    custoArrobaTotal,
    conversaoAlimentarProjetada,
    contribuicaoConfinamento,
    custoEntradaReais,
    resultadoCheio,
    margemOperacional,
    roi,
  };
}

/** Dias pra sair de pesoAtualKg até pesoAlvoKg no GMD informado. 0 se já está no alvo; null se nunca chega (GMD ≤ 0). */
export function diasParaAtingirPeso(pesoAtualKg: number, gmdKgDia: number, pesoAlvoKg: number): number | null {
  const ganhoNecessarioKg = Math.max(pesoAlvoKg - pesoAtualKg, 0);
  if (ganhoNecessarioKg <= 0) return 0;
  if (gmdKgDia <= 0) return null;
  return ganhoNecessarioKg / gmdKgDia;
}

export type PontoOtimo = {
  valorMarginalDiaReais: number;
  custoMarginalDiaReais: number;
  margemDiariaReais: number;
  valeEsperar: boolean;
  diaOtimo: number | null;
};

/**
 * Ponto ótimo de abate — modelo linear.
 *
 * Fórmula: compara o valor de mais um dia de trato (ganho de peso do dia ×
 * rendimento ÷ 15 × preço da @ carcaça, pra toda a boiada do curral) com o
 * custo desse dia (ração real + fixo, por cabeça × nº de cabeças). Isso é
 * literalmente "o custo de mais um dia supera a @ adicional produzida".
 *
 * Limitação assumida (documentada, não escondida): o sistema não modela
 * desaceleração de GMD com o peso — não há curva biológica de crescimento,
 * GMD é uma taxa fixa assumida pro horizonte inteiro. Com GMD e custo diário
 * constantes, essa margem diária NÃO varia dia a dia, então não existe um
 * dia interno onde ela cruza zero. Sob esse modelo o resultado correto é
 * sempre um dos extremos: vale a pena ir até o peso alvo (margem diária >
 * 0) ou vender agora (margem diária ≤ 0). Um ponto ótimo genuinamente
 * intermediário exigiria uma curva de GMD por peso, fora do escopo atual.
 */
export function calcularPontoOtimo(base: BaseSimulacao, p: ParametrosCenario, diasParaAlvo: number | null): PontoOtimo {
  const valorMarginalDiaReais = ((p.gmdKgDia * base.numCabecas * p.rendimentoCarcaca) / 15) * p.precoArrobaCarcaca;
  const custoMarginalDiaReais = (base.custoRacaoCabDiaMedioReais + base.custoFixoDia) * base.numCabecas;
  const margemDiariaReais = valorMarginalDiaReais - custoMarginalDiaReais;
  const valeEsperar = margemDiariaReais > 0;

  return {
    valorMarginalDiaReais,
    custoMarginalDiaReais,
    margemDiariaReais,
    valeEsperar,
    diaOtimo: valeEsperar ? diasParaAlvo : 0,
  };
}

export type BreakEven = {
  precoArrobaSemCompra: number | null;
  precoArrobaComCompra: number | null;
};

/** Preço mínimo da @ carcaça pra não dar prejuízo no cenário informado (receita é linear no preço, então é álgebra direta). */
export function calcularBreakEven(cenario: Cenario): BreakEven {
  const { arrobaCarcacaTotal, custoTotalReais, custoEntradaReais } = cenario;
  if (arrobaCarcacaTotal <= 0) return { precoArrobaSemCompra: null, precoArrobaComCompra: null };
  return {
    precoArrobaSemCompra: custoTotalReais / arrobaCarcacaTotal,
    precoArrobaComCompra:
      custoEntradaReais === null ? null : (custoTotalReais + custoEntradaReais) / arrobaCarcacaTotal,
  };
}
