// Cores semânticas fixas do sistema (CLAUDE.md): verde=ok, amarelo/laranja=atenção,
// vermelho=crítico. Nunca reutilizar essas cores para outra coisa.
const ESTILOS: Record<string, string> = {
  ok: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  atencao: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  critico: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

const LABELS: Record<string, string> = {
  ok: "Ok",
  atencao: "Atenção",
  critico: "Crítico",
};

export function StatusBadge({ status }: { status: "ok" | "atencao" | "critico" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTILOS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
