"use client";

import { useState, useTransition } from "react";
import { registrarCompra } from "./actions";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CompraForm({
  fazendaCodigo,
  fazendaId,
  ingredientes,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  ingredientes: Array<{ id: string; nome: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [ingredienteId, setIngredienteId] = useState(ingredientes[0]?.id ?? "");
  const [preco, setPreco] = useState("");
  const [qtd, setQtd] = useState("");
  const [fornecedor, setFornecedor] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      const r = await registrarCompra(fazendaCodigo, fazendaId, {
        data,
        ingredienteId,
        precoKg: Number(preco),
        qtdKg: qtd ? Number(qtd) : null,
        fornecedor: fornecedor || null,
      });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao registrar.");
        return;
      }
      setSucesso(true);
      setPreco("");
      setQtd("");
      setFornecedor("");
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
        <span className="mb-1 block text-zinc-500">Insumo</span>
        <select
          value={ingredienteId}
          onChange={(e) => setIngredienteId(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {ingredientes.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Preço (R$/kg)</span>
        <input
          type="number"
          step="0.01"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          required
          className="w-28 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Qtd (kg)</span>
        <input
          type="number"
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          className="w-28 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Fornecedor</span>
        <input
          type="text"
          value={fornecedor}
          onChange={(e) => setFornecedor(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Registrando..." : "Registrar compra"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="w-full text-sm text-green-700 dark:text-green-400">Compra registrada.</p>}
    </form>
  );
}
