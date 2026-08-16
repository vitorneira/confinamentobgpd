"use client";

import { useState, useTransition } from "react";
import { lancarPesagemManual } from "./actions";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LancamentoManual({
  fazendaCodigo,
  fazendaId,
  currais,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  currais: Array<{ id: string; codigo: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [curralCodigo, setCurralCodigo] = useState(currais[0]?.codigo ?? "");
  const [brinco, setBrinco] = useState("");
  const [peso, setPeso] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      const r = await lancarPesagemManual(fazendaCodigo, fazendaId, {
        data,
        curralCodigo,
        brinco,
        pesoKg: Number(peso),
      });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao lançar.");
        return;
      }
      setSucesso(true);
      setBrinco("");
      setPeso("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Data</span>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Curral</span>
        <select
          value={curralCodigo}
          onChange={(e) => setCurralCodigo(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {currais.map((c) => (
            <option key={c.id} value={c.codigo}>
              {c.codigo}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Brinco</span>
        <input
          type="text"
          value={brinco}
          onChange={(e) => setBrinco(e.target.value)}
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Peso (kg)</span>
        <input
          type="number"
          step="0.1"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          required
          className="w-28 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Lançando..." : "Lançar"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="w-full text-sm text-green-700 dark:text-green-400">Pesagem lançada.</p>}
    </form>
  );
}
