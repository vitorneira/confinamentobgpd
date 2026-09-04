"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cadastrarEVincularPendencia, descartarPendencia, getUrlPendencia, vincularPendencia } from "./actions";
import type { Funcionario, MotivoPendencia, PendenciaDocumento, TipoDocumento } from "@/lib/queries/funcionarios";
import { formatTempoRelativo } from "@/lib/format";

type Fazenda = { id: string; codigo: string; nome: string };

const campoClasse = "w-full rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const rotuloClasse = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

const ROTULO_TIPO_DOC: Record<TipoDocumento, string> = {
  holerite: "Holerite",
  recibo: "Recibo",
  comprovante: "Comprovante",
};

const ROTULO_MOTIVO: Record<MotivoPendencia, string> = {
  nome_nao_encontrado: "Nome não encontrado no cadastro",
  nome_ambiguo: "Nome bate com mais de um funcionário",
  competencia_nao_lida: "Competência não identificada",
};

function competenciaParaInputMonth(competencia: string | null): string {
  if (!competencia) return "";
  return competencia.slice(0, 7);
}

function CartaoPendencia({
  pendencia,
  funcionarios,
  fazendas,
}: {
  pendencia: PendenciaDocumento;
  funcionarios: Funcionario[];
  fazendas: Fazenda[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<"vincular" | "novo">("vincular");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [competencia, setCompetencia] = useState(competenciaParaInputMonth(pendencia.competencia_extraida));

  const [novoNome, setNovoNome] = useState(pendencia.nome_extraido ?? "");
  const [novoApelido, setNovoApelido] = useState("");
  const [novaFazendaId, setNovaFazendaId] = useState(
    fazendas.find((f) => f.codigo === pendencia.fazenda_sugerida)?.id ?? fazendas[0]?.id ?? "",
  );
  const [novoTipo, setNovoTipo] = useState<"fixo" | "diarista">("fixo");
  const [novoCargo, setNovoCargo] = useState("");
  const [novaDataAdmissao, setNovaDataAdmissao] = useState("");

  async function abrirDocumento() {
    setAbrindo(true);
    const url = await getUrlPendencia(pendencia.storage_path_individual);
    setAbrindo(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setErro("Não foi possível abrir o documento.");
  }

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const resultado =
        modo === "vincular"
          ? await vincularPendencia(pendencia.id, funcionarioId, competencia)
          : await cadastrarEVincularPendencia(
              pendencia.id,
              {
                fazendaId: novaFazendaId,
                nomeCompleto: novoNome,
                apelido: novoApelido || null,
                tipo: novoTipo,
                cargo: novoCargo || null,
                dataAdmissao: novaDataAdmissao || null,
              },
              competencia,
            );
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível vincular.");
      else router.refresh();
    });
  }

  function descartar() {
    if (!confirm("Descartar esta pendência? O documento não vira registro de nenhum funcionário.")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await descartarPendencia(pendencia.id);
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível descartar.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-black dark:text-zinc-50">
            {ROTULO_TIPO_DOC[pendencia.tipo]} · &quot;{pendencia.nome_extraido || "nome não lido"}&quot;
            {pendencia.fazenda_sugerida && <span className="ml-2 text-xs font-normal text-zinc-500">({pendencia.fazenda_sugerida})</span>}
          </p>
          <p className="text-xs text-zinc-500">
            {ROTULO_MOTIVO[pendencia.motivo]} · recebido {formatTempoRelativo(pendencia.criado_em)}
          </p>
        </div>
        <button
          type="button"
          onClick={abrirDocumento}
          disabled={abrindo}
          className="shrink-0 rounded-btn border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {abrindo ? "Abrindo..." : "Ver documento"}
        </button>
      </div>

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setModo("vincular")}
          className={`rounded-btn px-3 py-1.5 font-semibold ${modo === "vincular" ? "bg-primary-500 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}
        >
          Vincular a funcionário existente
        </button>
        <button
          type="button"
          onClick={() => setModo("novo")}
          className={`rounded-btn px-3 py-1.5 font-semibold ${modo === "novo" ? "bg-primary-500 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}
        >
          Cadastrar novo funcionário
        </button>
      </div>

      {modo === "vincular" ? (
        <div>
          <label className={rotuloClasse}>Funcionário</label>
          <select value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} className={campoClasse}>
            <option value="">Selecione...</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome_completo} {f.apelido ? `(${f.apelido})` : ""} — {f.fazenda_codigo}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={rotuloClasse}>Nome completo *</label>
            <input type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className={campoClasse} />
          </div>
          <div>
            <label className={rotuloClasse}>Apelido / nome usual</label>
            <input type="text" value={novoApelido} onChange={(e) => setNovoApelido(e.target.value)} className={campoClasse} />
          </div>
          <div>
            <label className={rotuloClasse}>Fazenda *</label>
            <select value={novaFazendaId} onChange={(e) => setNovaFazendaId(e.target.value)} className={campoClasse}>
              {fazendas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codigo} — {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotuloClasse}>Tipo</label>
            <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as "fixo" | "diarista")} className={campoClasse}>
              <option value="fixo">Funcionário fixo</option>
              <option value="diarista">Diarista</option>
            </select>
          </div>
          <div>
            <label className={rotuloClasse}>Cargo</label>
            <input type="text" value={novoCargo} onChange={(e) => setNovoCargo(e.target.value)} className={campoClasse} />
          </div>
          <div>
            <label className={rotuloClasse}>Data de admissão</label>
            <input type="date" value={novaDataAdmissao} onChange={(e) => setNovaDataAdmissao(e.target.value)} className={campoClasse} />
          </div>
        </div>
      )}

      <div>
        <label className={rotuloClasse}>Competência (mês/ano) *</label>
        <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={`${campoClasse} sm:max-w-[10rem]`} />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={pending}
          className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Vincular"}
        </button>
        <button
          type="button"
          onClick={descartar}
          disabled={pending}
          className="rounded-btn px-3 py-2 text-sm font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

export function PendenciasPainel({
  pendencias,
  funcionarios,
  fazendas,
}: {
  pendencias: PendenciaDocumento[];
  funcionarios: Funcionario[];
  fazendas: Fazenda[];
}) {
  if (pendencias.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhuma pendência — tudo que chegou pelo bot foi identificado certo.</p>;
  }

  return (
    <div className="space-y-4">
      {pendencias.map((p) => (
        <CartaoPendencia key={p.id} pendencia={p} funcionarios={funcionarios} fazendas={fazendas} />
      ))}
    </div>
  );
}
