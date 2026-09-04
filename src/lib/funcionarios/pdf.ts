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
