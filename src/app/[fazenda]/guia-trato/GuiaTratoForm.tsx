"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calcularBalanceamento, type CurralAjuste, type GrupoDieta, type Horario } from "@/lib/guia-trato/balanceamento";
import { salvarPlano, salvarVagoes } from "./actions";
import { ScrollHint } from "@/components/ScrollHint";
import { formatNumero, formatPercentual } from "@/lib/format";
import type { VagaoSalvo } from "@/lib/queries/guia-trato";

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

function ViagensGrupo({
  fazendaCodigo,
  guiaTratoId,
  horario,
  grupo,
  numeroInicial,
  cargasSalvas,
}: {
  fazendaCodigo: string;
  guiaTratoId: string | null;
  horario: Horario;
  grupo: GrupoDieta;
  numeroInicial: number;
  cargasSalvas?: number[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  // Sem useEffect de propósito: o pai remonta este componente (via `key`)
  // quando numVagoes/totalKg mudam, então o estado inicial já nasce certo.
  const [cargas, setCargas] = useState<number[]>(
    cargasSalvas?.length === grupo.numVagoes ? cargasSalvas : grupo.vagoesSugeridos,
  );

  const soma = cargas.reduce((acc, v) => acc + v, 0);
  const fecha = Math.abs(soma - grupo.totalKg) <= 0.5;

  if (grupo.numVagoes === 0) return null;

  return (
    <div className="rounded-card border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm font-medium text-black dark:text-zinc-50">
        Dieta: {grupo.dietaNome}{" "}
        <span className="font-normal text-zinc-500">— currais {grupo.curraisCodigos.join(", ")}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {cargas.map((carga, i) => (
          <label key={i} className="text-xs">
            <span className="mb-0.5 block text-zinc-400">Viagem {numeroInicial + i}</span>
            <input
              type="number"
              step="0.1"
              value={carga}
              onChange={(e) =>
                setCargas((prev) => prev.map((v, idx) => (idx === i ? Number(e.target.value) : v)))
              }
              className="w-24 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        ))}
      </div>
      <p className={`mt-1 text-xs ${fecha ? "text-zinc-500" : "text-red-600"}`}>
        Soma: {formatNumero(soma, 1)} kg (devido: {formatNumero(grupo.totalKg, 1)} kg)
      </p>
      {!guiaTratoId && <p className="text-xs text-amber-600">Salve o plano do dia antes de editar as viagens.</p>}
      <button
        type="button"
        disabled={pending || !fecha || !guiaTratoId}
        onClick={() => {
          if (!guiaTratoId) return;
          setErro(null);
          setSucesso(false);
          startTransition(async () => {
            const r = await salvarVagoes(fazendaCodigo, {
              guiaTratoId,
              dietaId: grupo.dietaId,
              horario,
              cargas,
              totalEsperado: grupo.totalKg,
            });
            if (!r.ok) {
              setErro(r.erro ?? "Erro ao salvar.");
              return;
            }
            setSucesso(true);
          });
        }}
        className="mt-2 rounded-btn border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 dark:border-zinc-700"
      >
        {pending ? "Salvando..." : "Salvar viagens dessa dieta"}
      </button>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      {sucesso && <p className="mt-1 text-xs text-green-700 dark:text-green-400">Salvo.</p>}
    </div>
  );
}

export function GuiaTratoForm({
  fazendaCodigo,
  fazendaId,
  data,
  guiaTratoIdInicial,
  capacidadeVagaoInicial,
  splitInicial,
  curraisIniciais,
  vagoesSalvosIniciais,
}: {
  fazendaCodigo: string;
  fazendaId: string;
  data: string;
  guiaTratoIdInicial: string | null;
  capacidadeVagaoInicial: number;
  splitInicial: { manha: number; almoco: number; tarde: number };
  curraisIniciais: CurralInicial[];
  vagoesSalvosIniciais: VagaoSalvo[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [guiaTratoId, setGuiaTratoId] = useState(guiaTratoIdInicial);

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

  function handleSalvarPlano() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      const resultado = await salvarPlano({
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
        setErro(resultado.erro ?? "Erro ao salvar.");
        return;
      }
      setGuiaTratoId(resultado.guiaTratoId ?? null);
      setSucesso(true);
      router.refresh();
    });
  }

  const semDieta = currais.filter((c) => !c.dietaId);
  const vagoesSalvosPorChave = new Map(vagoesSalvosIniciais.map((v) => [`${v.dietaId}|${v.horario}`, v.cargas]));

  return (
    <div className="space-y-6">
      {semDieta.length > 0 && (
        <p className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
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
            className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Split manhã</span>
          <input
            type="number"
            step="0.01"
            value={split.manha}
            onChange={(e) => setSplit((s) => ({ ...s, manha: Number(e.target.value) }))}
            className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Split almoço</span>
          <input
            type="number"
            step="0.01"
            value={split.almoco}
            onChange={(e) => setSplit((s) => ({ ...s, almoco: Number(e.target.value) }))}
            className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Split tarde</span>
          <input
            type="number"
            step="0.01"
            value={split.tarde}
            onChange={(e) => setSplit((s) => ({ ...s, tarde: Number(e.target.value) }))}
            className="w-full rounded-input border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>
      <p className={`text-sm ${Math.abs(somaSplit - 1) > 0.001 ? "text-red-600" : "text-zinc-500"}`}>
        Soma dos splits: {formatPercentual(somaSplit)}
      </p>

      <ScrollHint />
      <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
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
                    className="w-24 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={c.ajustePct}
                    onChange={(e) => atualizarCurral(c.curralId, "ajustePct", Number(e.target.value))}
                    className="w-20 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    value={c.ajusteKg}
                    onChange={(e) => atualizarCurral(c.curralId, "ajusteKg", Number(e.target.value))}
                    className="w-20 rounded-input border border-zinc-300 px-2 py-1 text-right dark:border-zinc-700 dark:bg-zinc-900"
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

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700 dark:text-green-400">Plano salvo.</p>}
      <button
        type="button"
        onClick={handleSalvarPlano}
        disabled={pending}
        className="rounded-btn bg-primary-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary-500 dark:text-white"
      >
        {pending ? "Salvando..." : "Salvar plano do dia"}
      </button>

      <div>
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-500">Viagens de vagão por horário</h2>
        <p className="mb-3 text-xs text-zinc-500">
          O nº de viagens é pra fazenda inteira naquele horário — um vagão só carrega uma dieta por vez, mas o
          total de viagens soma todas. O sistema sugere a divisão equilibrada; você pode editar o kg de cada
          viagem, desde que a soma daquela dieta continue fechando com o total devido.
        </p>
        <div className="space-y-4">
          {balanceamento.porHorario.map((h) => {
            let contador = 1;
            return (
              <div key={h.horario} className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="font-medium text-black dark:text-zinc-50">
                  {LABEL_HORARIO[h.horario]} — {h.numVagoesTotal} {h.numVagoesTotal === 1 ? "viagem" : "viagens"} no
                  total · {formatNumero(h.totalKg)} kg
                </p>
                {h.grupos.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">Nada nesse horário.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {h.grupos.map((grupo) => {
                      const numeroInicial = contador;
                      contador += grupo.numVagoes;
                      return (
                        <ViagensGrupo
                          key={`${grupo.dietaId}-${h.horario}-${grupo.numVagoes}-${grupo.totalKg.toFixed(1)}`}
                          fazendaCodigo={fazendaCodigo}
                          guiaTratoId={guiaTratoId}
                          horario={h.horario}
                          grupo={grupo}
                          numeroInicial={numeroInicial}
                          cargasSalvas={vagoesSalvosPorChave.get(`${grupo.dietaId}|${h.horario}`)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
