"use client";

import { useState } from "react";
import { atualizarCeCm } from "./actions";

export function CeCmForm({
  fazendaCodigo,
  animalId,
  ceCmAtual,
}: {
  fazendaCodigo: string;
  animalId: string;
  ceCmAtual: number | null;
}) {
  const [valor, setValor] = useState(ceCmAtual !== null ? String(ceCmAtual) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const numero = valor.trim() === "" ? null : Number(valor.replace(",", "."));
    if (numero !== null && Number.isNaN(numero)) {
      setErro("Valor inválido");
      setSalvando(false);
      return;
    }
    const res = await atualizarCeCm(fazendaCodigo, animalId, numero);
    if (!res.ok) setErro(res.erro ?? "Erro ao salvar");
    setSalvando(false);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="—"
        className="w-20 rounded-input border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span className="text-xs text-zinc-500">cm</span>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="rounded-btn bg-primary-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-primary-500"
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
      {erro && <span className="text-xs text-red-600 dark:text-red-400">{erro}</span>}
    </div>
  );
}
