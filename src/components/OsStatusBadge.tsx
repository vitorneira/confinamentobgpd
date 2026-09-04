import type { OsStatus } from "@/lib/queries/ordens-servico";

// Handoff de design (Ordens de Serviço) — 8 estados, diferenciados por hue +
// preenchimento (tint = em andamento, sólido = concluído), não só por cor.
// Cores claras/escuras via CSS vars (globals.css); "comprada"/"conferida" são
// sólidas e usam valor fixo (pílula opaca, legível em qualquer tema).
const TINT: Record<Exclude<OsStatus, "comprada" | "conferida">, { fg: string; bg: string; borda: string }> = {
  aberta: { fg: "var(--os-neutro-fg)", bg: "var(--os-neutro-bg)", borda: "var(--os-neutro-borda)" },
  cotando: { fg: "var(--os-info-fg)", bg: "var(--os-info-bg)", borda: "var(--os-info-borda)" },
  aguardando_autorizacao: { fg: "var(--os-atencao-fg)", bg: "var(--os-atencao-bg)", borda: "var(--os-atencao-borda)" },
  aprovada: { fg: "var(--os-primario-tint-fg)", bg: "var(--os-primario-tint-bg)", borda: "var(--os-primario-tint-borda)" },
  entregue: { fg: "var(--os-sucesso-fg)", bg: "var(--os-sucesso-bg)", borda: "var(--os-sucesso-borda)" },
  cancelada: { fg: "var(--os-critico-fg)", bg: "var(--os-critico-bg)", borda: "var(--os-critico-borda)" },
};

const ROTULOS: Record<OsStatus, string> = {
  aberta: "aberta",
  cotando: "cotando",
  aguardando_autorizacao: "aguardando autorização",
  aprovada: "aprovada",
  comprada: "comprada",
  entregue: "entregue",
  conferida: "conferida",
  cancelada: "cancelada",
};

export function OsStatusBadge({ status, tamanho = "md" }: { status: OsStatus; tamanho?: "sm" | "md" }) {
  const padding = tamanho === "sm" ? "3px 9px" : "4px 11px";
  const fontSize = tamanho === "sm" ? "10.5px" : "11.5px";

  if (status === "comprada") {
    return (
      <span
        className="inline-flex whitespace-nowrap rounded-full font-bold"
        style={{ padding, fontSize, color: "#ffffff", background: "#B04227", border: "1px solid #B04227" }}
      >
        {ROTULOS[status]}
      </span>
    );
  }
  if (status === "conferida") {
    return (
      <span
        className="inline-flex whitespace-nowrap rounded-full font-bold"
        style={{ padding, fontSize, color: "#052e16", background: "#22C55E", border: "1px solid #22C55E" }}
      >
        {ROTULOS[status]}
      </span>
    );
  }

  const cores = TINT[status];
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full font-bold"
      style={{ padding, fontSize, color: cores.fg, background: cores.bg, border: `1px solid ${cores.borda}` }}
    >
      {ROTULOS[status]}
    </span>
  );
}
