"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarDadosVenda,
  adicionarItemVenda,
  removerItemVenda,
  atualizarItemVenda,
} from "../../actions";
import type { AnimalAtivoSelecao, ItemVendaDetalhe, VendaLoteEditavel } from "@/lib/queries/vendas";
import { formatNumero } from "@/lib/format";

export function EditarVendaForm({
  fazendaCodigo,
  fazendaId,
  vendaLoteId,
  venda,
  itensIniciais,
  animaisDisponiveis,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  vendaLoteId: string;
  venda: VendaLoteEditavel;
  itensIniciais: ItemVendaDetalhe[];
  animaisDisponiveis: AnimalAtivoSelecao[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [comprador, setComprador] = useState(venda.comprador ?? "");
  const [frigorifico, setFrigorifico] = useState(venda.frigorifico ?? "");
  const [nf, setNf] = useState(venda.nf ?? "");
  const [dataAbate, setDataAbate] = useState(venda.dataAbate ?? "");
  const [dataSaida, setDataSaida] = useState(venda.dataSaida);
  const [precoArroba, setPrecoArroba] = useState(venda.precoArroba != null ? String(venda.precoArroba) : "");
  const [precoArrobaEntrada, setPrecoArrobaEntrada] = useState(String(venda.precoArrobaEntrada));
  const [pesoCarcacaTotal, setPesoCarcacaTotal] = useState(
    venda.pesoCarcacaTotal != null ? String(venda.pesoCarcacaTotal) : "",
  );
  const [frete, setFrete] = useState(String(venda.frete));
  const [comissao, setComissao] = useState(String(venda.comissao));
  const [deducoes, setDeducoes] = useState(String(venda.deducoes));

  const [itens, setItens] = useState(itensIniciais);
  const [quantidadeInputs, setQuantidadeInputs] = useState<Record<string, string>>({});
  const [valorInputs, setValorInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setItens(itensIniciais);
    const q: Record<string, string> = {};
    const v: Record<string, string> = {};
    for (const it of itensIniciais) {
      if (it.quantidade !== null) q[it.vendaItemId] = String(it.quantidade);
      if (it.valorNegociado !== null) v[it.vendaItemId] = String(it.valorNegociado);
    }
    setQuantidadeInputs(q);
    setValorInputs(v);
  }, [itensIniciais]);

  const [busca, setBusca] = useState("");
  const [novasQuantidades, setNovasQuantidades] = useState<Record<string, string>>({});
  const [novosValores, setNovosValores] = useState<Record<string, string>>({});

  const termo = busca.trim().toLowerCase();
  const disponiveisFiltrados = termo
    ? animaisDisponiveis.filter((a) => (a.brinco ?? a.categoriaNome).toLowerCase().includes(termo))
    : animaisDisponiveis;

  function salvarSucesso() {
    setErro(null);
    router.refresh();
  }

  function handleSalvarDados(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const r = await atualizarDadosVenda(fazendaCodigo, fazendaId, vendaLoteId, {
        comprador: comprador || null,
        frigorifico: frigorifico || null,
        nf: nf || null,
        dataAbate: dataAbate || null,
        dataSaida,
        precoArroba: precoArroba ? Number(precoArroba) : null,
        precoArrobaEntrada: Number(precoArrobaEntrada),
        pesoCarcacaTotal: pesoCarcacaTotal ? Number(pesoCarcacaTotal) : null,
        frete: Number(frete || "0"),
        comissao: Number(comissao || "0"),
        deducoes: Number(deducoes || "0"),
      });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao salvar.");
        return;
      }
      salvarSucesso();
    });
  }

  function handleSalvarItem(item: ItemVendaDetalhe) {
    setErro(null);
    startTransition(async () => {
      const novaQuantidade =
        item.quantidade !== null ? Number(quantidadeInputs[item.vendaItemId] ?? item.quantidade) : null;
      const valorNegociado =
        venda.tipoVenda === "direta" ? Number(valorInputs[item.vendaItemId] ?? item.valorNegociado ?? 0) : null;
      const r = await atualizarItemVenda(fazendaCodigo, fazendaId, vendaLoteId, item.vendaItemId, {
        novaQuantidade,
        valorNegociado,
      });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao salvar item.");
        return;
      }
      salvarSucesso();
    });
  }

  function handleRemoverItem(vendaItemId: string) {
    setErro(null);
    startTransition(async () => {
      const r = await removerItemVenda(fazendaCodigo, fazendaId, vendaLoteId, vendaItemId);
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao remover item.");
        return;
      }
      salvarSucesso();
    });
  }

  function handleAdicionar(a: AnimalAtivoSelecao) {
    setErro(null);
    startTransition(async () => {
      const quantidadeVendida = a.tipo === "agregado" ? Number(novasQuantidades[a.animalId] ?? "0") : null;
      if (a.tipo === "agregado" && (!quantidadeVendida || quantidadeVendida <= 0)) {
        setErro("Informe a quantidade a adicionar desse lote.");
        return;
      }
      const valorNegociado =
        venda.tipoVenda === "direta" ? Number(novosValores[a.animalId] ?? "0") : null;
      if (venda.tipoVenda === "direta" && (!valorNegociado || valorNegociado <= 0)) {
        setErro("Informe o valor combinado do animal.");
        return;
      }
      const r = await adicionarItemVenda(fazendaCodigo, fazendaId, vendaLoteId, {
        animalId: a.animalId,
        tipo: a.tipo,
        quantidadeVendida,
        valorNegociado,
      });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao adicionar animal.");
        return;
      }
      salvarSucesso();
    });
  }

  return (
    <div className="space-y-8">
      {erro && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {erro}
        </p>
      )}

      <section className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Dados da venda ({venda.tipoVenda === "direta" ? "venda direta" : "abate"})
        </h2>
        <form onSubmit={handleSalvarDados} className="space-y-4">
          {venda.tipoVenda === "abate" ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-zinc-500">Frigorífico</span>
                <input
                  type="text"
                  value={frigorifico}
                  onChange={(e) => setFrigorifico(e.target.value)}
                  className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-500">NF / Pedido</span>
                <input
                  type="text"
                  value={nf}
                  onChange={(e) => setNf(e.target.value)}
                  className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-500">Data do abate</span>
                <input
                  type="date"
                  value={dataAbate}
                  onChange={(e) => setDataAbate(e.target.value)}
                  className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-zinc-500">Comprador</span>
                <input
                  type="text"
                  value={comprador}
                  onChange={(e) => setComprador(e.target.value)}
                  className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Data de saída da fazenda</span>
              <input
                type="date"
                value={dataSaida}
                onChange={(e) => setDataSaida(e.target.value)}
                required
                className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Preço da @ pago na entrada (R$)</span>
              <input
                type="number"
                step="0.01"
                value={precoArrobaEntrada}
                onChange={(e) => setPrecoArrobaEntrada(e.target.value)}
                required
                className="w-28 rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            {venda.tipoVenda === "abate" && (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-500">Preço da @ de venda (R$)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={precoArroba}
                    onChange={(e) => setPrecoArroba(e.target.value)}
                    required
                    className="w-28 rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-500">Peso de carcaça total (kg)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={pesoCarcacaTotal}
                    onChange={(e) => setPesoCarcacaTotal(e.target.value)}
                    className="w-32 rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Frete (R$)</span>
              <input
                type="number"
                step="0.01"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                className="w-28 rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Comissão (R$)</span>
              <input
                type="number"
                step="0.01"
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
                className="w-28 rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Outras deduções (R$)</span>
              <input
                type="number"
                step="0.01"
                value={deducoes}
                onChange={(e) => setDeducoes(e.target.value)}
                className="w-28 rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
            >
              Salvar dados da venda
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Animais nessa venda</h2>
        <div className="overflow-x-auto rounded-card border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Brinco / lote</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2 text-right">Quantidade</th>
                {venda.tipoVenda === "direta" && <th className="px-3 py-2 text-right">Valor combinado (R$)</th>}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {itens.map((it) => (
                <tr key={it.vendaItemId} className="bg-white dark:bg-zinc-950">
                  <td className="px-3 py-2">{it.tipo === "individual" ? it.brinco : "Lote agregado"}</td>
                  <td className="px-3 py-2">{it.categoriaNome}</td>
                  <td className="px-3 py-2 text-right">
                    {it.tipo === "agregado" ? (
                      <input
                        type="number"
                        min={1}
                        value={quantidadeInputs[it.vendaItemId] ?? ""}
                        onChange={(e) =>
                          setQuantidadeInputs((prev) => ({ ...prev, [it.vendaItemId]: e.target.value }))
                        }
                        className="w-20 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    ) : (
                      "1"
                    )}
                  </td>
                  {venda.tipoVenda === "direta" && (
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={valorInputs[it.vendaItemId] ?? ""}
                        onChange={(e) => setValorInputs((prev) => ({ ...prev, [it.vendaItemId]: e.target.value }))}
                        className="w-28 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleSalvarItem(it)}
                      className="mr-2 rounded-btn border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRemoverItem(it.vendaItemId)}
                      className="rounded-btn border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {itens.length === 0 && (
                <tr>
                  <td
                    colSpan={venda.tipoVenda === "direta" ? 5 : 4}
                    className="px-3 py-4 text-center text-zinc-500"
                  >
                    Nenhum animal nessa venda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Adicionar animal esquecido
        </h2>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar brinco..."
          className="mb-3 rounded-input border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="overflow-x-auto rounded-card border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Brinco / lote</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2 text-right">Peso atual (kg)</th>
                <th className="px-3 py-2 text-right">Quantidade</th>
                {venda.tipoVenda === "direta" && <th className="px-3 py-2 text-right">Valor combinado (R$)</th>}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {disponiveisFiltrados.map((a) => (
                <tr key={a.animalId} className="bg-white dark:bg-zinc-950">
                  <td className="px-3 py-2">{a.tipo === "individual" ? a.brinco : "Lote agregado"}</td>
                  <td className="px-3 py-2">{a.categoriaNome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumero(a.pesoAtualKg)}</td>
                  <td className="px-3 py-2 text-right">
                    {a.tipo === "agregado" ? (
                      <input
                        type="number"
                        min={0}
                        max={a.quantidadeDisponivel ?? undefined}
                        value={novasQuantidades[a.animalId] ?? ""}
                        onChange={(e) =>
                          setNovasQuantidades((prev) => ({ ...prev, [a.animalId]: e.target.value }))
                        }
                        placeholder={`0 de ${a.quantidadeDisponivel}`}
                        className="w-24 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    ) : (
                      "1"
                    )}
                  </td>
                  {venda.tipoVenda === "direta" && (
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={novosValores[a.animalId] ?? ""}
                        onChange={(e) => setNovosValores((prev) => ({ ...prev, [a.animalId]: e.target.value }))}
                        className="w-28 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleAdicionar(a)}
                      className="rounded-btn bg-primary-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-primary-500"
                    >
                      Adicionar
                    </button>
                  </td>
                </tr>
              ))}
              {disponiveisFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={venda.tipoVenda === "direta" ? 6 : 5}
                    className="px-3 py-4 text-center text-zinc-500"
                  >
                    {animaisDisponiveis.length === 0
                      ? "Nenhum animal ativo disponível nesse curral."
                      : "Nenhum animal encontrado para essa busca."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
