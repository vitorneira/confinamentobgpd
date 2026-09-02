"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarPendenciaEstoquePasto, descartarPendenciaEstoquePasto } from "./actions";
import type { PendenciaEstoquePasto } from "@/lib/queries/pastos";
import { formatData, formatTempoRelativo } from "@/lib/format";

type Props = {
  fazendaCodigo: string;
  fazendaId: string;
  pendencias: PendenciaEstoquePasto[];
  pastoIdPorNome: Map<string, string>;
};

export function Conferencia({ fazendaCodigo, fazendaId, pendencias, pastoIdPorNome }: Props) {
  if (pendencias.length === 0) {
    return (
      <p className="rounded-card border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        Nada esperando conferência.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {pendencias.map((p) => (
        <CardPendencia key={p.id} fazendaCodigo={fazendaCodigo} fazendaId={fazendaId} pendencia={p} pastoIdPorNome={pastoIdPorNome} />
      ))}
    </div>
  );
}

function buscarPastoId(pastoIdPorNome: Map<string, string>, nome: string): string | null {
  if (pastoIdPorNome.has(nome)) return pastoIdPorNome.get(nome)!;
  const nomeLower = nome.trim().toLowerCase();
  for (const [k, v] of pastoIdPorNome) {
    if (k.trim().toLowerCase() === nomeLower) return v;
  }
  return null;
}

function CardPendencia({
  fazendaCodigo,
  fazendaId,
  pendencia,
  pastoIdPorNome,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  pendencia: PendenciaEstoquePasto;
  pastoIdPorNome: Map<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState(
    pendencia.itens.map((it) => ({ ...it, pastoId: buscarPastoId(pastoIdPorNome, it.pasto) })),
  );
  const [data, setData] = useState(pendencia.data);

  function atualizarItem(i: number, campo: "pasto" | "categoria" | "quantidade", valor: string) {
    setItens((prev) =>
      prev.map((item, idx) => {
        if (idx !== i) return item;
        if (campo === "quantidade") return { ...item, quantidade: Number(valor) || 0 };
        if (campo === "pasto") return { ...item, pasto: valor, pastoId: buscarPastoId(pastoIdPorNome, valor) };
        return { ...item, categoria: valor };
      }),
    );
  }

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarPendenciaEstoquePasto(fazendaCodigo, fazendaId, pendencia.id, data, itens);
      if (!r.ok) setErro(r.erro ?? "Erro ao confirmar.");
      else router.refresh();
    });
  }

  function descartar() {
    setErro(null);
    startTransition(async () => {
      const r = await descartarPendenciaEstoquePasto(pendencia.id);
      if (!r.ok) setErro(r.erro ?? "Erro ao descartar.");
      else router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {pendencia.remetente ?? "bot"} · {formatTempoRelativo(pendencia.criado_em)}
          {pendencia.fazenda_id === null && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              fazenda não identificada
            </span>
          )}
        </span>
        <label className="flex items-center gap-1.5">
          Data:
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-input border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <p className="mb-2 text-xs text-zinc-400">Confira contra a foto original antes de confirmar — a extração pode errar números.</p>

      <div className="overflow-x-auto rounded-input border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-2 py-2">Pasto</th>
              <th className="px-2 py-2">Categoria</th>
              <th className="px-2 py-2">Quantidade</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {itens.map((item, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5">
                  <input
                    value={item.pasto}
                    onChange={(e) => atualizarItem(i, "pasto", e.target.value)}
                    className="w-40 rounded-input border border-zinc-300 px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={item.categoria}
                    onChange={(e) => atualizarItem(i, "categoria", e.target.value)}
                    className="w-32 rounded-input border border-zinc-300 px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={item.quantidade}
                    onChange={(e) => atualizarItem(i, "quantidade", e.target.value)}
                    className="w-20 rounded-input border border-zinc-300 px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-2 py-1.5 text-xs">
                  {item.pastoId ? "pasto existente" : <span className="text-amber-700 dark:text-amber-400">pasto novo</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {erro && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{erro}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={confirmar}
          className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
        >
          {pending ? "Confirmando..." : "Confirmar estoque"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={descartar}
          className="rounded-btn px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Descartar
        </button>
      </div>
      <p className="mt-1 text-[10px] text-zinc-400">{formatData(data)}</p>
    </div>
  );
}
