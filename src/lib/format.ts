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

/** Pra timestamptz (ISO com hora), não confundir com formatData (date puro). */
export function formatDataHora(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** "há 4 min" / "há 3 dias" — usado na Triagem e na Timeline da OS. */
export function formatTempoRelativo(v: string | null | undefined): string {
  if (!v) return "—";
  const diffMs = Date.now() - new Date(v).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} dia${dias > 1 ? "s" : ""}`;
}

/**
 * Ordenação natural de códigos (curral, etc.): compara trecho numérico como
 * número (1 < 2 < 10) e trecho não-numérico alfabeticamente, segmento a
 * segmento — cobre casos como "2","3","4","4-TN","5" e "1".."10".
 */
export function compararCodigo(a: string, b: string): number {
  const partsA = a.match(/(\d+|\D+)/g) ?? [a];
  const partsB = b.match(/(\d+|\D+)/g) ?? [b];
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pa = partsA[i] ?? "";
    const pb = partsB[i] ?? "";
    if (pa === pb) continue;
    const na = Number(pa);
    const nb = Number(pb);
    if (pa !== "" && pb !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na !== nb) return na - nb;
      continue;
    }
    return pa.localeCompare(pb, "pt-BR");
  }
  return 0;
}
