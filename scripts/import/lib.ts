import path from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no .env.local",
  );
}

export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export const DADOS_DIR = path.join(process.cwd(), "dados_originais");

export function loadWorkbook(fileName: string): XLSX.WorkBook {
  return XLSX.readFile(path.join(DADOS_DIR, fileName), { cellDates: true });
}

function rawRows(wb: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Aba "${sheetName}" não encontrada`);
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];
}

/** Lê uma aba como objetos, usando a linha `headerRowIdx` (0-based) como cabeçalho. */
export function readSheetAsObjects(
  wb: XLSX.WorkBook,
  sheetName: string,
  headerRowIdx: number,
): Record<string, unknown>[] {
  const rows = rawRows(wb, sheetName);
  const headers = rows[headerRowIdx].map((h) => (h === null ? "" : String(h).trim()));
  const dataRows = rows
    .slice(headerRowIdx + 1)
    .filter((r) => r.some((v) => v !== null && v !== ""));
  return dataRows.map((r) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = r[i] ?? null;
    });
    return obj;
  });
}

export function toDateStr(v: unknown): string {
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: ${String(v)}`);
  return d.toISOString().slice(0, 10);
}

export function toStr(v: unknown): string {
  return String(v).trim();
}

export function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) throw new Error(`Número inválido: ${String(v)}`);
  return n;
}

export function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  return toNum(v);
}

/** Insere em lotes (evita payloads gigantes) e retorna todas as linhas inseridas. */
export async function insertAll<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  chunkSize = 500,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase
      .from(table)
      .insert(chunk as never)
      .select();
    if (error) throw new Error(`Erro inserindo em "${table}": ${error.message}`);
    results.push(...(data ?? []));
  }
  return results;
}

export function mapBy<T extends Record<string, unknown>>(
  rows: T[],
  key: string,
): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const r of rows) m.set(toStr(r[key]), r);
  return m;
}
