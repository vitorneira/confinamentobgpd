"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurraisComDietaVigente } from "@/lib/queries/guia-trato";
import { erroAmigavel } from "@/lib/erros";

function revalidarGuiaTrato(fazendaCodigo: string) {
  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/guia-trato`);
  revalidatePath(`${base}/guia-trato/confirmacao`);
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/currais`);
}

export type CurralPayload = {
  curralId: string;
  totalDiaKg: number;
  ajustePct: number;
  ajusteKg: number;
};

export type SalvarPlanoPayload = {
  fazendaCodigo: string;
  fazendaId: string;
  data: string;
  capacidadeVagao: number;
  splitManha: number;
  splitAlmoco: number;
  splitTarde: number;
  currais: CurralPayload[];
};

/**
 * Só grava o PLANO do dia (guia_trato/guia_trato_curral) — não mexe em
 * tratos_diarios, então não gera custo. Quem gera custo é confirmarTratoCurral,
 * curral por curral, na tela de confirmação (podendo editar o kg antes).
 */
export async function salvarPlano(
  payload: SalvarPlanoPayload,
): Promise<{ ok: boolean; erro?: string; guiaTratoId?: string }> {
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

  revalidarGuiaTrato(payload.fazendaCodigo);
  return { ok: true, guiaTratoId: guia.id as string };
}

/**
 * Confirma o trato de UM curral numa data — aí sim grava/atualiza
 * tratos_diarios (custo real, preço da dieta congelado na hora). totalKg pode
 * vir diferente do planejado (o gestor editou antes de confirmar).
 */
export async function confirmarTratoCurral(
  fazendaCodigo: string,
  fazendaId: string,
  input: { curralId: string; data: string; totalKg: number },
): Promise<{ ok: boolean; erro?: string }> {
  if (input.totalKg < 0) return { ok: false, erro: "Quantidade não pode ser negativa." };

  const supabase = await createClient();

  const { data: guia } = await supabase
    .from("guia_trato")
    .select("split_manha, split_almoco, split_tarde")
    .eq("fazenda_id", fazendaId)
    .eq("data", input.data)
    .maybeSingle();
  if (!guia) return { ok: false, erro: `Sem plano salvo para ${input.data} — salve o plano do dia antes de confirmar.` };

  const curraisComDieta = await getCurraisComDietaVigente(fazendaId, input.data);
  const dieta = curraisComDieta.find((c) => c.curralId === input.curralId);
  if (!dieta?.dietaId) {
    return { ok: false, erro: `Curral sem dieta vigente em ${input.data} — cadastre a vigência antes.` };
  }

  const { data: custoVitrine, error: custoErr } = await supabase
    .from("v_dieta_custo_vitrine")
    .select("custo_por_kg")
    .eq("dieta_id", dieta.dietaId)
    .maybeSingle();
  if (custoErr) return { ok: false, erro: erroAmigavel(custoErr) };

  const { error: tratoErr } = await supabase.from("tratos_diarios").upsert(
    {
      fazenda_id: fazendaId,
      data: input.data,
      curral_id: input.curralId,
      trato_manha_kg: input.totalKg * guia.split_manha,
      trato_almoco_kg: input.totalKg * guia.split_almoco,
      trato_tarde_kg: input.totalKg * guia.split_tarde,
      dieta_id: dieta.dietaId,
      preco_dieta_congelado: custoVitrine?.custo_por_kg ?? 0,
      obs: "Confirmado no Guia de Trato",
    },
    { onConflict: "fazenda_id,curral_id,data" },
  );
  if (tratoErr) return { ok: false, erro: erroAmigavel(tratoErr) };

  revalidarGuiaTrato(fazendaCodigo);
  return { ok: true };
}

/**
 * Salva a divisão de kg por vagão quando o gestor edita a sugestão
 * balanceada. Precisa fechar com o total esperado daquele horário/dieta —
 * senão o kg some ou sobra sem virar trato de ninguém.
 */
export async function salvarVagoes(
  fazendaCodigo: string,
  input: {
    guiaTratoId: string;
    dietaId: string;
    horario: "manha" | "almoco" | "tarde";
    cargas: number[];
    totalEsperado: number;
  },
): Promise<{ ok: boolean; erro?: string }> {
  const soma = input.cargas.reduce((acc, v) => acc + v, 0);
  if (Math.abs(soma - input.totalEsperado) > 0.5) {
    return {
      ok: false,
      erro: `A soma dos vagões (${soma.toFixed(1)} kg) precisa fechar com o total devido (${input.totalEsperado.toFixed(1)} kg).`,
    };
  }
  if (input.cargas.some((v) => v < 0)) {
    return { ok: false, erro: "Carga do vagão não pode ser negativa." };
  }

  const supabase = await createClient();

  const { error: delErr } = await supabase
    .from("guia_trato_vagao")
    .delete()
    .eq("guia_trato_id", input.guiaTratoId)
    .eq("dieta_id", input.dietaId)
    .eq("horario", input.horario);
  if (delErr) return { ok: false, erro: erroAmigavel(delErr) };

  if (input.cargas.length > 0) {
    const { error: insErr } = await supabase.from("guia_trato_vagao").insert(
      input.cargas.map((carga, vagao_index) => ({
        guia_trato_id: input.guiaTratoId,
        dieta_id: input.dietaId,
        horario: input.horario,
        vagao_index,
        carga_kg: carga,
      })),
    );
    if (insErr) return { ok: false, erro: erroAmigavel(insErr) };
  }

  revalidarGuiaTrato(fazendaCodigo);
  return { ok: true };
}
