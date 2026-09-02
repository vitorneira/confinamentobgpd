import type { ItemEstoquePasto } from "./extracao";

export type ItemEstoqueValidado = {
  pasto: string;
  categoria: string;
  quantidade: number;
  pastoId: string | null;
  pastoNovo: boolean;
};

function buscarPorNome(mapa: Map<string, string>, nome: string): string | null {
  if (mapa.has(nome)) return mapa.get(nome)!;
  const nomeLower = nome.trim().toLowerCase();
  for (const [k, v] of mapa) {
    if (k.trim().toLowerCase() === nomeLower) return v;
  }
  return null;
}

export function validarItensEstoquePasto(
  itens: ItemEstoquePasto[],
  pastoIdPorNome: Map<string, string>,
): ItemEstoqueValidado[] {
  return itens.map((item) => {
    const pastoId = buscarPorNome(pastoIdPorNome, item.pasto);
    return {
      pasto: item.pasto,
      categoria: item.categoria,
      quantidade: item.quantidade,
      pastoId,
      pastoNovo: !pastoId,
    };
  });
}
