"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarPrestador, editarPrestador, removerPrestador } from "./actions";
import type { Prestador } from "@/lib/queries/mestres";

const campoClasse = "w-full rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const rotuloClasse = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

type CamposForm = { nome: string; telefone: string; chavePagamento: string; observacao: string; ativo: boolean };

function FormularioPrestador({
  inicial,
  aoSalvar,
  aoCancelar,
  rotuloBotao,
  mostrarAtivo,
}: {
  inicial?: Prestador;
  aoSalvar: (campos: CamposForm) => void;
  aoCancelar?: () => void;
  rotuloBotao: string;
  mostrarAtivo: boolean;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [telefone, setTelefone] = useState(inicial?.telefone ?? "");
  const [chavePagamento, setChavePagamento] = useState(inicial?.chave_pagamento ?? "");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={rotuloClasse}>Nome *</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={campoClasse} />
        </div>
        <div>
          <label className={rotuloClasse}>Telefone</label>
          <input type="text" value={telefone} onChange={(e) => setTelefone(e.target.value)} className={campoClasse} />
        </div>
        <div>
          <label className={rotuloClasse}>Chave de pagamento (PIX)</label>
          <input type="text" value={chavePagamento} onChange={(e) => setChavePagamento(e.target.value)} className={campoClasse} />
        </div>
        <div className="sm:col-span-2">
          <label className={rotuloClasse}>Observação</label>
          <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campoClasse} />
        </div>
      </div>
      {mostrarAtivo && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-3.5 w-3.5" />
          Ativo (aparece nas seleções de OS)
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => aoSalvar({ nome, telefone, chavePagamento, observacao, ativo })}
          className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700"
        >
          {rotuloBotao}
        </button>
        {aoCancelar && (
          <button
            type="button"
            onClick={aoCancelar}
            className="rounded-btn border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

export function PrestadoresPainel({ prestadores }: { prestadores: Prestador[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);

  function salvarNovo(campos: CamposForm) {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarPrestador({
        nome: campos.nome,
        telefone: campos.telefone || null,
        chavePagamento: campos.chavePagamento || null,
        observacao: campos.observacao || null,
      });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível criar.");
      else {
        setMostrarNovo(false);
        router.refresh();
      }
    });
  }

  function salvarEdicao(id: string, campos: CamposForm) {
    setErro(null);
    startTransition(async () => {
      const resultado = await editarPrestador(id, {
        nome: campos.nome,
        telefone: campos.telefone || null,
        chavePagamento: campos.chavePagamento || null,
        observacao: campos.observacao || null,
        ativo: campos.ativo,
      });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível salvar.");
      else {
        setEditandoId(null);
        router.refresh();
      }
    });
  }

  function remover(id: string) {
    if (!confirm("Remover este prestador? OS já ligadas a ele ficam sem prestador.")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await removerPrestador(id);
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível remover.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      {mostrarNovo ? (
        <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Novo prestador</h2>
          <FormularioPrestador
            aoSalvar={salvarNovo}
            aoCancelar={() => setMostrarNovo(false)}
            rotuloBotao={pending ? "Salvando..." : "Criar"}
            mostrarAtivo={false}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarNovo(true)}
          className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          + Novo prestador
        </button>
      )}

      {prestadores.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum prestador cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {prestadores.map((p) =>
            editandoId === p.id ? (
              <div key={p.id} className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <FormularioPrestador
                  inicial={p}
                  aoSalvar={(campos) => salvarEdicao(p.id, campos)}
                  aoCancelar={() => setEditandoId(null)}
                  rotuloBotao={pending ? "Salvando..." : "Salvar"}
                  mostrarAtivo
                />
              </div>
            ) : (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-card border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <p className="font-semibold text-black dark:text-zinc-50">
                    {p.nome}
                    {!p.ativo && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {p.telefone || "sem telefone"}
                    {p.chave_pagamento && ` · PIX: ${p.chave_pagamento}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditandoId(p.id)}
                    className="rounded-btn border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remover(p.id)}
                    className="rounded-btn px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
