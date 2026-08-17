"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fecharVenda, type ItemSelecionado } from "./actions";
import type { AnimalAtivoSelecao } from "@/lib/queries/vendas";
import { formatNumero } from "@/lib/format";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FechamentoForm({
  fazendaCodigo,
  fazendaId,
  curralId,
  animais,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  curralId: string;
  animais: AnimalAtivoSelecao[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [valoresNegociados, setValoresNegociados] = useState<Record<string, string>>({});

  const [tipoVenda, setTipoVenda] = useState<"abate" | "direta">("abate");
  const [comprador, setComprador] = useState("");
  const [frigorifico, setFrigorifico] = useState("");
  const [nf, setNf] = useState("");
  const [dataAbate, setDataAbate] = useState(hojeISO());
  const [dataSaida, setDataSaida] = useState(hojeISO());
  const [precoArroba, setPrecoArroba] = useState("");
  const [precoArrobaEntrada, setPrecoArrobaEntrada] = useState("");
  const [pesoCarcacaTotal, setPesoCarcacaTotal] = useState("");
  const [frete, setFrete] = useState("0");
  const [comissao, setComissao] = useState("0");
  const [deducoes, setDeducoes] = useState("0");

  const termo = busca.trim().toLowerCase();
  const animaisFiltrados = termo
    ? animais.filter((a) => (a.brinco ?? a.categoriaNome).toLowerCase().includes(termo))
    : animais;

  function toggleIndividual(animalId: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(animalId)) next.delete(animalId);
      else next.add(animalId);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const itens: ItemSelecionado[] = [];
    for (const a of animais) {
      const valorNegociado = valoresNegociados[a.animalId] ? Number(valoresNegociados[a.animalId]) : null;
      if (a.tipo === "individual") {
        if (selecionados.has(a.animalId)) {
          itens.push({ animalId: a.animalId, tipo: "individual", quantidadeVendida: null, valorNegociado });
        }
      } else {
        const qtd = Number(quantidades[a.animalId] ?? "0");
        if (qtd > 0) itens.push({ animalId: a.animalId, tipo: "agregado", quantidadeVendida: qtd, valorNegociado });
      }
    }
    if (itens.length === 0) {
      setErro("Selecione ao menos um animal ou informe a quantidade de um lote agregado.");
      return;
    }

    startTransition(async () => {
      const r = await fecharVenda(fazendaCodigo, fazendaId, {
        curralId,
        tipoVenda,
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
        itens,
      });
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao fechar a venda.");
        return;
      }
      router.push(`/${fazendaCodigo.toLowerCase()}/vendas/${r.vendaLoteId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Tipo de venda</span>
          <select
            value={tipoVenda}
            onChange={(e) => setTipoVenda(e.target.value as "abate" | "direta")}
            className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="abate">Abate (frigorífico)</option>
            <option value="direta">Venda direta (valor combinado)</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Buscar brinco</span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: BBG 998"
            className="rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2">Brinco / lote</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2 text-right">Peso atual (kg)</th>
              <th className="px-3 py-2 text-right">Disponível / vender</th>
              {tipoVenda === "direta" && <th className="px-3 py-2 text-right">Valor combinado (R$)</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {animaisFiltrados.map((a) => (
              <tr key={a.animalId} className="bg-white dark:bg-zinc-950">
                <td className="px-3 py-2">
                  {a.tipo === "individual" && (
                    <input
                      type="checkbox"
                      checked={selecionados.has(a.animalId)}
                      onChange={() => toggleIndividual(a.animalId)}
                    />
                  )}
                </td>
                <td className="px-3 py-2">{a.tipo === "individual" ? a.brinco : "Lote agregado"}</td>
                <td className="px-3 py-2">{a.categoriaNome}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumero(a.pesoAtualKg)}</td>
                <td className="px-3 py-2 text-right">
                  {a.tipo === "agregado" ? (
                    <input
                      type="number"
                      min={0}
                      max={a.quantidadeDisponivel ?? undefined}
                      value={quantidades[a.animalId] ?? ""}
                      onChange={(e) => setQuantidades((prev) => ({ ...prev, [a.animalId]: e.target.value }))}
                      placeholder={`0 de ${a.quantidadeDisponivel}`}
                      className="w-24 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  ) : (
                    "1"
                  )}
                </td>
                {tipoVenda === "direta" && (
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={valoresNegociados[a.animalId] ?? ""}
                      onChange={(e) =>
                        setValoresNegociados((prev) => ({ ...prev, [a.animalId]: e.target.value }))
                      }
                      className="w-28 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </td>
                )}
              </tr>
            ))}
            {animaisFiltrados.length === 0 && (
              <tr>
                <td colSpan={tipoVenda === "direta" ? 6 : 5} className="px-3 py-4 text-center text-zinc-500">
                  {animais.length === 0 ? "Nenhum animal ativo nesse curral." : "Nenhum animal encontrado para essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tipoVenda === "abate" ? (
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
        {tipoVenda === "abate" && (
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
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
      >
        {pending ? "Fechando..." : "Fechar venda"}
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </form>
  );
}
