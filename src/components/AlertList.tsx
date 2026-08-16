import Link from "next/link";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import type { Alerta } from "@/lib/kpi/alertas";

const ICONE: Record<Alerta["severidade"], typeof AlertTriangle> = { atencao: AlertTriangle, critico: OctagonAlert };
const COR: Record<Alerta["severidade"], string> = {
  atencao: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  critico: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
};

export function AlertList({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return (
      <p className="rounded-card border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
        Nenhum alerta no momento.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {alertas.map((a, i) => {
        const Icone = ICONE[a.severidade];
        const conteudo = (
          <div className={`flex items-center gap-3 rounded-card border px-4 py-3 text-sm ${COR[a.severidade]}`}>
            <Icone size={16} className="shrink-0" aria-hidden />
            <span className="flex-1">{a.mensagem}</span>
            {a.href && <span className="text-xs underline">ver</span>}
          </div>
        );
        return (
          <li key={i}>{a.href ? <Link href={a.href}>{conteudo}</Link> : conteudo}</li>
        );
      })}
    </ul>
  );
}
