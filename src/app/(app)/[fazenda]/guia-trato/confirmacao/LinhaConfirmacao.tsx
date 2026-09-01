"use client";

import { useState, useTransition } from "react";
import { confirmarTratoCurral } from "../actions";
import { formatData, formatNumero } from "@/lib/format";
import type { ItemConfirmacao } from "@/lib/queries/guia-trato";

export function LinhaConfirmacao({
  fazendaCodigo,
  fazendaId,
  item,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  item: ItemConfirmacao;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(item.confirmado);
  const [editando, setEditando] = useState(false);
  const [kg, setKg] = useState(String((item.kgConfirmado ?? item.kgPlanejado).toFixed(1)));

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarTratoCurral(fazendaCodigo, fazendaId, {
        curralId: item.curralId,
        data: item.data,
        totalKg: Number(kg),
      });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao confirmar.");
        return;
      }
      setConfirmado(true);
      setEditando(false);
    });
  }

  return (
    <tr className="bg-white dark:bg-zinc-950">
      <td className="px-3 py-2">{formatData(item.data)}</td>
      <td className="px-3 py-2 font-medium">{item.curralCodigo}</td>
      <td className="px-3 py-2 text-zinc-500">{item.dietaNome ?? "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatNumero(item.kgPlanejado, 1)}</td>
      <td className="px-3 py-2 text-right">
        {editando ? (
          <input
            type="number"
            step="0.1"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            className="w-24 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
          />
        ) : (
          <span className="tabular-nums">{formatNumero(Number(kg), 1)}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            confirmado
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
          }`}
        >
          {confirmado ? "Confirmado" : "Pendente"}
        </span>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {!editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="mr-2 text-xs text-zinc-500 underline"
          >
            editar
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={confirmar}
          className="rounded-btn bg-primary-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
        >
          {pending ? "..." : confirmado ? "Reconfirmar" : "Confirmar"}
        </button>
        {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      </td>
    </tr>
  );
}
