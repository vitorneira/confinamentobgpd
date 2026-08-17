// Lógica pura (sem I/O) para a FOLHA IMPRESSA do Guia de Trato, no padrão da
// aba IMPRESSÃO de `dados_originais/Guia de Trato e Vagao - Pau DArco.xlsx`.
//
// Importante: isso é uma lógica DIFERENTE da usada em `balanceamento.ts` (tela
// de planejamento, que faz carga IGUAL entre vagões). Aqui a lógica é a da
// planilha original: encher vagões até a capacidade e sobrar 1 vagão "menor"
// com o resto — por pedido explícito do dono, só pra esta folha impressa.
// `balanceamento.ts` não é tocado por este arquivo.
import type { CurralAjuste, Horario, Splits } from "./balanceamento";
import { totalAjustado } from "./balanceamento";

function arredondar(v: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(v * fator) / fator;
}

export type Batida = {
  /** kg total do horário para essa dieta (soma dos kg de curral já arredondados a inteiro). */
  totalKg: number;
  /** nº de vagões cheios (na capacidade toda). */
  cheios: number;
  /** kg do vagão "menor" (resto), 0 se não sobra nada. */
  resto: number;
  /** cheios + (1 se tem resto). */
  nBatidas: number;
};

/** cheios = floor(total/capacidade); resto = total - cheios*capacidade. */
export function calcularBatida(totalKg: number, capacidadeVagao: number): Batida {
  const total = Math.max(arredondar(totalKg, 1), 0);
  if (total <= 0) return { totalKg: 0, cheios: 0, resto: 0, nBatidas: 0 };
  if (capacidadeVagao <= 0) return { totalKg: total, cheios: 0, resto: total, nBatidas: 1 };
  const cheios = Math.floor(total / capacidadeVagao);
  const resto = arredondar(total - cheios * capacidadeVagao, 1);
  return { totalKg: total, cheios, resto, nBatidas: cheios + (resto > 0 ? 1 : 0) };
}

export type LinhaCurralPlanilha = {
  curralCodigo: string;
  dietaId: string;
  dietaNome: string;
  /** kg por horário, já arredondados a inteiro (igual à tabela "KG por curral por trato"). */
  manha: number;
  almoco: number;
  tarde: number;
};

export type GrupoDietaPlanilha = {
  dietaId: string;
  dietaNome: string;
  curraisCodigos: string[];
  porHorario: Record<Horario, Batida>;
};

export type ResultadoPlanilha = {
  currais: LinhaCurralPlanilha[];
  grupos: GrupoDietaPlanilha[];
};

/**
 * Monta a tabela de curral (kg por horário, arredondado a inteiro por curral —
 * igual à planilha) e, por dieta, as batidas de vagão (encher + resto) de cada
 * horário. Os totais por horário de cada dieta são a SOMA dos kg de curral já
 * arredondados (não o total exato recalculado depois) — é assim que a
 * planilha original also soma (coluna de totais soma as células já
 * arredondadas), e é o que faz o resto bater exatamente com o exemplo de
 * referência (502 kg, não 501).
 */
export function calcularBalanceamentoPlanilha(
  currais: CurralAjuste[],
  splits: Splits,
  capacidadeVagao: number,
): ResultadoPlanilha {
  const linhasCurrais: LinhaCurralPlanilha[] = [];
  const totaisPorDieta = new Map<
    string,
    { dietaNome: string; curraisCodigos: string[]; manha: number; almoco: number; tarde: number }
  >();

  for (const c of currais) {
    const total = totalAjustado(c.totalDiaKg, c.ajustePct, c.ajusteKg);
    const manha = arredondar(total * splits.manha, 0);
    const almoco = arredondar(total * splits.almoco, 0);
    const tarde = arredondar(total * splits.tarde, 0);
    linhasCurrais.push({ curralCodigo: c.curralCodigo, dietaId: c.dietaId, dietaNome: c.dietaNome, manha, almoco, tarde });

    const entrada = totaisPorDieta.get(c.dietaId) ?? {
      dietaNome: c.dietaNome,
      curraisCodigos: [] as string[],
      manha: 0,
      almoco: 0,
      tarde: 0,
    };
    entrada.curraisCodigos.push(c.curralCodigo);
    entrada.manha += manha;
    entrada.almoco += almoco;
    entrada.tarde += tarde;
    totaisPorDieta.set(c.dietaId, entrada);
  }

  const grupos: GrupoDietaPlanilha[] = [...totaisPorDieta.entries()].map(([dietaId, t]) => ({
    dietaId,
    dietaNome: t.dietaNome,
    curraisCodigos: t.curraisCodigos,
    porHorario: {
      manha: calcularBatida(t.manha, capacidadeVagao),
      almoco: calcularBatida(t.almoco, capacidadeVagao),
      tarde: calcularBatida(t.tarde, capacidadeVagao),
    },
  }));

  return { currais: linhasCurrais, grupos };
}

export type ComposicaoDieta = { ingredienteNome: string; proporcao: number };

export type ColunaReceita = { tituloLinha1: string; tituloLinha2: string; kgColuna: number };
export type LinhaIngredientePlanilha = { ingredienteNome: string; valores: number[] };

export type BlocoDietaImpressao = {
  /** null quando só há 1 dieta no dia (sem subtítulo, igual à planilha de referência). */
  dietaNome: string | null;
  colunas: ColunaReceita[];
  ingredientes: LinhaIngredientePlanilha[];
  rodape: string[];
};

