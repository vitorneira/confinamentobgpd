import PDFDocument from "pdfkit";
import { ordenarPorBrinco } from "@/lib/brinco-sort";

function mm(v: number): number {
  return v * 2.83464567;
}

export type FolhaCampoParams = {
  fazenda: string;
  curral: string;
  modo: "individual" | "agregado";
  brincos?: string[]; // individual
  quantidade?: number; // agregado
};

export async function gerarFolhaCampoPDF(params: FolhaCampoParams): Promise<Buffer> {
  const { fazenda, curral, modo } = params;
  const labels: string[] =
    modo === "individual"
      ? ordenarPorBrinco(params.brincos ?? [], (b) => b).map((b) => String(b))
      : Array.from({ length: params.quantidade ?? 0 }, (_, i) => String(i + 1));

  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const W = doc.page.width;
  const H = doc.page.height;
  const left = mm(15);
  const right = mm(15);
  const top = mm(44);
  const bottom = mm(15);
  const colCount = 3;
  const colW = (W - left - right) / colCount;
  const rowH = mm(9);
  const rowsPerCol = Math.floor((H - top - bottom) / rowH);
  const perPage = rowsPerCol * colCount;
  const total = labels.length;
  const pages = Math.max(1, Math.ceil(total / perPage));

  function desenharCabecalho(pagina: number) {
    doc.font("Helvetica-Bold").fontSize(15).text("FOLHA DE PESAGEM — CAMPO", mm(15), mm(12));
    doc.font("Helvetica").fontSize(10).text(`Pág. ${pagina}/${pages}`, W - mm(15) - mm(30), mm(14), {
      width: mm(30),
      align: "right",
    });

    const y = mm(24);
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("FAZENDA:", mm(15), y);
    doc.rect(mm(38), y - mm(1.5), mm(30), mm(7)).stroke();
    doc.font("Helvetica").fontSize(11).text(fazenda, mm(41), y);

    doc.font("Helvetica-Bold").fontSize(10).text("LOTE/CURRAL:", mm(75), y);
    doc.rect(mm(108), y - mm(1.5), mm(30), mm(7)).stroke();
    doc.font("Helvetica").fontSize(11).text(String(curral), mm(111), y);

    doc.font("Helvetica-Bold").fontSize(10).text("DATA:", mm(150), y);
    doc.rect(mm(163), y - mm(1.5), mm(32), mm(7)).stroke();
    doc.font("Helvetica").fontSize(8).text("____/____/______", mm(164), y + mm(4));

    doc.font("Helvetica-Oblique").fontSize(8);
    const instrucao =
      modo === "individual"
        ? "Anote o PESO (kg) na frente de cada brinco. Marque com X se o animal não for pesado."
        : "Anote BRINCO (se houver) e PESO (kg) em cada linha. Lote sem brinco: só o peso.";
    doc.text(instrucao, mm(15), mm(34));
  }

  let idx = 0;
  for (let p = 0; p < pages; p++) {
    if (p > 0) doc.addPage();
    desenharCabecalho(p + 1);

    for (let col = 0; col < colCount; col++) {
      const x = left + col * colW;
      doc.font("Helvetica-Bold").fontSize(8);
      if (modo === "individual") {
        doc.text("BRINCO", x + mm(1), top - mm(5));
        doc.text("PESO (kg)", x + colW - mm(24), top - mm(5));
      } else {
        doc.text("Nº", x + mm(1), top - mm(5));
        doc.text("BRINCO", x + mm(11), top - mm(5));
        doc.text("PESO (kg)", x + colW - mm(24), top - mm(5));
      }

      for (let r = 0; r < rowsPerCol; r++) {
        if (idx >= total) break;
        const label = labels[idx];
        idx++;
        const rowTop = top + r * rowH;
        const baseline = rowTop + rowH - mm(2);
        doc.moveTo(x, baseline).lineTo(x + colW - mm(4), baseline).lineWidth(0.4).stroke();
        doc.font("Helvetica").fontSize(10).text(label, x + mm(1), baseline - mm(5.5));
        doc.rect(x + colW - mm(24), rowTop + mm(2.2), mm(20), rowH - mm(2.5)).stroke();
      }
    }
  }

  doc.end();
  return done;
}
