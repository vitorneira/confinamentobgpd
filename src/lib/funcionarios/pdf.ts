// Recorta um intervalo de páginas (1-based, inclusivo) de um PDF em um novo
// arquivo — usado pra guardar o "recorte individual" de cada funcionário
// separado do lote/PDF original completo (ver funcionario_documento).
import { PDFDocument } from "pdf-lib";

export async function recortarPaginas(pdfBytes: Uint8Array, paginaInicio: number, paginaFim: number): Promise<Uint8Array> {
  const origem = await PDFDocument.load(pdfBytes);
  const total = origem.getPageCount();
  const inicio = Math.max(1, Math.min(paginaInicio, total));
  const fim = Math.max(inicio, Math.min(paginaFim, total));

  const novo = await PDFDocument.create();
  const indices = Array.from({ length: fim - inicio + 1 }, (_, i) => inicio - 1 + i);
  const paginas = await novo.copyPages(origem, indices);
  paginas.forEach((pagina) => novo.addPage(pagina));
  return novo.save();
}

/** Área retangular de uma página, 0 a 1, origem no canto superior esquerdo (convenção de imagem). */
export type CaixaNormalizada = { x0: number; y0: number; x1: number; y1: number };

const MARGEM_CAIXA = 0.02; // folga de 2% pra não cortar borda de texto

/**
 * Recorta só uma região de uma página (não a página inteira) — usado quando
 * mais de uma pessoa aparece na mesma página (comum em recibo, várias vias
 * por folha). pdf-lib não tem um "crop" direto: o truque é embutir a página
 * de origem já recortada (embedPage aceita um boundingBox) numa página nova
 * do tamanho exato da região.
 */
export async function recortarRegiao(pdfBytes: Uint8Array, pagina: number, caixa: CaixaNormalizada): Promise<Uint8Array> {
  const origem = await PDFDocument.load(pdfBytes);
  const total = origem.getPageCount();
  const indice = Math.max(0, Math.min(pagina - 1, total - 1));
  const paginaOrigem = origem.getPages()[indice];
  const largura = paginaOrigem.getWidth();
  const altura = paginaOrigem.getHeight();

  const x0 = Math.max(0, caixa.x0 - MARGEM_CAIXA);
  const x1 = Math.min(1, caixa.x1 + MARGEM_CAIXA);
  const y0 = Math.max(0, caixa.y0 - MARGEM_CAIXA); // distância do topo, fração
  const y1 = Math.min(1, caixa.y1 + MARGEM_CAIXA);

  const boundingBox = {
    left: x0 * largura,
    right: x1 * largura,
    top: (1 - y0) * altura, // PDF mede a partir da base da página
    bottom: (1 - y1) * altura,
  };
  const larguraRecorte = boundingBox.right - boundingBox.left;
  const alturaRecorte = boundingBox.top - boundingBox.bottom;

  const novo = await PDFDocument.create();
  const embutida = await novo.embedPage(paginaOrigem, boundingBox);
  const novaPagina = novo.addPage([larguraRecorte, alturaRecorte]);
  novaPagina.drawPage(embutida, { x: 0, y: 0, width: larguraRecorte, height: alturaRecorte });
  return novo.save();
}
