import * as XLSX from "xlsx";

export type PesagemBruta = {
  linha: number;
  data: string | null;
  brinco: string;
  categoria: string | null;
  curral: string;
  pesoKg: number | null;
};

export type AnimalBruto = {
  linha: number;
  tipoEntrada: string;
  dataEntrada: string | null;
  brinco: string | null;
  categoria: string;
  curral: string;
  loteOrigem: string | null;
  quantidade: number | null;
  pesoEntradaKg: number | null;
};

function toDateStrOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toStrOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}

function readRows(wb: XLSX.WorkBook, sheetName: string): unknown[][] | null {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][];
}

/** Lê as duas abas do modelo de importação (Pesagens, Cadastro_Animais). Cada uma é opcional. */
export function parsePlanilhaImportacao(buffer: Buffer): {
  pesagens: PesagemBruta[];
  animais: AnimalBruto[];
} {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const pesagensRows = readRows(wb, "Pesagens");
  const pesagens: PesagemBruta[] = (pesagensRows ?? [])
    .slice(4) // header está na linha 4 (índice 3); dados a partir da 5
    .map((r, i) => ({ linha: i + 5, r }))
    .filter(({ r }) => r.some((v) => v !== null && v !== ""))
    .map(({ linha, r }) => ({
      linha,
      data: toDateStrOrNull(r[1]),
      brinco: toStrOrNull(r[2]) ?? "",
      categoria: toStrOrNull(r[3]),
      curral: toStrOrNull(r[4]) ?? "",
      pesoKg: toNumOrNull(r[5]),
    }));

  const animaisRows = readRows(wb, "Cadastro_Animais");
  const animais: AnimalBruto[] = (animaisRows ?? [])
    .slice(5) // header na linha 5 (índice 4); dados a partir da 6
    .map((r, i) => ({ linha: i + 6, r }))
    .filter(({ r }) => r.some((v) => v !== null && v !== ""))
    .map(({ linha, r }) => ({
      linha,
      tipoEntrada: (toStrOrNull(r[1]) ?? "").toLowerCase(),
      dataEntrada: toDateStrOrNull(r[2]),
      brinco: toStrOrNull(r[3]),
      categoria: toStrOrNull(r[4]) ?? "",
      curral: toStrOrNull(r[5]) ?? "",
      loteOrigem: toStrOrNull(r[6]),
      quantidade: toNumOrNull(r[7]),
      pesoEntradaKg: toNumOrNull(r[8]),
    }));

  return { pesagens, animais };
}
