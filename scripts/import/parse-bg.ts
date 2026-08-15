import { loadWorkbook, readSheetAsObjects, toDateStr, toStr, toNum, toNumOrNull } from "./lib";
import type { ParsedFarm } from "./types";

const DIETA_COLUMNS = ["Touros", "Boi Nelore", "Bezerros", "Descarte"];

export function parseBG(): ParsedFarm {
  const wb = loadWorkbook("Confinamento BG - Base de Dados.xlsx");

  const paramRows = readSheetAsObjects(wb, "Parâmetros", 1);
  const paramMap = new Map(paramRows.map((r) => [toStr(r["Parâmetro"]), r["Valor"]]));

  const curraisRows = readSheetAsObjects(wb, "Currais", 1).filter((r) => r["Curral"] !== null);
  const currais = curraisRows.map((r) => ({
    codigo: toStr(r["Curral"]),
    descricao: r["Descrição"] === null ? null : toStr(r["Descrição"]),
  }));

  const ingredientesRows = readSheetAsObjects(wb, "Ingredientes_Dieta", 3).filter(
    (r) => r["Última compra"] instanceof Date,
  );
  const ingredientes = ingredientesRows.map((r) => toStr(r["Ingrediente"]));
  const dietas = DIETA_COLUMNS.map((dietaNome) => ({
    nome: dietaNome,
    composicao: ingredientesRows.map((r) => ({
      ingrediente: toStr(r["Ingrediente"]),
      proporcao: toNum(r[dietaNome]),
    })),
  }));

  const animaisRows = readSheetAsObjects(wb, "Cadastro_Animais", 1);
  const animais = animaisRows.map((r) => ({
    brinco: toStr(r["Brinco"]),
    categoria: toStr(r["Categoria"]),
    curralCodigo: toStr(r["Curral"]),
    loteOrigem: r["Lote/Origem"] === null ? null : toStr(r["Lote/Origem"]),
    dataEntrada: toDateStr(r["Data Entrada"]),
    pesoEntradaKg: toNum(r["Peso Entrada (kg)"]),
  }));

  const categorias = [...new Set(animais.map((a) => a.categoria))];

  // Vigência: BG não tem histórico de troca de dieta — 1 vigência por curral,
  // iniciando na entrada mais antiga de animal daquele curral.
  const primeiraEntradaPorCurral = new Map<string, string>();
  for (const a of animais) {
    const atual = primeiraEntradaPorCurral.get(a.curralCodigo);
    if (!atual || a.dataEntrada < atual) primeiraEntradaPorCurral.set(a.curralCodigo, a.dataEntrada);
  }
  const vigencias = currais
    .map((c) => {
      const dietaNome = curraisRows.find((r) => toStr(r["Curral"]) === c.codigo)?.["Dieta"];
      if (!dietaNome) return null;
      return {
        curralCodigo: c.codigo,
        dietaNome: toStr(dietaNome),
        dataInicio: primeiraEntradaPorCurral.get(c.codigo) ?? toDateStr(paramMap.get("Data de referência")),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const pesagensRows = readSheetAsObjects(wb, "Pesagens", 1);
  const pesagens = pesagensRows.map((r) => ({
    brinco: toStr(r["Brinco"]),
    data: toDateStr(r["Data"]),
    curralCodigo: toStr(r["Curral"]),
    pesoKg: toNumOrNull(r["Peso (kg)"]),
    obs: r["Evento/Obs"] === null ? null : toStr(r["Evento/Obs"]),
  }));

  const tratoRows = readSheetAsObjects(wb, "Trato_Diario", 2);
  const tratos = tratoRows.map((r) => ({
    data: toDateStr(r["Data"]),
    curralCodigo: toStr(r["Curral"]),
    manhaKg: toNum(r["Trato Manhã (kg MN)"]),
    almocoKg: toNum(r["Trato Almoço (kg MN)"]),
    tardeKg: toNum(r["Trato Tarde (kg MN)"]),
    precoDietaCongelado: toNum(r["Custo Dieta (R$/kg)"]),
    obs: r["Obs"] === null ? null : toStr(r["Obs"]),
  }));

  const comprasRows = readSheetAsObjects(wb, "Precos_Insumos", 2).filter(
    (r) => r["Data"] !== null && r["Insumo"] !== null,
  );
  const compras = comprasRows.map((r) => ({
    data: toDateStr(r["Data"]),
    ingrediente: toStr(r["Insumo"]),
    precoKg: toNum(r["Preço (R$/kg)"]),
    qtdKg: toNumOrNull(r["Qtd Comprada (kg)"]),
    fornecedor: r["Fornecedor"] === null ? null : toStr(r["Fornecedor"]),
    obs: r["Obs"] === null ? null : toStr(r["Obs"]),
  }));

  return {
    codigo: "BG",
    nome: "Barra Grande",
    tipoPosse: "propria",
    parametros: {
      precoArrobaReferencia: toNum(paramMap.get("Preço da arroba (R$/@)")),
      pctMateriaSeca: toNum(paramMap.get("% Matéria seca da dieta")),
      custoFixoDia: toNum(paramMap.get("Custo fixo diário (R$/cab/dia)")),
      dataReferencia: toDateStr(paramMap.get("Data de referência")),
      // Não existem no Excel original — sem meta de GMD registrada por fazenda ainda.
      // Ajustar na tela de Parâmetros (Etapa 9) quando o dono definir o valor real.
      gmdMeta: 1.2,
      pesoAbateAlvo: null,
    },
    currais,
    categorias,
    ingredientes,
    dietas,
    vigencias,
    animais,
    pesagens,
    tratos,
    compras,
  };
}
