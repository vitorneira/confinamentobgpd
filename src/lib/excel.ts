import * as XLSX from "xlsx";

export type AbaExcel = {
  nome: string;
  linhas: Record<string, string | number | null>[];
};

/** Gera um .xlsx (uma aba por item) a partir de linhas já formatadas para exibição. */
export function gerarExcel(abas: AbaExcel[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const aba of abas) {
    const ws = XLSX.utils.json_to_sheet(aba.linhas);
    XLSX.utils.book_append_sheet(wb, ws, aba.nome.slice(0, 31)); // limite de 31 caracteres do Excel pro nome da aba
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
