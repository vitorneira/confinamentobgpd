import type { AnimalBruto, PesagemBruta } from "./parser";

export type ReferenciaCadastro = {
  curralIdPorCodigo: Map<string, string>;
  categoriaIdPorNome: Map<string, string>;
  animalIdPorBrinco: Map<string, string>;
};

export type PesagemValidada = {
  linha: number;
  data: string | null;
  brinco: string;
  categoria: string | null;
  curralCodigo: string;
  pesoKg: number | null;
  curralId: string | null;
  categoriaId: string | null;
  animalId: string | null;
  novoAnimal: boolean;
  erro: string | null;
};

export type AnimalValidado = {
  linha: number;
  tipoEntrada: "individual" | "agregado";
  dataEntrada: string | null;
  brinco: string | null;
  categoria: string;
  curralCodigo: string;
  loteOrigem: string | null;
  quantidade: number | null;
  pesoEntradaKg: number | null;
  curralId: string | null;
  categoriaId: string | null;
  erro: string | null;
};

function buscarPorCodigoOuNome(mapa: Map<string, string>, chave: string): string | null {
  if (mapa.has(chave)) return mapa.get(chave)!;
  const chaveLower = chave.trim().toLowerCase();
  for (const [k, v] of mapa) {
    if (k.trim().toLowerCase() === chaveLower) return v;
  }
  return null;
}

export function validarPesagens(
  rows: PesagemBruta[],
  ref: ReferenciaCadastro,
): PesagemValidada[] {
  return rows.map((r) => {
    const curralId = buscarPorCodigoOuNome(ref.curralIdPorCodigo, r.curral);
    const categoriaId = r.categoria ? buscarPorCodigoOuNome(ref.categoriaIdPorNome, r.categoria) : null;
    const animalId = r.brinco ? (ref.animalIdPorBrinco.get(r.brinco.trim()) ?? null) : null;
    const novoAnimal = !animalId && !!r.brinco;

    let erro: string | null = null;
    if (!r.data) erro = "Data inválida ou vazia";
    else if (!r.brinco) erro = "Brinco vazio";
    else if (!curralId) erro = `Curral "${r.curral}" não encontrado`;
    else if (r.pesoKg !== null && r.pesoKg <= 0) erro = "Peso deve ser maior que zero";
    else if (novoAnimal && !categoriaId) {
      erro = r.categoria
        ? `Categoria "${r.categoria}" não encontrada (brinco novo precisa de categoria válida)`
        : "Brinco novo sem categoria — não dá pra cadastrar";
    }

    return {
      linha: r.linha,
      data: r.data,
      brinco: r.brinco,
      categoria: r.categoria,
      curralCodigo: r.curral,
      pesoKg: r.pesoKg,
      curralId,
      categoriaId,
      animalId,
      novoAnimal,
      erro,
    };
  });
}

export function validarAnimaisNovos(
  rows: AnimalBruto[],
  ref: ReferenciaCadastro,
): AnimalValidado[] {
  return rows.map((r) => {
    const curralId = buscarPorCodigoOuNome(ref.curralIdPorCodigo, r.curral);
    const categoriaId = buscarPorCodigoOuNome(ref.categoriaIdPorNome, r.categoria);
    const tipo = r.tipoEntrada === "agregado" ? "agregado" : "individual";

    let erro: string | null = null;
    if (r.tipoEntrada !== "individual" && r.tipoEntrada !== "agregado") {
      erro = `Tipo de entrada "${r.tipoEntrada}" inválido (use individual ou agregado)`;
    } else if (!r.dataEntrada) {
      erro = "Data de entrada inválida ou vazia";
    } else if (!curralId) {
      erro = `Curral "${r.curral}" não encontrado`;
    } else if (!categoriaId) {
      erro = `Categoria "${r.categoria}" não encontrada`;
    } else if (tipo === "individual") {
      if (!r.brinco) erro = "Individual precisa de brinco";
      else if (ref.animalIdPorBrinco.has(r.brinco.trim())) erro = `Brinco "${r.brinco}" já cadastrado`;
      else if (!r.pesoEntradaKg || r.pesoEntradaKg <= 0) erro = "Peso de entrada inválido";
    } else {
      if (!r.quantidade || r.quantidade <= 0) erro = "Quantidade (agregado) inválida";
      else if (!r.pesoEntradaKg || r.pesoEntradaKg <= 0) erro = "Peso médio de entrada inválido";
    }

    return {
      linha: r.linha,
      tipoEntrada: tipo,
      dataEntrada: r.dataEntrada,
      brinco: r.brinco,
      categoria: r.categoria,
      curralCodigo: r.curral,
      loteOrigem: r.loteOrigem,
      quantidade: r.quantidade,
      pesoEntradaKg: r.pesoEntradaKg,
      curralId,
      categoriaId,
      erro,
    };
  });
}
