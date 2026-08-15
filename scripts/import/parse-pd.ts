import { loadWorkbook, readSheetAsObjects, toDateStr, toStr, toNum, toNumOrNull } from "./lib";
import type { ParsedFarm } from "./types";

const DIETA_COLUMNS: Array<{ header: string; nome: string }> = [
  { header: "% Adaptação", nome: "Adaptação" },
  { header: "% Crescimento", nome: "Crescimento" },
];

export function parsePD(): ParsedFarm {
  const wb = loadWorkbook("Confinamento PD - Base de Dados.xlsx");

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
  const dietas = DIETA_COLUMNS.map(({ header, nome }) => ({
    nome,
    composicao: ingredientesRows.map((r) => ({
      ingrediente: toStr(r["Ingrediente"]),
      proporcao: toNum(r[header]),
    })),
  }));

  // Tabela "DIETAS — VIGÊNCIA" na mesma aba: quando cada fase passou a valer.
  // Na PD a troca acontece na mesma data para todos os currais.
  const vigenciaRows = readSheetAsObjects(wb, "Ingredientes_Dieta", 14).filter(
    (r) => r["Início (vigência)"] !== null,
  );
  const vigenciaGlobal = vigenciaRows.map((r) => ({
    dietaNome: toStr(r["Dieta"]),
    dataInicio: toDateStr(r["Início (vigência)"]),
  }));
  const vigencias = currais.flatMap((c) =>
    vigenciaGlobal.map((v) => ({
      curralCodigo: c.codigo,
      dietaNome: v.dietaNome,
      dataInicio: v.dataInicio,
    })),
  );

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
    codigo: "PD",
    nome: "Pau D'Arco",
    tipoPosse: "propria",
    parametros: {
      precoArrobaReferencia: toNum(paramMap.get("Preço da arroba (R$/@)")),
      pctMateriaSeca: toNum(paramMap.get("% Matéria seca da dieta")),
      custoFixoDia: toNum(paramMap.get("Custo fixo diário (R$/cab/dia)")),
      dataReferencia: toDateStr(paramMap.get("Data de referência")),
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
