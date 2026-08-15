import { supabase } from "./lib";

/** Apaga todos os dados de uma fazenda (por código) para permitir reimportar do zero. */
export async function resetFazenda(codigo: string): Promise<void> {
  const { data: fazenda } = await supabase
    .from("fazendas")
    .select("id")
    .eq("codigo", codigo)
    .maybeSingle();

  if (!fazenda) return;
  const fazendaId = fazenda.id as string;

  const { data: currais } = await supabase.from("currais").select("id").eq("fazenda_id", fazendaId);
  const curralIds = (currais ?? []).map((c) => c.id as string);

  const { data: dietas } = await supabase.from("dietas").select("id").eq("fazenda_id", fazendaId);
  const dietaIds = (dietas ?? []).map((d) => d.id as string);

  const { data: guias } = await supabase.from("guia_trato").select("id").eq("fazenda_id", fazendaId);
  const guiaIds = (guias ?? []).map((g) => g.id as string);

  const { data: vendas } = await supabase.from("venda_lote").select("id").eq("fazenda_id", fazendaId);
  const vendaIds = (vendas ?? []).map((v) => v.id as string);

  if (curralIds.length) await supabase.from("dieta_vigencia").delete().in("curral_id", curralIds);
  if (dietaIds.length) await supabase.from("dieta_ingredientes").delete().in("dieta_id", dietaIds);
  if (guiaIds.length) await supabase.from("guia_trato_curral").delete().in("guia_trato_id", guiaIds);
  if (vendaIds.length) await supabase.from("venda_item").delete().in("venda_lote_id", vendaIds);

  await supabase.from("tratos_diarios").delete().eq("fazenda_id", fazendaId);
  await supabase.from("pesagens").delete().eq("fazenda_id", fazendaId);
  await supabase.from("animais").delete().eq("fazenda_id", fazendaId);
  await supabase.from("compras_insumos").delete().eq("fazenda_id", fazendaId);
  await supabase.from("guia_trato").delete().eq("fazenda_id", fazendaId);
  await supabase.from("venda_lote").delete().eq("fazenda_id", fazendaId);
  await supabase.from("dietas").delete().eq("fazenda_id", fazendaId);
  await supabase.from("ingredientes").delete().eq("fazenda_id", fazendaId);
  await supabase.from("categorias").delete().eq("fazenda_id", fazendaId);
  await supabase.from("currais").delete().eq("fazenda_id", fazendaId);
  await supabase.from("parametros").delete().eq("fazenda_id", fazendaId);
  await supabase.from("fazendas").delete().eq("id", fazendaId);
}
