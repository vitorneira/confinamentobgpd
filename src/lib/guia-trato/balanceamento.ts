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
export type Horario = "manha" | "almoco" | "tarde";

/** Uma dieta dentro de um horário — um vagão só carrega uma dieta por vez. */
export type GrupoDieta = {
  dietaId: string;
  dietaNome: string;
  curraisCodigos: string[];
  totalKg: number;
  numVagoes: number;
  cargaPorVagao: number;
  aproveitamento: number;
  /** Sugestão: carga igual em todos. Editável — ver guia_trato_vagao. */
  vagoesSugeridos: number[];
};

/**
 * Um horário do dia. numVagoesTotal soma os vagões de TODAS as dietas desse
 * horário — é a pergunta "quantas viagens de vagão pra tratar a fazenda
 * inteira nesse horário", igual a planilha de referência calcula. Quando a
 * fazenda usa uma dieta só pra todo mundo (ex. PD), `grupos` tem 1 item e da
 * no mesmo que somar tudo direto; quando currais têm dietas diferentes (ex.
 * BG), `grupos` tem vários, porque um vagão não mistura duas dietas — mas o
 * total de viagens continua sendo UM número só, pro peão.
 */
export type ResumoHorario = {
  horario: Horario;
  totalKg: number;
  numVagoesTotal: number;
  grupos: GrupoDieta[];
};

export type ResultadoBalanceamento = {
  totalAjustadoPorCurral: Record<string, number>;
  porHorario: ResumoHorario[];
};

export function totalAjustado(totalDiaKg: number, ajustePct: number, ajusteKg: number): number {
  return totalDiaKg * (1 + ajustePct) + ajusteKg;
}

/**
 * Nº mínimo de vagões para o total, com carga IGUAL entre eles (não "cheios +
 * um pela metade" — essa é a melhoria central sobre o processo antigo).
 */
function balancear(totalKg: number, capacidadeVagao: number) {
  if (totalKg <= 0 || capacidadeVagao <= 0) {
    return { numVagoes: 0, cargaPorVagao: 0, aproveitamento: 0, vagoesSugeridos: [] as number[] };
  }
  const numVagoes = Math.ceil(totalKg / capacidadeVagao);
  const cargaPorVagao = totalKg / numVagoes;
  return {
    numVagoes,
    cargaPorVagao,
    aproveitamento: cargaPorVagao / capacidadeVagao,
    vagoesSugeridos: Array(numVagoes).fill(cargaPorVagao),
  };
}

/**
 * Organiza por HORÁRIO primeiro (não por dieta) — é assim que o peão vive o
 * dia: de manhã, quantas viagens de vagão precisam sair pra tratar a fazenda
 * inteira. Dentro de cada horário, o total é dividido por dieta só onde
 * precisa (currais com dietas diferentes não podem compartilhar carga).
 */
export function calcularBalanceamento(
  currais: CurralAjuste[],
  splits: Splits,
  capacidadeVagao: number,
): ResultadoBalanceamento {
  const totalAjustadoPorCurral: Record<string, number> = {};
  const totaisPorDieta = new Map<
    string,
    { dietaNome: string; curraisCodigos: string[]; manha: number; almoco: number; tarde: number }
  >();

  for (const c of currais) {
    const total = totalAjustado(c.totalDiaKg, c.ajustePct, c.ajusteKg);
    totalAjustadoPorCurral[c.curralId] = total;

    const entrada = totaisPorDieta.get(c.dietaId) ?? {
      dietaNome: c.dietaNome,
      curraisCodigos: [],
      manha: 0,
      almoco: 0,
      tarde: 0,
    };
    entrada.curraisCodigos.push(c.curralCodigo);
    entrada.manha += total * splits.manha;
    entrada.almoco += total * splits.almoco;
    entrada.tarde += total * splits.tarde;
    totaisPorDieta.set(c.dietaId, entrada);
  }

  const horarios: Horario[] = ["manha", "almoco", "tarde"];
  const porHorario: ResumoHorario[] = horarios.map((horario) => {
    const grupos: GrupoDieta[] = [...totaisPorDieta.entries()]
      .map(([dietaId, t]) => {
        const totalKg = t[horario];
        const b = balancear(totalKg, capacidadeVagao);
        return {
          dietaId,
          dietaNome: t.dietaNome,
          curraisCodigos: t.curraisCodigos,
          totalKg,
          ...b,
        };
      })
      .filter((g) => g.totalKg > 0);

    return {
      horario,
      totalKg: grupos.reduce((soma, g) => soma + g.totalKg, 0),
      numVagoesTotal: grupos.reduce((soma, g) => soma + g.numVagoes, 0),
      grupos,
    };
  });

  return { totalAjustadoPorCurral, porHorario };
}
