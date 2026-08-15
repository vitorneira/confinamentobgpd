export type ParsedFarm = {
  codigo: string;
  nome: string;
  tipoPosse: "propria" | "arrendada";
  parametros: {
    precoArrobaReferencia: number;
    pctMateriaSeca: number;
    custoFixoDia: number;
    dataReferencia: string;
    gmdMeta: number;
    pesoAbateAlvo: number | null;
  };
  currais: Array<{ codigo: string; descricao: string | null }>;
  categorias: string[];
  ingredientes: string[];
  dietas: Array<{
    nome: string;
    composicao: Array<{ ingrediente: string; proporcao: number }>;
  }>;
  /** Uma linha por (curral, dieta vigente a partir de uma data). */
  vigencias: Array<{ curralCodigo: string; dietaNome: string; dataInicio: string }>;
  animais: Array<{
    brinco: string;
    categoria: string;
    curralCodigo: string;
    loteOrigem: string | null;
    dataEntrada: string;
    pesoEntradaKg: number;
  }>;
  pesagens: Array<{
    brinco: string;
    data: string;
    curralCodigo: string;
    pesoKg: number | null;
    obs: string | null;
  }>;
  tratos: Array<{
    data: string;
    curralCodigo: string;
    manhaKg: number;
    almocoKg: number;
    tardeKg: number;
    precoDietaCongelado: number;
    obs: string | null;
  }>;
  compras: Array<{
    data: string;
    ingrediente: string;
    precoKg: number;
    qtdKg: number | null;
    fornecedor: string | null;
    obs: string | null;
  }>;
};
