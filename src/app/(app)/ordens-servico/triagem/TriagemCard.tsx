"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarTriagem, descartarTriagem } from "../actions";
import { DOMINIOS, INTENCOES, ROTULO_DOMINIO, type Dominio, type Intencao } from "@/lib/orquestrador/tipos";
import type { ItemOs, MensagemTriagem } from "@/lib/queries/ordens-servico";
import { formatPercentual, formatTempoRelativo } from "@/lib/format";

type OpcoesFazenda = {
  id: string;
  codigo: string;
  nome: string;
  ativos: { id: string; nome: string }[];
  currais: { id: string; codigo: string }[];
  usuarios: { id: string; email: string }[];
};

const TIPOS_REGISTRO = [
  { valor: "morte", rotulo: "Morte" },
  { valor: "movimentacao", rotulo: "Movimentação" },
  { valor: "documento", rotulo: "Documento" },
  { valor: "contrato", rotulo: "Contrato" },
] as const;

export function TriagemCard({
  mensagem,
  fazendas,
  posicao,
  total,
}: {
  mensagem: MensagemTriagem;
  fazendas: OpcoesFazenda[];
  posicao: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  const [fazendaId, setFazendaId] = useState(
    fazendas.find((f) => f.codigo === mensagem.fazenda_sugerida)?.id ?? "",
  );
  const [dominio, setDominio] = useState<Dominio>(mensagem.dominio ?? "outro");
  const [intencao, setIntencao] = useState<Intencao>(mensagem.intencao ?? "abrir_demanda");
  const [solicitanteId, setSolicitanteId] = useState("");
  const [ativoDestinoId, setAtivoDestinoId] = useState("");
  const [tipoRegistro, setTipoRegistro] = useState<(typeof TIPOS_REGISTRO)[number]["valor"]>("movimentacao");
  const [itens] = useState<ItemOs[]>(mensagem.itens);

  const fazendaSelecionada = fazendas.find((f) => f.id === fazendaId);
  const textoOriginal = mensagem.transcricao ?? mensagem.conteudo_bruto ?? "";
  const confiancaPct = mensagem.confianca_classificacao != null ? formatPercentual(mensagem.confianca_classificacao) : null;
  const confiancaOk = (mensagem.confianca_classificacao ?? 0) >= 0.7;

  function confirmar() {
    setErro(null);
    if (!fazendaId) {
      setErro("Selecione a fazenda.");
      return;
    }
    startTransition(async () => {
      const resultado = await confirmarTriagem({
        mensagemId: mensagem.id,
        fazendaId,
        dominio,
        intencao,
        descricao: textoOriginal,
        itens,
        solicitanteId: solicitanteId || null,
        ativoDestinoId: ativoDestinoId || null,
        tipoRegistro: intencao === "registrar_lancar" ? tipoRegistro : undefined,
      });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível confirmar.");
      else router.refresh();
    });
  }

  function descartar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await descartarTriagem(mensagem.id);
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível descartar.");
      else router.refresh();
    });
  }

  return (
    <div
      className="flex-[1.5] rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      style={{ borderLeft: "3px solid var(--os-atencao-fg)" }}
    >
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span
          className="rounded-full px-2 py-0.5 font-bold"
          style={{ color: "var(--os-atencao-fg)", background: "var(--os-atencao-bg)" }}
        >
          chegando agora
        </span>
        <span className="text-zinc-500">
          {mensagem.canal ?? "manual"} · {formatTempoRelativo(mensagem.timestamp)}
        </span>
        <span className="ml-auto text-zinc-500">
          {posicao} de {total}
        </span>
      </div>

      <div className="mb-4 rounded-input bg-zinc-100 p-3 text-sm italic text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        &ldquo;{textoOriginal || "(sem texto)"}&rdquo;
      </div>

      <h3 className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">Classificação sugerida — confirme ou corrija</h3>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-zinc-500">Domínio</label>
          <select
            value={dominio}
            onChange={(e) => setDominio(e.target.value as Dominio)}
            className="w-full rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {DOMINIOS.map((d) => (
              <option key={d} value={d}>
                {ROTULO_DOMINIO[d]}
              </option>
            ))}
          </select>
          {confiancaPct && (
            <p className="mt-0.5 text-[10px]" style={{ color: confiancaOk ? "var(--os-sucesso-fg)" : "var(--os-atencao-fg)" }}>
              {confiancaOk ? "certo" : confiancaPct}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-zinc-500">Fazenda</label>
          <select
            value={fazendaId}
            onChange={(e) => setFazendaId(e.target.value)}
            className={`w-full rounded-input border px-2 py-1.5 text-sm dark:bg-zinc-900 ${
              fazendaId ? "border-zinc-300 dark:border-zinc-700" : "border-dashed"
            }`}
            style={!fazendaId ? { borderColor: "var(--os-atencao-fg)" } : undefined}
          >
            <option value="">não identificado — selecionar</option>
            {fazendas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} — {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-zinc-500">Solicitante</label>
          <select
            value={solicitanteId}
            onChange={(e) => setSolicitanteId(e.target.value)}
            className="w-full rounded-input border border-dashed px-2 py-1.5 text-sm dark:bg-zinc-900"
            style={{ borderColor: solicitanteId ? undefined : "var(--os-atencao-fg)" }}
          >
            <option value="">não identificado — selecionar</option>
            {fazendaSelecionada?.usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-zinc-500">Ativo vinculado</label>
          <select
            value={ativoDestinoId}
            onChange={(e) => setAtivoDestinoId(e.target.value)}
            className="w-full rounded-input border border-dashed px-2 py-1.5 text-sm dark:bg-zinc-900"
          >
            <option value="">nenhum</option>
            {fazendaSelecionada?.ativos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {intencao === "registrar_lancar" && (
        <div className="mb-4">
          <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-zinc-500">
            Tipo de registro
          </label>
          <select
            value={tipoRegistro}
            onChange={(e) => setTipoRegistro(e.target.value as typeof tipoRegistro)}
            className="w-full max-w-xs rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {TIPOS_REGISTRO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </div>
      )}

      {itens.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1 text-xs font-semibold text-zinc-500">Itens extraídos</h4>
          <div className="space-y-1">
            {itens.map((it, i) => (
              <div key={i} className="flex items-center gap-2 rounded-input bg-zinc-50 px-2 py-1.5 text-sm dark:bg-zinc-800/60">
                <input type="checkbox" checked readOnly className="h-3.5 w-3.5" />
                <span className="tabular-nums text-zinc-500">{it.qtd ?? "—"}</span>
                <span className="flex-1">{it.item}</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ color: "var(--os-sucesso-fg)", background: "var(--os-sucesso-bg)" }}
                >
                  extraído
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editando && (
        <div className="mb-4">
          <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-zinc-500">Intenção</label>
          <select
            value={intencao}
            onChange={(e) => setIntencao(e.target.value as Intencao)}
            className="w-full max-w-xs rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {INTENCOES.map((i) => (
              <option key={i} value={i}>
                {i.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      )}

      {erro && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={confirmar}
          className="flex-1 rounded-btn bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Confirmar e criar {intencao === "registrar_lancar" ? "registro" : "OS"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditando((v) => !v)}
          className="rounded-btn border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Editar
        </button>
        <button type="button" disabled={pending} onClick={descartar} className="rounded-btn px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Descartar
        </button>
      </div>
    </div>
  );
}
