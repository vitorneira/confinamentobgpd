export function formatNumero(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatMoeda(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas });
}

export function formatPercentual(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%";
}

export function corResultado(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "text-zinc-500";
  return v >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

export function formatData(v: string | null | undefined): string {
  if (!v) return "—";
  const [ano, mes, dia] = v.split("-");
  return `${dia}/${mes}/${ano}`;
}
