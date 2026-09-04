"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editarOs } from "../actions";

export function VinculosForm({
  osId,
  fornecedorId,
  prestadorId,
  descontarDoPrestador,
  fornecedores,
  prestadores,
}: {
  osId: string;
  fornecedorId: string | null;
  prestadorId: string | null;
  descontarDoPrestador: boolean;
  fornecedores: { id: string; nome: string }[];
  prestadores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [fId, setFId] = useState(fornecedorId ?? "");
  const [pId, setPId] = useState(prestadorId ?? "");
  const [desconto, setDesconto] = useState(descontarDoPrestador);

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await editarOs(osId, {
        fornecedorId: fId || null,
        prestadorId: pId || null,
        descontarDoPrestador: desconto,
      });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível salvar.");
      else router.refresh();
    });
  }

  const campoClasse = "w-full rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
  const rotuloClasse = "mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-zinc-500";

  return (
    <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Fornecedor &amp; prestador</h2>
      <div className="mb-2 grid grid-cols-2 gap-3">
        <div>
          <label className={rotuloClasse}>Fornecedor</label>
          <select value={fId} onChange={(e) => setFId(e.target.value)} className={campoClasse}>
            <option value="">—</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotuloClasse}>Prestador de serviço</label>
          <select value={pId} onChange={(e) => setPId(e.target.value)} className={campoClasse}>
            <option value="">—</option>
            {prestadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="mb-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={desconto}
          onChange={(e) => setDesconto(e.target.checked)}
          disabled={!pId}
          className="h-3.5 w-3.5"
        />
        Descontar do pagamento do prestador
      </label>
      {erro && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{erro}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={salvar}
        className="rounded-btn border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
