"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarFuncionario } from "./actions";
import type { Funcionario } from "@/lib/queries/funcionarios";

type Fazenda = { id: string; codigo: string; nome: string };

const campoClasse = "w-full rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const rotuloClasse = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

function FormularioNovoFuncionario({
  fazendas,
  aoSalvar,
  aoCancelar,
  pending,
}: {
  fazendas: Fazenda[];
  aoSalvar: (campos: {
    fazendaId: string;
    nomeCompleto: string;
    apelido: string;
    tipo: "fixo" | "diarista";
    cargo: string;
    dataAdmissao: string;
  }) => void;
  aoCancelar: () => void;
  pending: boolean;
}) {
  const [fazendaId, setFazendaId] = useState(fazendas[0]?.id ?? "");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [apelido, setApelido] = useState("");
  const [tipo, setTipo] = useState<"fixo" | "diarista">("fixo");
  const [cargo, setCargo] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");

  return (
    <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Novo funcionário</h2>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={rotuloClasse}>Nome completo * (como aparece no holerite)</label>
            <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className={campoClasse} />
          </div>
          <div>
            <label className={rotuloClasse}>Apelido / nome usual</label>
            <input type="text" value={apelido} onChange={(e) => setApelido(e.target.value)} className={campoClasse} />
          </div>
          <div>
            <label className={rotuloClasse}>Fazenda *</label>
            <select value={fazendaId} onChange={(e) => setFazendaId(e.target.value)} className={campoClasse}>
              {fazendas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codigo} — {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotuloClasse}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "fixo" | "diarista")} className={campoClasse}>
              <option value="fixo">Funcionário fixo</option>
              <option value="diarista">Diarista</option>
            </select>
          </div>
          <div>
            <label className={rotuloClasse}>Cargo</label>
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} className={campoClasse} />
          </div>
          <div>
            <label className={rotuloClasse}>Data de admissão</label>
            <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className={campoClasse} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => aoSalvar({ fazendaId, nomeCompleto, apelido, tipo, cargo, dataAdmissao })}
            className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700"
          >
            {pending ? "Salvando..." : "Criar"}
          </button>
          <button
            type="button"
            onClick={aoCancelar}
            className="rounded-btn border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export function FuncionariosPainel({ funcionarios, fazendas }: { funcionarios: Funcionario[]; fazendas: Fazenda[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroFazenda, setFiltroFazenda] = useState<string>("todas");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return funcionarios.filter((f) => {
      const bateFazenda = filtroFazenda === "todas" || f.fazenda_codigo === filtroFazenda;
      const bateBusca =
        !termo || f.nome_completo.toLowerCase().includes(termo) || (f.apelido ?? "").toLowerCase().includes(termo);
      return bateFazenda && bateBusca;
    });
  }, [funcionarios, busca, filtroFazenda]);

  const codigosFazenda = useMemo(() => Array.from(new Set(fazendas.map((f) => f.codigo))), [fazendas]);

  function salvarNovo(campos: {
    fazendaId: string;
    nomeCompleto: string;
    apelido: string;
    tipo: "fixo" | "diarista";
    cargo: string;
    dataAdmissao: string;
  }) {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarFuncionario({
        fazendaId: campos.fazendaId,
        nomeCompleto: campos.nomeCompleto,
        apelido: campos.apelido || null,
        tipo: campos.tipo,
        cargo: campos.cargo || null,
        dataAdmissao: campos.dataAdmissao || null,
      });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível criar.");
      else {
        setMostrarNovo(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      {mostrarNovo ? (
        <FormularioNovoFuncionario fazendas={fazendas} aoSalvar={salvarNovo} aoCancelar={() => setMostrarNovo(false)} pending={pending} />
      ) : (
        <button
          type="button"
          onClick={() => setMostrarNovo(true)}
          className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          + Novo funcionário
        </button>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`${campoClasse} sm:max-w-xs`}
        />
        <select value={filtroFazenda} onChange={(e) => setFiltroFazenda(e.target.value)} className={`${campoClasse} sm:max-w-[10rem]`}>
          <option value="todas">Todas as fazendas</option>
          {codigosFazenda.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum funcionário encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((f) => (
            <Link
              key={f.id}
              href={`/funcionarios/${f.id}`}
              className="flex items-center justify-between gap-3 rounded-card border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              <div>
                <p className="font-semibold text-black dark:text-zinc-50">
                  {f.apelido || f.nome_completo}
                  {!f.ativo && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                      inativo
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {f.fazenda_codigo} · {f.tipo === "diarista" ? "Diarista" : "Funcionário fixo"}
                  {f.cargo && ` · ${f.cargo}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
