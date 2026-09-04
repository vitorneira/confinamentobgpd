"use client";

import { useState, useTransition } from "react";
import { definirVigencia } from "./actions";
import { formatData } from "@/lib/format";
import type { CurralComVigencias } from "@/lib/queries/insumos";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function LinhaCurral({
  fazendaCodigo,
  curral,
  dietas,
}: {
  fazendaCodigo: string;
  curral: CurralComVigencias;
  dietas: Array<{ id: string; nome: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [dietaId, setDietaId] = useState(dietas[0]?.id ?? "");
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function handleSalvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      const r = await definirVigencia(fazendaCodigo, { curralId: curral.curralId, dietaId, dataInicio });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao salvar.");
        return;
      }
      setSucesso(true);
      setAberto(false);
    });
  }

  return (
    <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-black dark:text-zinc-50">Curral {curral.curralCodigo}</p>
          <p className="text-xs text-zinc-500">Dieta atual: {curral.dietaAtualNome ?? "—"}</p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="text-sm text-zinc-500 underline"
        >
          {aberto ? "cancelar" : "trocar dieta"}
        </button>
      </div>

      {curral.historico.length > 0 && (
        <ul className="mt-2 text-xs text-zinc-500">
          {curral.historico.map((h, i) => (
            <li key={i}>
              {h.dietaNome} — desde {formatData(h.dataInicio)}
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Nova dieta</span>
            <select
              value={dietaId}
              onChange={(e) => setDietaId(e.target.value)}
              className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {dietas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">A partir de</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={pending}
            className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
          >
            {pending ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      )}
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="mt-2 text-sm text-green-700 dark:text-green-400">Vigência registrada.</p>}
    </div>
  );
}

export function VigenciaForm({
  fazendaCodigo,
  currais,
  dietas,
}: {
  fazendaCodigo: string;
  currais: CurralComVigencias[];
  dietas: Array<{ id: string; nome: string }>;
}) {
  return (
    <div className="space-y-3">
      {currais.map((c) => (
        <LinhaCurral key={c.curralId} fazendaCodigo={fazendaCodigo} curral={c} dietas={dietas} />
      ))}
    </div>
  );
}
