"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lancarEstoquePastoManual, criarPasto } from "./actions";

export function LancamentoManual({
  fazendaCodigo,
  fazendaId,
  pastos,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  pastos: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [pastoId, setPastoId] = useState(pastos[0]?.id ?? "");
  const [pastoNovoNome, setPastoNovoNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  function submeter() {
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      let idFinal = pastoId;
      if (pastoId === "__novo__") {
        if (!pastoNovoNome.trim()) {
          setErro("Digite o nome do pasto novo.");
          return;
        }
        const rCriar = await criarPasto(fazendaCodigo, fazendaId, { nome: pastoNovoNome, hectares: null });
        if (!rCriar.ok || !rCriar.pastoId) {
          setErro(rCriar.erro ?? "Erro ao criar pasto.");
          return;
        }
        idFinal = rCriar.pastoId;
        router.refresh();
      }

      const r = await lancarEstoquePastoManual(fazendaCodigo, fazendaId, {
        pastoId: idFinal,
        categoria,
        quantidade,
        data,
      });
      if (!r.ok) setErro(r.erro ?? "Erro ao lançar.");
      else {
        setSucesso("Lançado com sucesso.");
        setCategoria("");
        setQuantidade(0);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Pasto</span>
        <select
          value={pastoId}
          onChange={(e) => setPastoId(e.target.value)}
          className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {pastos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
          <option value="__novo__">+ novo pasto...</option>
        </select>
      </label>
      {pastoId === "__novo__" && (
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Nome do pasto novo</span>
          <input
            value={pastoNovoNome}
            onChange={(e) => setPastoNovoNome(e.target.value)}
            className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      )}
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Categoria</span>
        <input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="ex.: Vaca, Touro..."
          className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Quantidade</span>
        <input
          type="number"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          className="w-24 rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Data</span>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={submeter}
        className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
      >
        {pending ? "Salvando..." : "Lançar"}
      </button>
      {erro && <p className="w-full text-xs text-red-600 dark:text-red-400">{erro}</p>}
      {sucesso && <p className="w-full text-xs text-green-700 dark:text-green-400">{sucesso}</p>}
    </div>
  );
}
