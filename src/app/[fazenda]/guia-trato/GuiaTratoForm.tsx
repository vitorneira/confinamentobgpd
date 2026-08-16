"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calcularBalanceamento, type CurralAjuste } from "@/lib/guia-trato/balanceamento";
import { confirmarGuia } from "./actions";
import { ScrollHint } from "@/components/ScrollHint";
import { formatNumero, formatPercentual } from "@/lib/format";

type CurralInicial = {
  curralId: string;
  curralCodigo: string;
  dietaId: string | null;
  dietaNome: string | null;
  totalDiaKg: number;
  ajustePct: number;
  ajusteKg: number;
};

const LABEL_HORARIO = { manha: "Manhã", almoco: "Almoço", tarde: "Tarde" } as const;

export function GuiaTratoForm({
  fazendaCodigo,
  fazendaId,
  data,
  capacidadeVagaoInicial,
  splitInicial,
  curraisIniciais,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  data: string;
  capacidadeVagaoInicial: number;
  splitInicial: { manha: number; almoco: number; tarde: number };
  curraisIniciais: CurralInicial[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [capacidadeVagao, setCapacidadeVagao] = useState(capacidadeVagaoInicial);
  const [split, setSplit] = useState(splitInicial);
  const [currais, setCurrais] = useState(curraisIniciais);

  const somaSplit = split.manha + split.almoco + split.tarde;

  const balanceamento = useMemo(() => {
    const entrada: CurralAjuste[] = currais
      .filter((c) => c.dietaId)
      .map((c) => ({
        curralId: c.curralId,
        curralCodigo: c.curralCodigo,
        dietaId: c.dietaId!,
        dietaNome: c.dietaNome ?? "?",
        totalDiaKg: c.totalDiaKg,
        ajustePct: c.ajustePct,
        ajusteKg: c.ajusteKg,
      }));
    return calcularBalanceamento(entrada, split, capacidadeVagao);
  }, [currais, split, capacidadeVagao]);

  function atualizarCurral(curralId: string, campo: "totalDiaKg" | "ajustePct" | "ajusteKg", valor: number) {
    setCurrais((prev) => prev.map((c) => (c.curralId === curralId ? { ...c, [campo]: valor } : c)));
  }

  function handleConfirmar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      const resultado = await confirmarGuia({
        fazendaCodigo,
        fazendaId,
        data,
        capacidadeVagao,
        splitManha: split.manha,
        splitAlmoco: split.almoco,
        splitTarde: split.tarde,
        currais: currais.map((c) => ({
          curralId: c.curralId,
          totalDiaKg: c.totalDiaKg,
          ajustePct: c.ajustePct,
          ajusteKg: c.ajusteKg,
        })),
      });
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Erro ao confirmar.");
        return;
      }
      setSucesso(true);
      router.refresh();
    });
  }

  const semDieta = currais.filter((c) => !c.dietaId);

  return (
    <div className="space-y-6">
      {semDieta.length > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          Sem dieta vigente cadastrada para: {semDieta.map((c) => c.curralCodigo).join(", ")} — esses currais
          ficam de fora do guia até ter uma vigência de dieta.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Capacidade do vagão (kg)</span>
          <input
            type="number"
            value={capacidadeVagao}
            onChange={(e) => setCapacidadeVagao(Number(e.target.value))}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Split manhã</span>
          <input
            type="number"
            step="0.01"
            value={split.manha}
            onChange={(e) => setSplit((s) => ({ ...s, manha: Number(e.target.value) }))}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Split almoço</span>
          <input
            type="number"
            step="0.01"
            value={split.almoco}
            onChange={(e) => setSplit((s) => ({ ...s, almoco: Number(e.target.value) }))}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Split tarde</span>
          <input
            type="number"
            step="0.01"
            value={split.tarde}
            onChange={(e) => setSplit((s) => ({ ...s, tarde: Number(e.target.value) }))}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>
      <p className={`text-sm ${Math.abs(somaSplit - 1) > 0.001 ? "text-red-600" : "text-zinc-500"}`}>
        Soma dos splits: {formatPercentual(somaSplit)}
      </p>

      <ScrollHint />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Curral</th>
              <th className="px-3 py-2">Dieta</th>
              <th className="px-3 py-2 text-right">Base/dia (kg)</th>
              <th className="px-3 py-2 text-right">Ajuste %</th>
              <th className="px-3 py-2 text-right">Ajuste +kg</th>
              <th className="px-3 py-2 text-right">Total ajustado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {currais.map((c) => (
              <tr key={c.curralId} className="bg-white dark:bg-zinc-950">
                <td className="px-3 py-2 font-medium">{c.curralCodigo}</td>
                <td className="px-3 py-2 text-zinc-500">{c.dietaNome ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    value={c.totalDiaKg}
                    onChange={(e) => atualizarCurral(c.curralId, "totalDiaKg", Number(e.target.value))}
                    className="w-24 rounded border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={c.ajustePct}
                    onChange={(e) => atualizarCurral(c.curralId, "ajustePct", Number(e.target.value))}
                    className="w-20 rounded border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    value={c.ajusteKg}
                    onChange={(e) => atualizarCurral(c.curralId, "ajusteKg", Number(e.target.value))}
                    className="w-20 rounded border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {formatNumero(balanceamento.totalAjustadoPorCurral[c.curralId] ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Vagões por horário (balanceados)
        </h2>
        <div className="space-y-4">
          {balanceamento.porDieta.map((d) => (
            <div key={d.dietaId} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-2 font-medium text-black dark:text-zinc-50">Dieta: {d.dietaNome}</p>
              <div className="grid grid-cols-3 gap-3">
                {d.horarios.map((h) => (
                  <div key={h.horario} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500">{LABEL_HORARIO[h.horario]}</p>
                    <p className="tabular-nums font-medium">{formatNumero(h.totalKg)} kg</p>
                    <p className="text-xs text-zinc-500">
                      {h.numVagoes} vagões · {formatNumero(h.cargaPorVagao)} kg cada ·{" "}
                      {formatPercentual(h.aproveitamento)} aproveitamento
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Guia confirmado — tratos do dia {data} registrados.
        </p>
      )}
      <button
        type="button"
        onClick={handleConfirmar}
        disabled={pending}
        className="rounded bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Confirmando..." : "Confirmar guia do dia"}
      </button>
    </div>
  );
}
