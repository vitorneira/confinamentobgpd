"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarOsManual } from "../actions";
import { DOMINIOS, ROTULO_DOMINIO, type Dominio } from "@/lib/orquestrador/tipos";
import type { ItemOs } from "@/lib/queries/ordens-servico";

type OpcoesFazenda = {
  id: string;
  codigo: string;
  nome: string;
  ativos: { id: string; nome: string }[];
  currais: { id: string; codigo: string }[];
  usuarios: { id: string; email: string }[];
};

export function NovaOsForm({
  fazendas,
  fornecedores,
  prestadores,
}: {
  fazendas: OpcoesFazenda[];
  fornecedores: { id: string; nome: string }[];
  prestadores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [fazendaId, setFazendaId] = useState(fazendas[0]?.id ?? "");
  const [dominio, setDominio] = useState<Dominio>("outro");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [prestadorId, setPrestadorId] = useState("");
  const [descontarDoPrestador, setDescontarDoPrestador] = useState(false);
  const [ativoDestinoId, setAtivoDestinoId] = useState("");
  const [curralId, setCurralId] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [prazoPedido, setPrazoPedido] = useState("");
  const [itens, setItens] = useState<ItemOs[]>([]);
  const [novoItemQtd, setNovoItemQtd] = useState("");
  const [novoItemNome, setNovoItemNome] = useState("");

  const fazendaSelecionada = fazendas.find((f) => f.id === fazendaId);

  function adicionarItem() {
    if (!novoItemNome.trim()) return;
    setItens((v) => [...v, { qtd: novoItemQtd || null, item: novoItemNome.trim() }]);
    setNovoItemQtd("");
    setNovoItemNome("");
  }

  function salvar() {
    setErro(null);
    if (!fazendaId) return setErro("Selecione a fazenda.");
    if (!descricao.trim()) return setErro("Descreva a ordem de serviço.");

    startTransition(async () => {
      const resultado = await criarOsManual({
        fazendaId,
        dominio,
        intencao: "abrir_demanda",
        descricao: descricao.trim(),
        itens,
        responsavelId: responsavelId || null,
        fornecedorId: fornecedorId || null,
        prestadorId: prestadorId || null,
        descontarDoPrestador,
        ativoDestinoId: ativoDestinoId || null,
        curralId: curralId || null,
        valorEstimado: valorEstimado ? Number(valorEstimado) : null,
        prazoPedido: prazoPedido || null,
      });
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível criar a OS.");
      else router.push(`/ordens-servico/${resultado.osId}`);
    });
  }

  const campoClasse = "w-full rounded-input border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
  const rotuloClasse = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <label className={rotuloClasse}>Descrição *</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          className={campoClasse}
          placeholder="O que precisa ser feito ou comprado?"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
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
          <label className={rotuloClasse}>Domínio</label>
          <select value={dominio} onChange={(e) => setDominio(e.target.value as Dominio)} className={campoClasse}>
            {DOMINIOS.map((d) => (
              <option key={d} value={d}>
                {ROTULO_DOMINIO[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotuloClasse}>Responsável</label>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className={campoClasse}>
            <option value="">—</option>
            {fazendaSelecionada?.usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotuloClasse}>Fornecedor</label>
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={campoClasse}>
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
          <select value={prestadorId} onChange={(e) => setPrestadorId(e.target.value)} className={campoClasse}>
            <option value="">—</option>
            {prestadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotuloClasse}>Ativo vinculado</label>
          <select value={ativoDestinoId} onChange={(e) => setAtivoDestinoId(e.target.value)} className={campoClasse}>
            <option value="">—</option>
            {fazendaSelecionada?.ativos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotuloClasse}>Curral vinculado</label>
          <select value={curralId} onChange={(e) => setCurralId(e.target.value)} className={campoClasse}>
            <option value="">—</option>
            {fazendaSelecionada?.currais.map((c) => (
              <option key={c.id} value={c.id}>
                Curral {c.codigo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotuloClasse}>Valor estimado (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valorEstimado}
            onChange={(e) => setValorEstimado(e.target.value)}
            className={campoClasse}
          />
        </div>
        <div>
          <label className={rotuloClasse}>Prazo pedido</label>
          <input type="date" value={prazoPedido} onChange={(e) => setPrazoPedido(e.target.value)} className={campoClasse} />
        </div>
      </div>

      <div>
        <label className={rotuloClasse}>Itens</label>
        {itens.length > 0 && (
          <ul className="mb-2 space-y-1">
            {itens.map((it, i) => (
              <li key={i} className="flex items-center justify-between rounded-input bg-zinc-100 px-2 py-1 text-sm dark:bg-zinc-800">
                <span>
                  {it.qtd ? `${it.qtd} × ` : ""}
                  {it.item}
                </span>
                <button type="button" onClick={() => setItens((v) => v.filter((_, idx) => idx !== i))} className="text-xs text-zinc-500 hover:text-red-600">
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={novoItemQtd}
            onChange={(e) => setNovoItemQtd(e.target.value)}
            placeholder="qtd"
            className="w-20 rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            type="text"
            value={novoItemNome}
            onChange={(e) => setNovoItemNome(e.target.value)}
            placeholder="item"
            className="flex-1 rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="button" onClick={adicionarItem} className="rounded-btn border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
            + item
          </button>
        </div>
      </div>

      {prestadorId && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={descontarDoPrestador}
            onChange={(e) => setDescontarDoPrestador(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Descontar do pagamento do prestador
        </label>
      )}

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={salvar}
        className="rounded-btn bg-primary-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {pending ? "Criando..." : "Criar OS"}
      </button>
    </div>
  );
}
