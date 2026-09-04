"use client";

import { useState, useTransition } from "react";
import { mudarStatusOs } from "../actions";
import { OsStatusBadge } from "@/components/OsStatusBadge";
import type { OsStatus } from "@/lib/queries/ordens-servico";

const OPCOES: { valor: OsStatus; rotulo: string }[] = [
  { valor: "aberta", rotulo: "aberta" },
  { valor: "cotando", rotulo: "cotando" },
  { valor: "aguardando_autorizacao", rotulo: "aguardando autorização" },
  { valor: "aprovada", rotulo: "aprovada" },
  { valor: "comprada", rotulo: "comprada" },
  { valor: "entregue", rotulo: "entregue" },
  { valor: "conferida", rotulo: "conferida" },
  { valor: "cancelada", rotulo: "cancelada" },
];

export function StatusChanger({ osId, statusAtual }: { osId: string; statusAtual: OsStatus }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<OsStatus>(statusAtual);

  function salvar(novoStatus: OsStatus) {
    setErro(null);
    startTransition(async () => {
      const resultado = await mudarStatusOs(osId, novoStatus);
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível mudar o status.");
      else setSelecionado(novoStatus);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {statusAtual !== "cancelada" && statusAtual !== "conferida" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => salvar("cancelada")}
            className="rounded-btn border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancelar OS
          </button>
        )}
        <select
          value={selecionado}
          disabled={pending}
          onChange={(e) => salvar(e.target.value as OsStatus)}
          className="rounded-input border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {OPCOES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <OsStatusBadge status={selecionado} />
      </div>
      {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  );
}
