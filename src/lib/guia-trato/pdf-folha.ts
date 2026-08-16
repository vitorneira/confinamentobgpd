import PDFDocument from "pdfkit";
import { formatData, formatNumero } from "@/lib/format";

function mm(v: number): number {
  return v * 2.83464567;
}

export type ViagemImpressao = {
  numero: number;
  dietaNome: string;
  curraisCodigos: string[];
  kg: number;
  ingredientes: Array<{ ingredienteNome: string; kg: number }>;
};

export type HorarioImpressao = {
  horario: "manha" | "almoco" | "tarde";
  totalKg: number;
  viagens: ViagemImpressao[];
};

export type CurralImpressao = {
  curralCodigo: string;
  dietaNome: string;
  manha: number;
  almoco: number;
  tarde: number;
};

export type FolhaGuiaTratoInput = {
  fazendaNome: string;
  data: string;
  currais: CurralImpressao[];
  horarios: HorarioImpressao[];
};

const LABEL_HORARIO = { manha: "Manhã", almoco: "Almoço", tarde: "Tarde" } as const;

/** Agrupa vagões do mesmo tamanho (arredondado a 0.1 kg) — vira uma "viagem" numerada cada. */
export function agruparVagoes(cargas: number[]): Array<{ kg: number; quantidade: number }> {
  const grupos = new Map<number, number>();
  for (const carga of cargas) {
    const chave = Math.round(carga * 10) / 10;
    grupos.set(chave, (grupos.get(chave) ?? 0) + 1);
  }
  return [...grupos.entries()]
    .map(([kg, quantidade]) => ({ kg, quantidade }))
    .sort((a, b) => b.kg - a.kg);
}

export async function gerarFolhaGuiaTratoPDF(input: FolhaGuiaTratoInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: mm(15) });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const larguraUtil = doc.page.width - mm(30);

  doc.font("Helvetica-Bold").fontSize(16).text("Guia de Trato", mm(15), mm(12));
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#52525b")
    .text(`${input.fazendaNome} · ${formatData(input.data)}`, mm(15), doc.y + mm(1));
  doc.moveDown(1);
  doc.fillColor("#000000");

  doc.font("Helvetica-Bold").fontSize(10.5).text("KG POR CURRAL POR TRATO", mm(15), doc.y);
  doc.moveDown(0.3);

  const colW = larguraUtil / 5;
  const headerY = doc.y;
  doc.font("Helvetica-Bold").fontSize(8.5);
  ["CURRAL", "DIETA", "MANHÃ", "ALMOÇO", "TARDE"].forEach((titulo, i) => {
    doc.text(titulo, mm(15) + i * colW, headerY, { width: colW, align: i >= 2 ? "right" : "left" });
  });
  doc.moveDown(0.5);
  doc.moveTo(mm(15), doc.y).lineTo(mm(15) + larguraUtil, doc.y).lineWidth(0.5).stroke();
  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(9);
  for (const c of input.currais) {
    const y = doc.y;
    doc.text(c.curralCodigo, mm(15), y, { width: colW });
    doc.text(c.dietaNome, mm(15) + colW, y, { width: colW });
    doc.text(formatNumero(c.manha, 1), mm(15) + 2 * colW, y, { width: colW, align: "right" });
    doc.text(formatNumero(c.almoco, 1), mm(15) + 3 * colW, y, { width: colW, align: "right" });
    doc.text(formatNumero(c.tarde, 1), mm(15) + 4 * colW, y, { width: colW, align: "right" });
    doc.moveDown(0.4);
  }
  doc.moveDown(0.8);

  // Um vagão só carrega uma dieta por vez, mas o peão precisa de UMA lista
  // simples e sequencial por horário — não fragmentada por dieta — pra não
  // errar. O total de viagens já soma tudo (todas as dietas daquele horário).
  for (const h of input.horarios) {
    if (h.viagens.length === 0) continue;
    if (doc.y > doc.page.height - mm(50)) doc.addPage();

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#6B1A28")
      .text(
        `${LABEL_HORARIO[h.horario].toUpperCase()} — ${h.viagens.length} ${h.viagens.length === 1 ? "VIAGEM" : "VIAGENS"} · ${formatNumero(h.totalKg, 1)} KG NO TOTAL`,
        mm(15),
        doc.y,
      );
    doc.fillColor("#000000");
    doc.moveDown(0.5);

    for (const v of h.viagens) {
      if (doc.y > doc.page.height - mm(35)) doc.addPage();
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(
          `Viagem ${v.numero} — ${formatNumero(v.kg, 1)} kg — dieta ${v.dietaNome} — currais ${v.curraisCodigos.join(", ")}`,
          mm(15),
          doc.y,
          { width: larguraUtil },
        );
      doc.moveDown(0.15);
      const ingredientesTxt = v.ingredientes.map((ing) => `${ing.ingredienteNome} ${formatNumero(ing.kg, 1)}kg`).join(" · ");
      doc.font("Helvetica").fontSize(8.5).fillColor("#3f3f46").text(ingredientesTxt, mm(15), doc.y, { width: larguraUtil });
      doc.fillColor("#000000");
      doc.moveDown(0.6);
    }
    doc.moveDown(0.4);
  }

  doc.moveDown(0.5);
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor("#a1a1aa")
    .text(`Gerado pelo sistema de gestão de confinamento · ${formatData(new Date().toISOString().slice(0, 10))}`, mm(15), doc.y);

  doc.end();
  return done;
}
