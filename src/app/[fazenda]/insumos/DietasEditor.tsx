"use client";

import { useMemo, useState, useTransition } from "react";
import { salvarComposicaoDieta } from "./actions";
import { formatMoeda, formatPercentual } from "@/lib/format";
import type { DietaComComposicao } from "@/lib/queries/insumos";

type Linha = { ingredienteId: string; proporcao: number };

function EditorComposicao({
  fazendaCodigo,
  fazendaId,
  dietaId,
  nomeInicial,
  composicaoInicial,
  custoPorKg,
  todosIngredientes,
  bloqueiaNome,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  dietaId: string | null;
  nomeInicial: string;
  composicaoInicial: Linha[];
  custoPorKg: number | null;
  todosIngredientes: Array<{ id: string; nome: string }>;
  bloqueiaNome: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [nome, setNome] = useState(nomeInicial);
  const [linhas, setLinhas] = useState<Linha[]>(composicaoInicial);

  const nomePorId = useMemo(() => new Map(todosIngredientes.map((i) => [i.id, i.nome])), [todosIngredientes]);
  const soma = linhas.reduce((acc, l) => acc + l.proporcao, 0);
  const disponiveis = todosIngredientes.filter((i) => !linhas.some((l) => l.ingredienteId === i.id));

  function atualizarProporcao(ingredienteId: string, valor: number) {
    setLinhas((prev) => prev.map((l) => (l.ingredienteId === ingredienteId ? { ...l, proporcao: valor } : l)));
  }

  function removerLinha(ingredienteId: string) {
    setLinhas((prev) => prev.filter((l) => l.ingredienteId !== ingredienteId));
  }

  function adicionarLinha(ingredienteId: string) {
    if (!ingredienteId) return;
    setLinhas((prev) => [...prev, { ingredienteId, proporcao: 0 }]);
  }

  function handleSalvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      const r = await salvarComposicaoDieta(fazendaCodigo, fazendaId, { dietaId, nome, composicao: linhas });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao salvar.");
        return;
      }
      setSucesso(true);
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          disabled={bloqueiaNome}
          placeholder="Nome da dieta"
          className="rounded border border-zinc-300 px-2 py-1 text-sm font-medium disabled:border-transparent disabled:bg-transparent disabled:px-0 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {custoPorKg !== null && (
          <span className="text-xs text-zinc-500">custo de vitrine: {formatMoeda(custoPorKg, 4)}/kg</span>
        )}
      </div>

      <div className="space-y-1">
        {linhas.map((l) => (
          <div key={l.ingredienteId} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{nomePorId.get(l.ingredienteId) ?? "?"}</span>
            <input
              type="number"
              step="0.001"
              value={l.proporcao}
              onChange={(e) => atualizarProporcao(l.ingredienteId, Number(e.target.value))}
              className="w-24 rounded border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button type="button" onClick={() => removerLinha(l.ingredienteId)} className="text-xs text-red-600">
              remover
            </button>
          </div>
        ))}
      </div>

      {disponiveis.length > 0 && (
        <select
          onChange={(e) => {
            adicionarLinha(e.target.value);
            e.target.value = "";
          }}
          defaultValue=""
          className="mt-2 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">+ adicionar ingrediente...</option>
          {disponiveis.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
      )}

      <p className={`mt-2 text-sm ${Math.abs(soma - 1) > 0.005 ? "text-red-600" : "text-zinc-500"}`}>
        Soma: {formatPercentual(soma, 1)}
      </p>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700 dark:text-green-400">Salvo.</p>}
      <button
        type="button"
        onClick={handleSalvar}
        disabled={pending}
        className="mt-2 rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

export function DietasEditor({
  fazendaCodigo,
  fazendaId,
  dietas,
  todosIngredientes,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  dietas: DietaComComposicao[];
  todosIngredientes: Array<{ id: string; nome: string }>;
}) {
  const [mostrarNova, setMostrarNova] = useState(false);

  return (
    <div className="space-y-4">
      {dietas.map((d) => (
        <EditorComposicao
          key={d.id}
          fazendaCodigo={fazendaCodigo}
          fazendaId={fazendaId}
          dietaId={d.id}
          nomeInicial={d.nome}
          composicaoInicial={d.composicao.map((c) => ({ ingredienteId: c.ingredienteId, proporcao: c.proporcao }))}
          custoPorKg={d.custoPorKg}
          todosIngredientes={todosIngredientes}
          bloqueiaNome
        />
      ))}

      {mostrarNova ? (
        <EditorComposicao
          fazendaCodigo={fazendaCodigo}
          fazendaId={fazendaId}
          dietaId={null}
          nomeInicial=""
          composicaoInicial={[]}
          custoPorKg={null}
          todosIngredientes={todosIngredientes}
          bloqueiaNome={false}
        />
      ) : (
        <button
          type="button"
          onClick={() => setMostrarNova(true)}
          className="rounded border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
        >
          + criar nova dieta
        </button>
      )}
    </div>
  );
}
