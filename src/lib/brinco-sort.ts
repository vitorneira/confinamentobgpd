/**
 * Ordenação canônica de brinco (DATA_MODEL.md): prefixo alfabético primeiro,
 * número como número dentro do prefixo ("BBG 998" antes de "BBG 1004"); brincos
 * só numéricos com sufixo de ano ("897/24") ordenam pelo número antes da barra e
 * vêm depois dos com prefixo textual. Espelha `dados_originais/geradores/gerar_folha_campo.py`.
 */
type Chave = [grupo: number, prefixo: string, numero: number, original: string];

function brincoSortKey(brinco: string): Chave {
  const b = brinco.trim();
  const comPrefixo = b.match(/^([A-Za-zÀ-ÿ]+)\s*0*(\d+)/);
  if (comPrefixo) {
    return [0, comPrefixo[1].toUpperCase(), Number(comPrefixo[2]), b];
  }
  const soNumero = b.match(/^0*(\d+)/);
  if (soNumero) {
    return [1, "", Number(soNumero[1]), b];
  }
  return [2, b.toUpperCase(), 0, b];
}

function compararChaves(a: Chave, b: Chave): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  if (a[2] !== b[2]) return a[2] - b[2];
  return a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0;
}

export function ordenarPorBrinco<T>(itens: T[], getBrinco: (item: T) => string): T[] {
  return [...itens].sort((a, b) => compararChaves(brincoSortKey(getBrinco(a)), brincoSortKey(getBrinco(b))));
}
