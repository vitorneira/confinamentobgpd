import { createClient } from "@/lib/supabase/server";

export type CurralComDieta = {
  curralId: string;
  curralCodigo: string;
  dietaId: string | null;
  dietaNome: string | null;
};

/** Dieta vigente de cada curral na data informada (dieta_vigencia mais recente <= data). */
export async function getCurraisComDietaVigente(
  fazendaId: string,
  data: string,
): Promise<CurralComDieta[]> {
  const supabase = await createClient();
  const { data: currais } = await supabase
    .from("currais")
    .select("id, codigo")
    .eq("fazenda_id", fazendaId)
    .order("codigo");

  const curralIds = (currais ?? []).map((c) => c.id as string);
  if (curralIds.length === 0) return [];

  const { data: vigencias } = await supabase
    .from("dieta_vigencia")
    .select("curral_id, data_inicio, dietas(id, nome)")
    .in("curral_id", curralIds)
    .lte("data_inicio", data)
    .order("data_inicio", { ascending: false });

  const dietaPorCurral = new Map<string, { id: string; nome: string }>();
  for (const v of vigencias ?? []) {
    if (dietaPorCurral.has(v.curral_id as string)) continue;
    const dieta = v.dietas as unknown as { id: string; nome: string } | null;
    if (dieta) dietaPorCurral.set(v.curral_id as string, dieta);
  }

  return (currais ?? []).map((c) => ({
    curralId: c.id as string,
    curralCodigo: c.codigo as string,
    dietaId: dietaPorCurral.get(c.id as string)?.id ?? null,
    dietaNome: dietaPorCurral.get(c.id as string)?.nome ?? null,
  }));
}

export type GuiaExistente = {
  id: string;
  capacidadeVagao: number;
  splitManha: number;
  splitAlmoco: number;
  splitTarde: number;
  porCurral: Map<string, { totalDiaKg: number; ajustePct: number; ajusteKg: number }>;
};

export async function getGuiaTrato(fazendaId: string, data: string): Promise<GuiaExistente | null> {
  const supabase = await createClient();
  const { data: guia } = await supabase
    .from("guia_trato")
    .select("id, capacidade_vagao, split_manha, split_almoco, split_tarde")
    .eq("fazenda_id", fazendaId)
    .eq("data", data)
    .maybeSingle();
  if (!guia) return null;

  const { data: porCurral } = await supabase
    .from("guia_trato_curral")
    .select("curral_id, total_dia_kg, ajuste_pct, ajuste_kg")
    .eq("guia_trato_id", guia.id);

  return {
    id: guia.id,
    capacidadeVagao: guia.capacidade_vagao,
    splitManha: guia.split_manha,
    splitAlmoco: guia.split_almoco,
    splitTarde: guia.split_tarde,
    porCurral: new Map(
      (porCurral ?? []).map((p) => [
        p.curral_id as string,
        { totalDiaKg: p.total_dia_kg, ajustePct: p.ajuste_pct, ajusteKg: p.ajuste_kg },
      ]),
    ),
  };
}

/** Guia mais recente da fazenda antes da data — usado só pra pré-preencher um dia novo. */
export async function getUltimoGuiaAntesDe(
  fazendaId: string,
  data: string,
): Promise<GuiaExistente | null> {
  const supabase = await createClient();
  const { data: guia } = await supabase
    .from("guia_trato")
    .select("id, data, capacidade_vagao, split_manha, split_almoco, split_tarde")
    .eq("fazenda_id", fazendaId)
    .lt("data", data)
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!guia) return null;
  return getGuiaTrato(fazendaId, guia.data as string);
}