export type LinhaCurralImpressao = {
  curralCodigo: string;
  dietaNome: string | null;
  /** alinhado com `cabecalhoCurral` (a partir da 2ª/3ª coluna — CURRAL/DIETA são fixas). */
  valores: number[];
};

export type FolhaImpressao = {
  fazendaNome: string;
  data: string;
  mostrarColunaDieta: boolean;
  /** rótulos das colunas de kg (sem CURRAL/DIETA) — 2 itens se manhã=tarde, 3 senão. */
  cabecalhoCurral: string[];
  currais: LinhaCurralImpressao[];
  legenda: string[];
  blocosDieta: BlocoDietaImpressao[];
};

function linhaRodape(rotulo: string, batida: Batida, sufixoPequeno: string): string {
  const partes = [`${rotulo}: ${batida.cheios} VAGÃO GRANDE`];
  if (batida.resto > 0) partes.push(`1 PEQUENO${sufixoPequeno}`);
  return partes.join(" + ");
}

/**
 * Monta a estrutura completa e já formatada (números, não strings) da folha
 * impressa, pronta pra desenhar no PDF. Pura — sem pdfkit, sem banco — dá pra
 * testar isolado contra o exemplo de referência da planilha.
 */
export function montarFolhaImpressao(
  entrada: CurralAjuste[],
  splits: Splits,
  capacidadeVagao: number,
  composicaoPorDieta: Map<string, ComposicaoDieta[]>,
  fazendaNome: string,
  data: string,
): FolhaImpressao {
  const manhaIgualTarde = Math.abs(splits.manha - splits.tarde) < 1e-9;
  const dietaIds = new Set(entrada.map((c) => c.dietaId));
  const multiDieta = dietaIds.size > 1;

  const { currais, grupos } = calcularBalanceamentoPlanilha(entrada, splits, capacidadeVagao);

  const cabecalhoCurral = manhaIgualTarde ? ["MANHÃ/TARDE", "ALMOÇO"] : ["MANHÃ", "ALMOÇO", "TARDE"];
  const curraisImpressao: LinhaCurralImpressao[] = currais.map((c) => ({
    curralCodigo: c.curralCodigo,
    dietaNome: multiDieta ? c.dietaNome : null,
    valores: manhaIgualTarde ? [c.manha, c.almoco] : [c.manha, c.almoco, c.tarde],
  }));

  const legenda = manhaIgualTarde
    ? ["KG POR CURRAL POR TRATO", "TRATO DA MANHÃ É IGUAL O DA TARDE. ALMOÇO É MENOS."]
    : ["KG POR CURRAL POR TRATO", "MANHÃ, ALMOÇO E TARDE TÊM KG DIFERENTES."];

  const blocosDieta: BlocoDietaImpressao[] = grupos.map((g) => {
    const composicao = composicaoPorDieta.get(g.dietaId) ?? [];

    const colunas: ColunaReceita[] = [
      { tituloLinha1: "VAGÃO GRANDE", tituloLinha2: `(${arredondar(capacidadeVagao, 1)} kg)`, kgColuna: capacidadeVagao },
    ];
    if (manhaIgualTarde) {
      colunas.push({
        tituloLinha1: "VAGÃO PEQUENO",
        tituloLinha2: `MANHÃ/TARDE (${g.porHorario.manha.resto} kg)`,
        kgColuna: g.porHorario.manha.resto,
      });
      colunas.push({
        tituloLinha1: "VAGÃO PEQUENO",
        tituloLinha2: `ALMOÇO — MENOR (${g.porHorario.almoco.resto} kg)`,
        kgColuna: g.porHorario.almoco.resto,
      });
    } else {
      colunas.push({ tituloLinha1: "VAGÃO PEQUENO", tituloLinha2: `MANHÃ (${g.porHorario.manha.resto} kg)`, kgColuna: g.porHorario.manha.resto });
      colunas.push({
        tituloLinha1: "VAGÃO PEQUENO",
        tituloLinha2: `ALMOÇO — MENOR (${g.porHorario.almoco.resto} kg)`,
        kgColuna: g.porHorario.almoco.resto,
      });
      colunas.push({ tituloLinha1: "VAGÃO PEQUENO", tituloLinha2: `TARDE (${g.porHorario.tarde.resto} kg)`, kgColuna: g.porHorario.tarde.resto });
    }

    const ingredientes: LinhaIngredientePlanilha[] = composicao.map((c) => ({
      ingredienteNome: c.ingredienteNome,
      valores: colunas.map((col) => arredondar(col.kgColuna * c.proporcao, 1)),
    }));

    const rodape = manhaIgualTarde
      ? [linhaRodape("MANHÃ E TARDE", g.porHorario.manha, ""), linhaRodape("ALMOÇO", g.porHorario.almoco, " (MENOR)")]
      : [
          linhaRodape("MANHÃ", g.porHorario.manha, ""),
          linhaRodape("ALMOÇO", g.porHorario.almoco, " (MENOR)"),
          linhaRodape("TARDE", g.porHorario.tarde, ""),
        ];

    return { dietaNome: multiDieta ? g.dietaNome : null, colunas, ingredientes, rodape };
  });

  return {
    fazendaNome,
    data,
    mostrarColunaDieta: multiDieta,
    cabecalhoCurral,
    currais: curraisImpressao,
    legenda,
    blocosDieta,
  };
}
