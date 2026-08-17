import PDFDocument from "pdfkit";
import { formatData, formatNumero } from "@/lib/format";
import type { FolhaImpressao } from "./vagao-planilha";

function mm(v: number): number {
  return v * 2.83464567;
}

type Celula = { texto: string | string[]; negrito?: boolean; tamanho?: number; align?: "left" | "center" | "right" };

/** Uma linha de tabela com borda fina em toda célula — layout genérico usado
 * pelos dois blocos (curral e receita) da folha, no padrão da planilha
 * original (bordas em tudo, cabeçalho em negrito, números grandes). */
function desenharLinha(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  larguras: number[],
  celulas: Celula[],
  alturaLinha: number,
) {
  let cx = x;
  for (let i = 0; i < celulas.length; i++) {
    const w = larguras[i];
    doc.lineWidth(0.75).rect(cx, y, w, alturaLinha).stroke("#000000");
    const cel = celulas[i];
    const linhas = Array.isArray(cel.texto) ? cel.texto : [cel.texto];
    const tamanho = cel.tamanho ?? 10;
    doc.font(cel.negrito ? "Helvetica-Bold" : "Helvetica").fontSize(tamanho).fillColor("#000000");
    const alturaTexto = linhas.length * tamanho * 1.2;
    let ty = y + Math.max((alturaLinha - alturaTexto) / 2, 2);
    for (const linha of linhas) {
      doc.text(linha, cx + mm(1), ty, { width: w - mm(2), align: cel.align ?? "center" });
      ty += tamanho * 1.2;
    }
    cx += w;
  }
}

function garantirEspaco(doc: PDFKit.PDFDocument, alturaNecessaria: number) {
  if (doc.y + alturaNecessaria > doc.page.height - mm(15)) doc.addPage();
}

/** Como garantirEspaco, mas pra um bloco inteiro (cabeçalho + linhas + rodapé)
 * — evita quebrar a tabela deixando o cabeçalho numa página e o corpo na
 * seguinte. Se o bloco nem cabe inteiro numa página em branco, não força
 * nada (a quebra linha-a-linha de garantirEspaco ainda protege cada linha). */
function garantirEspacoBloco(doc: PDFKit.PDFDocument, alturaTotal: number) {
  const espacoDisponivel = doc.page.height - mm(15) - doc.y;
  const alturaPagina = doc.page.height - mm(30);
  if (alturaTotal > espacoDisponivel && alturaTotal <= alturaPagina) doc.addPage();
}

