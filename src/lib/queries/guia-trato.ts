import { createClient } from "@/lib/supabase/server";
import { totalAjustado } from "@/lib/guia-trato/balanceamento";
import { compararCodigo } from "@/lib/format";

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
    .eq("fazenda_id", fazendaId);
  const curraisOrdenados = [...(currais ?? [])].sort((a, b) =>
    compararCodigo(a.codigo as string, b.codigo as string),
  );

  const curralIds = curraisOrdenados.map((c) => c.id as string);
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

  return curraisOrdenados.map((c) => ({
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

export type ItemConfirmacao = {
  data: string;
  curralId: string;
  curralCodigo: string;
  dietaNome: string | null;
  kgPlanejado: number;
  kgConfirmado: number | null;
  confirmado: boolean;
};

/**
 * Curral/dia planejados (guia_trato_curral), cruzados com o trato já
 * confirmado (tratos_diarios) daquele curral/dia — "confirmado" não tem
 * coluna própria, é só o trato existir ou não pra aquele par.
 */
export async function getItensConfirmacao(
  fazendaId: string,
  filtros: { curralId?: string; dataInicio?: string; dataFim?: string },
): Promise<ItemConfirmacao[]> {
  const supabase = await createClient();

  let guiaQuery = supabase
    .from("guia_trato")
    .select("id, data")
    .eq("fazenda_id", fazendaId)
    .order("data", { ascending: false });
  if (filtros.dataInicio) guiaQuery = guiaQuery.gte("data", filtros.dataInicio);
  if (filtros.dataFim) guiaQuery = guiaQuery.lte("data", filtros.dataFim);
  const { data: guias } = await guiaQuery;
  if (!guias || guias.length === 0) return [];

  const guiaPorId = new Map(guias.map((g) => [g.id as string, g.data as string]));
  const guiaIds = guias.map((g) => g.id as string);
  const datas = [...new Set(guias.map((g) => g.data as string))];

  let curralQuery = supabase
    .from("guia_trato_curral")
    .select("guia_trato_id, curral_id, total_dia_kg, ajuste_pct, ajuste_kg, currais(codigo)")
    .in("guia_trato_id", guiaIds);
  if (filtros.curralId) curralQuery = curralQuery.eq("curral_id", filtros.curralId);
  const { data: porCurral } = await curralQuery;
  if (!porCurral || porCurral.length === 0) return [];

  const curralIds = [...new Set(porCurral.map((p) => p.curral_id as string))];

  const { data: tratos } = await supabase
    .from("tratos_diarios")
    .select("curral_id, data, trato_manha_kg, trato_almoco_kg, trato_tarde_kg, dietas(nome)")
    .eq("fazenda_id", fazendaId)
    .in("curral_id", curralIds)
    .in("data", datas);
  const tratoPorChave = new Map((tratos ?? []).map((t) => [`${t.curral_id}|${t.data}`, t]));

  // dieta vigente por (data, curral) pra exibir enquanto não foi confirmado
  const dietaPorDataCurral = new Map<string, string | null>();
  for (const data of datas) {
    const currais = await getCurraisComDietaVigente(fazendaId, data);
    for (const c of currais) dietaPorDataCurral.set(`${c.curralId}|${data}`, c.dietaNome);
  }

  return porCurral
    .map((p) => {
      const data = guiaPorId.get(p.guia_trato_id as string)!;
      const chave = `${p.curral_id}|${data}`;
      const trato = tratoPorChave.get(chave);
      return {
        data,
        curralId: p.curral_id as string,
        curralCodigo: (p.currais as unknown as { codigo: string } | null)?.codigo ?? "?",
        dietaNome: trato
          ? ((trato.dietas as unknown as { nome: string } | null)?.nome ?? null)
          : (dietaPorDataCurral.get(chave) ?? null),
        kgPlanejado: totalAjustado(p.total_dia_kg as number, p.ajuste_pct as number, p.ajuste_kg as number),
        kgConfirmado: trato
          ? Number(trato.trato_manha_kg) + Number(trato.trato_almoco_kg) + Number(trato.trato_tarde_kg)
          : null,
        confirmado: !!trato,
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data) || compararCodigo(a.curralCodigo, b.curralCodigo));
}

export type VagaoSalvo = { dietaId: string; horario: "manha" | "almoco" | "tarde"; cargas: number[] };

export async function getVagoesSalvos(guiaTratoId: string): Promise<VagaoSalvo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guia_trato_vagao")
    .select("dieta_id, horario, vagao_index, carga_kg")
    .eq("guia_trato_id", guiaTratoId)
    .order("vagao_index");

  const porChave = new Map<string, VagaoSalvo>();
  for (const row of data ?? []) {
    const chave = `${row.dieta_id}|${row.horario}`;
    const entrada = porChave.get(chave) ?? {
      dietaId: row.dieta_id as string,
      horario: row.horario as "manha" | "almoco" | "tarde",
      cargas: [],
    };
    entrada.cargas[row.vagao_index as number] = row.carga_kg as number;
    porChave.set(chave, entrada);
  }
  return [...porChave.values()];
}
