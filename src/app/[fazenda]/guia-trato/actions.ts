"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { totalAjustado } from "@/lib/guia-trato/balanceamento";
import { getCurraisComDietaVigente } from "@/lib/queries/guia-trato";
import { erroAmigavel } from "@/lib/erros";

export type CurralPayload = {
  curralId: string;
  totalDiaKg: number;
  ajustePct: number;
  ajusteKg: number;
};

export type ConfirmarGuiaPayload = {
  fazendaCodigo: string;
  fazendaId: string;
  data: string;
  capacidadeVagao: number;
  splitManha: number;
  splitAlmoco: number;
  splitTarde: number;
  currais: CurralPayload[];
};

export async function confirmarGuia(
  payload: ConfirmarGuiaPayload,
): Promise<{ ok: boolean; erro?: string }> {
  const somaSplits = payload.splitManha + payload.splitAlmoco + payload.splitTarde;
  if (Math.abs(somaSplits - 1) > 0.001) {
    return { ok: false, erro: `Os splits têm que somar 100% (está em ${(somaSplits * 100).toFixed(1)}%).` };
  }
  if (payload.capacidadeVagao <= 0) {
    return { ok: false, erro: "Capacidade do vagão precisa ser maior que zero." };
  }

  const supabase = await createClient();

  const { data: guia, error: guiaErr } = await supabase
    .from("guia_trato")
    .upsert(
      {
        fazenda_id: payload.fazendaId,
        data: payload.data,
        capacidade_vagao: payload.capacidadeVagao,
        split_manha: payload.splitManha,
        split_almoco: payload.splitAlmoco,
        split_tarde: payload.splitTarde,
      },
      { onConflict: "fazenda_id,data" },
    )
    .select("id")
    .single();
  if (guiaErr) return { ok: false, erro: erroAmigavel(guiaErr) };

  const { error: curralErr } = await supabase.from("guia_trato_curral").upsert(
    payload.currais.map((c) => ({
      guia_trato_id: guia.id,
      curral_id: c.curralId,
      total_dia_kg: c.totalDiaKg,
      ajuste_pct: c.ajustePct,
      ajuste_kg: c.ajusteKg,
    })),
    { onConflict: "guia_trato_id,curral_id" },
  );
  if (curralErr) return { ok: false, erro: erroAmigavel(curralErr) };

  const curraisComDieta = await getCurraisComDietaVigente(payload.fazendaId, payload.data);
  const dietaPorCurral = new Map(curraisComDieta.map((c) => [c.curralId, c]));

  const dietaIds = [...new Set(curraisComDieta.map((c) => c.dietaId).filter((id): id is string => !!id))];
  const { data: custosVitrine, error: custoErr } = await supabase
    .from("v_dieta_custo_vitrine")
    .select("dieta_id, custo_por_kg")
    .in("dieta_id", dietaIds);
  if (custoErr) return { ok: false, erro: erroAmigavel(custoErr) };
  const custoPorDieta = new Map((custosVitrine ?? []).map((c) => [c.dieta_id as string, c.custo_por_kg as number]));

  const tratos = [];
  for (const c of payload.currais) {
    const dieta = dietaPorCurral.get(c.curralId);
    if (!dieta?.dietaId) {
      return { ok: false, erro: `Curral sem dieta vigente na data ${payload.data} — cadastre a vigência antes.` };
    }
    const total = totalAjustado(c.totalDiaKg, c.ajustePct, c.ajusteKg);
    tratos.push({
      fazenda_id: payload.fazendaId,
      data: payload.data,
      curral_id: c.curralId,
      trato_manha_kg: total * payload.splitManha,
      trato_almoco_kg: total * payload.splitAlmoco,
      trato_tarde_kg: total * payload.splitTarde,
      dieta_id: dieta.dietaId,
      preco_dieta_congelado: custoPorDieta.get(dieta.dietaId) ?? 0,
      obs: "Gerado pelo Guia de Trato",
    });
  }

  const { error: tratoErr } = await supabase
    .from("tratos_diarios")
    .upsert(tratos, { onConflict: "fazenda_id,curral_id,data" });
  if (tratoErr) return { ok: false, erro: erroAmigavel(tratoErr) };

  revalidatePath(`/${payload.fazendaCodigo.toLowerCase()}/guia-trato`);
  revalidatePath(`/${payload.fazendaCodigo.toLowerCase()}/dashboard`);
  revalidatePath(`/${payload.fazendaCodigo.toLowerCase()}/currais`);

  return { ok: true };
}
