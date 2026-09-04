"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editarFuncionario, enviarDocumento, getUrlDocumento, removerFuncionario } from "../actions";
import type { DocumentoFuncionario, Funcionario, TipoDocumento } from "@/lib/queries/funcionarios";
import { formatData, formatDataHora } from "@/lib/format";

const campoClasse = "w-full rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const rotuloClasse = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

const ROTULO_TIPO_DOC: Record<TipoDocumento, string> = {
  holerite: "Holerite",
  recibo: "Recibo",
  comprovante: "Comprovante",
};

function competenciaParaMesAno(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

function FormularioEdicao({
  funcionario,
  aoSalvar,
  aoCancelar,
  pending,
}: {
  funcionario: Funcionario;
  aoSalvar: (campos: { nomeCompleto: string; apelido: string; tipo: "fixo" | "diarista"; cargo: string; dataAdmissao: string; ativo: boolean }) => void;
  aoCancelar: () => void;
  pending: boolean;
}) {
  const [nomeCompleto, setNomeCompleto] = useState(funcionario.nome_completo);
  const [apelido, setApelido] = useState(funcionario.apelido ?? "");
  const [tipo, setTipo] = useState<"fixo" | "diarista">(funcionario.tipo);
  const [cargo, setCargo] = useState(funcionario.cargo ?? "");
  const [dataAdmissao, setDataAdmissao] = useState(funcionario.data_admissao ?? "");
  const [ativo, setAtivo] = useState(funcionario.ativo);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={rotuloClasse}>Nome completo *</label>
          <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className={campoClasse} />
        </div>
        <div>
          <label className={rotuloClasse}>Apelido / nome usual</label>
          <input type="text" value={apelido} onChange={(e) => setApelido(e.target.value)} className={campoClasse} />
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
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-3.5 w-3.5" />
        Ativo
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => aoSalvar({ nomeCompleto, apelido, tipo, cargo, dataAdmissao, ativo })}
          className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={aoCancelar} className="rounded-btn border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function FuncionarioDetalhe({
  funcionario,
  documentos,
  podeEditar,
}: {
  funcionario: Funcionario;
  documentos: DocumentoFuncionario[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enviando, startEnvio] = useTransition();
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function salvarEdicao(campos: { nomeCompleto: string; apelido: string; tipo: "fixo" | "diarista"; cargo: string; dataAdmissao: string; ativo: boolean }) {
    setErro(null);
    startTransition(async () => {
      const resultado = await editarFuncionario(funcionario.id, {
        fazendaId: funcionario.fazenda_id,
        nomeCompleto: campos.nomeCompleto,
        apelido: campos.apelido || null,
        tipo: campos.tipo,
        cargo: campos.cargo || null,
        dataAdmissao: campos.dataAdmissao || null,
        ativo: campos.ativo,
      });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível salvar.");
      else {
        setEditando(false);
        router.refresh();
      }
    });
  }

  function remover() {
    if (!confirm("Remover este funcionário? Todos os documentos ligados a ele também serão removidos.")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await removerFuncionario(funcionario.id);
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível remover.");
      else router.push("/funcionarios");
    });
  }

  function enviarFormulario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroUpload(null);
    const dados = new FormData(e.currentTarget);
    dados.set("funcionarioId", funcionario.id);
    startEnvio(async () => {
      const resultado = await enviarDocumento(dados);
      if (!resultado.ok) setErroUpload(resultado.erro ?? "Não foi possível enviar o documento.");
      else {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  async function abrirDocumento(caminho: string) {
    setAbrindo(caminho);
    const url = await getUrlDocumento(caminho);
    setAbrindo(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setErro("Não foi possível abrir o documento.");
  }

  return (
    <div className="space-y-6">
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {editando ? (
          <FormularioEdicao funcionario={funcionario} aoSalvar={salvarEdicao} aoCancelar={() => setEditando(false)} pending={pending} />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 text-sm">
              <p className="text-black dark:text-zinc-50">
                <span className="font-semibold">{funcionario.nome_completo}</span>
                {!funcionario.ativo && (
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">inativo</span>
                )}
              </p>
              <p className="text-zinc-500">
                {funcionario.fazenda_codigo} · {funcionario.tipo === "diarista" ? "Diarista" : "Funcionário fixo"}
                {funcionario.cargo && ` · ${funcionario.cargo}`}
              </p>
              {funcionario.data_admissao && <p className="text-xs text-zinc-500">Admissão: {formatData(funcionario.data_admissao)}</p>}
            </div>
            {podeEditar && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="rounded-btn border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={remover}
                  className="rounded-btn px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {podeEditar && (
        <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Enviar documento</h2>
          {erroUpload && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{erroUpload}</p>}
          <form ref={formRef} onSubmit={enviarFormulario} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={rotuloClasse}>Tipo *</label>
                <select name="tipo" defaultValue="holerite" className={campoClasse}>
                  <option value="holerite">Holerite</option>
                  <option value="recibo">Recibo</option>
                  <option value="comprovante">Comprovante</option>
                </select>
              </div>
              <div>
                <label className={rotuloClasse}>Competência (mês/ano) *</label>
                <input type="month" name="competencia" required className={campoClasse} />
              </div>
              <div>
                <label className={rotuloClasse}>Arquivo (PDF, JPG ou PNG) *</label>
                <input type="file" name="arquivo" accept="application/pdf,image/jpeg,image/png" required className={campoClasse} />
              </div>
            </div>
            <button type="submit" disabled={enviando} className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Histórico de documentos</h2>
        {documentos.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum documento enviado ainda.</p>
        ) : (
          <div className="space-y-2">
            {documentos.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-card border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <p className="text-sm font-semibold text-black dark:text-zinc-50">
                    {ROTULO_TIPO_DOC[d.tipo]} · {competenciaParaMesAno(d.competencia)}
                    {d.versao > 1 && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                        v{d.versao}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Enviado em {formatDataHora(d.enviado_em)} · {d.origem === "telegram" ? "via Telegram" : "manual"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => abrirDocumento(d.storage_path_individual)}
                  disabled={abrindo === d.storage_path_individual}
                  className="shrink-0 rounded-btn border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {abrindo === d.storage_path_individual ? "Abrindo..." : "Abrir"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
