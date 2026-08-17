import PDFDocument from "pdfkit";
import type { ApuracaoVenda } from "@/lib/queries/vendas";
import { formatData, formatMoeda, formatNumero, formatPercentual } from "@/lib/format";

function mm(v: number): number {
  return v * 2.83464567;
}

type Linha = { label: string; valor: string; destaque?: boolean };

function secao(doc: PDFKit.PDFDocument, titulo: string, linhas: Linha[], x: number, larguraUtil: number) {
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#6B1A28").text(titulo.toUpperCase(), x, doc.y, {
    characterSpacing: 0.6,
  });
  doc.moveDown(0.3);
  doc.fillColor("#000000");

  for (const linha of linhas) {
    const y = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor("#3f3f46").text(linha.label, x, y, { width: larguraUtil * 0.62 });
    doc
      .font(linha.destaque ? "Helvetica-Bold" : "Helvetica")
      .fontSize(linha.destaque ? 11 : 10)
      .fillColor("#000000")
      .text(linha.valor, x + larguraUtil * 0.62, y, { width: larguraUtil * 0.38, align: "right" });
    doc.moveDown(0.45);
  }
  doc.moveDown(0.6);
}

export async function gerarReciboVendaPDF(
  ap: ApuracaoVenda,
  fazendaNome: string,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: mm(18) });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const larguraUtil = doc.page.width - mm(36);
  const x = mm(18);

  doc.font("Helvetica-Bold").fontSize(17).fillColor("#000000").text("Fechamento de lote / Venda", x, doc.y);
  doc.font("Helvetica").fontSize(11).fillColor("#52525b").text(`${fazendaNome} · Curral ${ap.curralCodigo}`, x, doc.y + mm(1.5));
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#71717a")
    .text(
      [
        ap.tipoVenda === "direta" ? (ap.comprador ?? "—") : (ap.frigorifico ?? "—"),
        ap.nf ? `NF ${ap.nf}` : null,
        ap.dataAbate ? `abate ${formatData(ap.dataAbate)}` : null,
        `saída ${formatData(ap.dataSaida)}`,
      ]
        .filter(Boolean)
        .join("   ·   "),
      x,
      doc.y,
    );
  doc.moveDown(1);

  const corResultado = (ap.lucroLote ?? 0) >= 0 ? "#166534" : "#b91c1c";
  const rotuloResultado = (ap.lucroLote ?? 0) >= 0 ? "LUCRO DO LOTE" : "PREJUÍZO DO LOTE";
  const bannerY = doc.y;
  doc.rect(x, bannerY, larguraUtil, mm(22)).fill("#f4f4f5");
  doc.fillColor("#52525b").font("Helvetica-Bold").fontSize(9).text(rotuloResultado, x + mm(6), bannerY + mm(4), {
    characterSpacing: 0.6,
  });
  doc.fillColor(corResultado).font("Helvetica-Bold").fontSize(20).text(formatMoeda(ap.lucroLote), x + mm(6), bannerY + mm(9));
  doc
    .fillColor("#52525b")
    .font("Helvetica")
    .fontSize(9.5)
    .text(`${formatMoeda(ap.lucroPorCab)} / cabeça   ·   margem ${formatPercentual(ap.margem, 1)}   ·   ROI ${formatPercentual(ap.roi, 1)}`, x + mm(6), bannerY + mm(15.5));
  doc.y = bannerY + mm(22) + mm(6);
  doc.fillColor("#000000");

  secao(doc, "Dados da venda", [
    { label: "Cabeças", valor: String(ap.cabecas) },
    ...(ap.tipoVenda === "abate"
      ? [
          { label: "Preço da @ (venda)", valor: formatMoeda(ap.precoArroba) },
          { label: "Peso de carcaça total (kg)", valor: formatNumero(ap.pesoCarcacaTotal) },
          { label: "Arrobas de carcaça (@)", valor: formatNumero(ap.arrobasCarcaca, 2) },
          { label: "Carcaça média por cabeça (kg)", valor: formatNumero(ap.carcacaMediaPorCab, 1) },
          { label: "Rendimento de carcaça (calculado)", valor: formatPercentual(ap.rendimentoCalculado, 2) },
        ]
      : [{ label: "Comprador", valor: ap.comprador ?? "—" }]),
    { label: "Valor bruto", valor: formatMoeda(ap.valorBruto) },
    { label: "(-) Frete", valor: formatMoeda(ap.frete) },
    { label: "(-) Comissão", valor: formatMoeda(ap.comissao) },
    { label: "(-) Outras deduções", valor: formatMoeda(ap.deducoes) },
    { label: "Valor líquido", valor: formatMoeda(ap.valorLiquido), destaque: true },
  ], x, larguraUtil);

  secao(doc, "Custo do lote", [
    { label: "Custo de entrada", valor: formatMoeda(ap.custoEntrada) },
    { label: "Custo de ração (real, até a saída)", valor: formatMoeda(ap.custoRacaoVendidos) },
    { label: "Custo fixo", valor: formatMoeda(ap.custoFixoVendidos) },
    { label: "Custo total", valor: formatMoeda(ap.custoTotal), destaque: true },
    { label: "Custo total por cabeça", valor: formatMoeda(ap.custoTotalPorCab) },
  ], x, larguraUtil);

  secao(doc, "Resultado", [
    { label: "Lucro do lote", valor: formatMoeda(ap.lucroLote), destaque: true },
    { label: "Lucro por cabeça", valor: formatMoeda(ap.lucroPorCab) },
    { label: "Margem sobre a receita", valor: formatPercentual(ap.margem, 1) },
    { label: "ROI sobre o custo", valor: formatPercentual(ap.roi, 1) },
    { label: "Custo da @ produzida (só ração)", valor: formatMoeda(ap.custoArrobaSoRacao) },
    { label: "Custo da @ produzida (ração + fixo)", valor: formatMoeda(ap.custoArrobaTotal) },
  ], x, larguraUtil);

  secao(doc, "Zootécnico", [
    { label: "Peso médio de entrada (kg)", valor: formatNumero(ap.pesoMedioEntradaKg, 1) },
    { label: "Peso médio de saída (kg)", valor: formatNumero(ap.pesoMedioSaidaKg, 1) },
    { label: "Ganho total do lote (kg)", valor: formatNumero(ap.ganhoTotalKg) },
    { label: "GMD médio (kg/dia)", valor: formatNumero(ap.gmdMedio, 2) },
    { label: "Dias de confinamento (média)", valor: formatNumero(ap.diasConfinamentoMedio, 1) },
  ], x, larguraUtil);

  if (ap.porCategoria.length > 0) {
    secao(
      doc,
      "Composição da venda",
      ap.porCategoria.map((c) => ({ label: c.categoriaNome, valor: `${c.quantidade} cab.` })),
      x,
      larguraUtil,
    );
  }

  if (ap.itensIndividuais.length > 0) {
    secao(
      doc,
      "Animais individuais",
      ap.itensIndividuais.map((it) => ({
        label: it.brinco,
        valor: it.valorNegociado !== null ? formatMoeda(it.valorNegociado) : "—",
      })),
      x,
      larguraUtil,
    );
  }

  doc.moveDown(0.5);
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor("#a1a1aa")
    .text(`Gerado pelo sistema de gestão de confinamento · ${formatData(new Date().toISOString().slice(0, 10))}`, x, doc.y);

  doc.end();
  return done;
}
