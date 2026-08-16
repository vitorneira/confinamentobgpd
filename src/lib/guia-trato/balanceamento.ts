export type CurralAjuste = {
  curralId: string;
  curralCodigo: string;
  dietaId: string;
  dietaNome: string;
  totalDiaKg: number;
  ajustePct: number;
  ajusteKg: number;
};

export type Splits = { manha: number; almoco: number; tarde: number };

export type ResumoHorario = {
  horario: "manha" | "almoco" | "tarde";
  totalKg: number;
  numVagoes: number;
  cargaPorVagao: number;
  aproveitamento: number;
  /** Sugestão: carga igual em todos. Editável — ver guia_trato_vagao. */
  vagoesSugeridos: number[];
};

export type ResumoDieta = {
  dietaId: string;
  dietaNome: string;
  horarios: ResumoHorario[];
};

export type ResultadoBalanceamento = {
  totalAjustadoPorCurral: Record<string, number>;
  porDieta: ResumoDieta[];
};

export function totalAjustado(totalDiaKg: number, ajustePct: number, ajusteKg: number): number {
  return totalDiaKg * (1 + ajustePct) + ajusteKg;
}

/**
 * Nº mínimo de vagões para o total, com carga IGUAL entre eles (não "cheios +
 * um pela metade" — essa é a melhoria central sobre o processo antigo).
 */
function balancearHorario(
  horario: ResumoHorario["horario"],
  totalKg: number,
  capacidadeVagao: number,
): ResumoHorario {
  if (totalKg <= 0 || capacidadeVagao <= 0) {
    return { horario, totalKg, numVagoes: 0, cargaPorVagao: 0, aproveitamento: 0, vagoesSugeridos: [] };
  }
  const numVagoes = Math.ceil(totalKg / capacidadeVagao);
  const cargaPorVagao = totalKg / numVagoes;
  return {
    horario,
    totalKg,
    numVagoes,
    cargaPorVagao,
    aproveitamento: cargaPorVagao / capacidadeVagao,
    vagoesSugeridos: Array(numVagoes).fill(cargaPorVagao),
  };
}

/**
 * Balanceia vagões por horário, agrupando por dieta vigente — um vagão só pode
 * atender currais que comem a mesma dieta (na BG cada grupo de curral tem uma
 * dieta diferente; na PD todos compartilham a mesma, então cai num grupo só).
 */
export function calcularBalanceamento(
  currais: CurralAjuste[],
  splits: Splits,
  capacidadeVagao: number,
): ResultadoBalanceamento {
  const totalAjustadoPorCurral: Record<string, number> = {};
  const totaisPorDieta = new Map<string, { dietaNome: string; manha: number; almoco: number; tarde: number }>();

  for (const c of currais) {
    const total = totalAjustado(c.totalDiaKg, c.ajustePct, c.ajusteKg);
    totalAjustadoPorCurral[c.curralId] = total;

    const entrada = totaisPorDieta.get(c.dietaId) ?? { dietaNome: c.dietaNome, manha: 0, almoco: 0, tarde: 0 };
    entrada.manha += total * splits.manha;
    entrada.almoco += total * splits.almoco;
    entrada.tarde += total * splits.tarde;
    totaisPorDieta.set(c.dietaId, entrada);
  }

  const porDieta: ResumoDieta[] = [...totaisPorDieta.entries()].map(([dietaId, t]) => ({
    dietaId,
    dietaNome: t.dietaNome,
    horarios: [
      balancearHorario("manha", t.manha, capacidadeVagao),
      balancearHorario("almoco", t.almoco, capacidadeVagao),
      balancearHorario("tarde", t.tarde, capacidadeVagao),
    ],
  }));

  return { totalAjustadoPorCurral, porDieta };
}
