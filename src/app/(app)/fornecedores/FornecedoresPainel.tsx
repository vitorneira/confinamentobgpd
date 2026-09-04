"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarFornecedor, editarFornecedor, removerFornecedor } from "./actions";
import { DOMINIOS, ROTULO_DOMINIO, type Dominio } from "@/lib/orquestrador/tipos";
import type { Fornecedor } from "@/lib/queries/mestres";

const campoClasse = "w-full rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const rotuloClasse = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

function CategoriasCheckbox({
  selecionadas,
  onChange,
}: {
  selecionadas: Dominio[];
  onChange: (v: Dominio[]) => void;
}) {
  function alternar(d: Dominio) {
    onChange(selecionadas.includes(d) ? selecionadas.filter((x) => x !== d) : [...selecionadas, d]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {DOMINIOS.map((d) => (
        <label
          key={d}
          className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
            selecionadas.includes(d)
              ? "border-primary-500 bg-primary-500 text-white"
              : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          }`}
        >
          <input type="checkbox" checked={selecionadas.includes(d)} onChange={() => alternar(d)} className="hidden" />
          {ROTULO_DOMINIO[d]}
        </label>
      ))}
    </div>
  );
}

function FormularioFornecedor({
  inicial,
  aoSalvar,
  aoCancelar,
  rotuloBotao,
}: {
  inicial?: Fornecedor;
  aoSalvar: (campos: { nome: string; whatsapp: string; categorias: Dominio[] }) => void;
  aoCancelar?: () => void;
  rotuloBotao: string;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [whatsapp, setWhatsapp] = useState(inicial?.whatsapp ?? "");
  const [categorias, setCategorias] = useState<Dominio[]>(inicial?.categorias ?? []);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={rotuloClasse}>Nome *</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={campoClasse} />
        </div>
        <div>
          <label className={rotuloClasse}>WhatsApp</label>
          <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={campoClasse} />
        </div>
      </div>
      <div>
        <label className={rotuloClasse}>Categorias</label>
        <CategoriasCheckbox selecionadas={categorias} onChange={setCategorias} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => aoSalvar({ nome, whatsapp, categorias })}
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

export function FornecedoresPainel({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);

  function salvarNovo(campos: { nome: string; whatsapp: string; categorias: Dominio[] }) {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarFornecedor({ nome: campos.nome, whatsapp: campos.whatsapp || null, categorias: campos.categorias });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível criar.");
      else {
        setMostrarNovo(false);
        router.refresh();
      }
    });
  }

  function salvarEdicao(id: string, campos: { nome: string; whatsapp: string; categorias: Dominio[] }) {
    setErro(null);
    startTransition(async () => {
      const resultado = await editarFornecedor(id, { nome: campos.nome, whatsapp: campos.whatsapp || null, categorias: campos.categorias });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível salvar.");
      else {
        setEditandoId(null);
        router.refresh();
      }
    });
  }

  function remover(id: string) {
    if (!confirm("Remover este fornecedor? OS já ligadas a ele ficam sem fornecedor.")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await removerFornecedor(id);
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível remover.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      {mostrarNovo ? (
        <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Novo fornecedor</h2>
          <FormularioFornecedor aoSalvar={salvarNovo} aoCancelar={() => setMostrarNovo(false)} rotuloBotao={pending ? "Salvando..." : "Criar"} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarNovo(true)}
          className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          + Novo fornecedor
        </button>
      )}

      {fornecedores.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum fornecedor cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {fornecedores.map((f) =>
            editandoId === f.id ? (
              <div key={f.id} className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <FormularioFornecedor
                  inicial={f}
                  aoSalvar={(campos) => salvarEdicao(f.id, campos)}
                  aoCancelar={() => setEditandoId(null)}
                  rotuloBotao={pending ? "Salvando..." : "Salvar"}
                />
              </div>
            ) : (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-card border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <p className="font-semibold text-black dark:text-zinc-50">{f.nome}</p>
                  <p className="text-xs text-zinc-500">
                    {f.whatsapp || "sem whatsapp"}
                    {f.categorias.length > 0 && ` · ${f.categorias.map((c) => ROTULO_DOMINIO[c]).join(", ")}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditandoId(f.id)}
                    className="rounded-btn border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remover(f.id)}
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