export async function gerarFolhaGuiaTratoPDF(input: FolhaImpressao): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: mm(15) });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const x0 = mm(15);
  const larguraUtil = doc.page.width - mm(30);

  doc.font("Helvetica-Bold").fontSize(15).text(`GUIA DE TRATO — ${input.fazendaNome.toUpperCase()}`, x0, doc.y);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#52525b")
    .text(formatData(input.data), x0, doc.y + mm(1));
  doc.fillColor("#000000");
  doc.moveDown(1);

  // ---------- Bloco 1: KG por curral por trato ----------
  const colunasBloco1 = ["CURRAL", ...(input.mostrarColunaDieta ? ["DIETA"] : []), ...input.cabecalhoCurral];
  const larguraCurral = mm(22);
  const larguraDieta = input.mostrarColunaDieta ? mm(38) : 0;
  const larguraKg = (larguraUtil - larguraCurral - larguraDieta) / input.cabecalhoCurral.length;
  const largurasBloco1 = [larguraCurral, ...(input.mostrarColunaDieta ? [larguraDieta] : []), ...input.cabecalhoCurral.map(() => larguraKg)];

  const alturaHeader1 = mm(9);
  const alturaLinhaCurral = mm(9);
  garantirEspacoBloco(doc, alturaHeader1 + input.currais.length * alturaLinhaCurral);
  desenharLinha(
    doc,
    x0,
    doc.y,
    largurasBloco1,
    colunasBloco1.map((titulo) => ({ texto: titulo, negrito: true, tamanho: 9 })),
    alturaHeader1,
  );
  doc.y += alturaHeader1;

  for (const c of input.currais) {
    garantirEspaco(doc, alturaLinhaCurral);
    const celulas: Celula[] = [{ texto: c.curralCodigo, negrito: true, tamanho: 13 }];
    if (input.mostrarColunaDieta) celulas.push({ texto: c.dietaNome ?? "?", tamanho: 8.5, align: "left" });
    for (const v of c.valores) celulas.push({ texto: formatNumero(v, 0), tamanho: 12 });
    desenharLinha(doc, x0, doc.y, largurasBloco1, celulas, alturaLinhaCurral);
    doc.y += alturaLinhaCurral;
  }

  // ---------- Legenda ----------
  doc.moveDown(0.5);
  const alturaLegenda = mm(6) * input.legenda.length + mm(2);
  garantirEspaco(doc, alturaLegenda);
  desenharLinha(
    doc,
    x0,
    doc.y,
    [larguraUtil],
    [{ texto: input.legenda, negrito: true, tamanho: 9, align: "center" }],
    alturaLegenda,
  );
  doc.y += alturaLegenda;
  doc.moveDown(0.8);

  // ---------- Bloco 2: receita de cada vagão (uma tabela por dieta) ----------
  const larguraIngrediente = mm(42);
  for (const bloco of input.blocosDieta) {
    const alturaHeader2 = mm(13);
    const alturaLinhaIng = mm(8);
    const alturaRodape = mm(7) * bloco.rodape.length + mm(2);
    const alturaSubtitulo = bloco.dietaNome ? mm(7) : 0;
    garantirEspacoBloco(
      doc,
      alturaSubtitulo + alturaHeader2 + bloco.ingredientes.length * alturaLinhaIng + mm(2) + alturaRodape,
    );

    if (bloco.dietaNome) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#6B1A28").text(`RECEITA — ${bloco.dietaNome.toUpperCase()}`, x0, doc.y);
      doc.fillColor("#000000");
      doc.moveDown(0.3);
    }

    const larguraColuna = (larguraUtil - larguraIngrediente) / bloco.colunas.length;
    const largurasBloco2 = [larguraIngrediente, ...bloco.colunas.map(() => larguraColuna)];

    garantirEspaco(doc, alturaHeader2);
    desenharLinha(
      doc,
      x0,
      doc.y,
      largurasBloco2,
      [
        { texto: "INGREDIENTE", negrito: true, tamanho: 9, align: "left" },
        ...bloco.colunas.map((col) => ({ texto: [col.tituloLinha1, col.tituloLinha2], negrito: true, tamanho: 8.5 })),
      ],
      alturaHeader2,
    );
    doc.y += alturaHeader2;

    for (const ing of bloco.ingredientes) {
      garantirEspaco(doc, alturaLinhaIng);
      desenharLinha(
        doc,
        x0,
        doc.y,
        largurasBloco2,
        [
          { texto: ing.ingredienteNome.toUpperCase(), negrito: true, tamanho: 10.5, align: "left" },
          ...ing.valores.map((v) => ({ texto: formatNumero(v, 1), tamanho: 12 })),
        ],
        alturaLinhaIng,
      );
      doc.y += alturaLinhaIng;
    }

    // ---------- Rodapé (resumo de batidas) desse bloco/dieta ----------
    doc.moveDown(0.4);
    garantirEspaco(doc, alturaRodape);
    desenharLinha(
      doc,
      x0,
      doc.y,
      [larguraUtil],
      [{ texto: bloco.rodape, negrito: true, tamanho: 10.5, align: "center" }],
      alturaRodape,
    );
    doc.y += alturaRodape;
    doc.moveDown(1);
  }

  doc.moveDown(0.3);
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor("#a1a1aa")
    .text(`Gerado pelo sistema de gestão de confinamento · ${formatData(new Date().toISOString().slice(0, 10))}`, x0, doc.y);

  doc.end();
  return done;
}
