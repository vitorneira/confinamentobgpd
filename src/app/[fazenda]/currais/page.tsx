import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCurraisIndicadores,
  getDietaAtualPorCurral,
  getFazendaByCodigo,
  getParametros,
} from "@/lib/queries/fazenda";
import { StatusBadge } from "@/components/StatusBadge";
import { formatNumero } from "@/lib/format";

function alertaPesagemCurral(dias: number | null, atencao: number, forte: number): "ok" | "atencao" | "critico" {
  if (dias === null) return "ok";
  if (dias >= forte) return "critico";
  if (dias >= atencao) return "atencao";
  return "ok";
}

export default async function CurraisPage({
  params,
}: {
  params: Promise<{ fazenda: string }>;
}) {
  const { fazenda: codigo } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const parametros = await getParametros(fazenda.id);
  if (!parametros) notFound();

  const [currais, dietaPorCurral] = await Promise.all([
    getCurraisIndicadores(fazenda.id),
    getDietaAtualPorCurral(fazenda.id, parametros.data_referencia),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Resumo por curral</h1>

      <div className="space-y-3">
        {currais.map((c) => (
          <Link
            key={c.curral_id}
            href={`/${codigo.toLowerCase()}/animais?curral=${encodeURIComponent(c.codigo)}`}
            className="block rounded-card border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-semibold text-black dark:text-zinc-50">
                  Curral {c.codigo} {c.descricao ? `— ${c.descricao}` : ""}
                </p>
                <p className="text-xs text-zinc-500">Dieta: {dietaPorCurral.get(c.curral_id) ?? "—"}</p>
              </div>
              <StatusBadge
                status={alertaPesagemCurral(
                  c.dias_desde_ultima_pesagem,
                  parametros.alerta_pesagem_atencao_dias,
                  parametros.alerta_pesagem_forte_dias,
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
              <div>
                <p className="text-xs text-zinc-500">Cabeças</p>
                <p className="tabular-nums font-medium">{formatNumero(c.num_cabecas)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Peso médio</p>
                <p className="tabular-nums font-medium">{formatNumero(c.peso_medio_atual_kg)} kg</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Peso total</p>
                <p className="tabular-nums font-medium">{formatNumero(c.peso_total_atual_kg)} kg</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">@ viva</p>
                <p className="tabular-nums font-medium">{formatNumero(c.arroba_viva_total, 1)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">GMD médio</p>
                <p className="tabular-nums font-medium">{formatNumero(c.gmd_medio, 3)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Ganho total</p>
                <p className="tabular-nums font-medium">{formatNumero(c.ganho_total_kg)} kg</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
