// Testa a apuração de venda (Etapa 8) contra os números da aba Venda_Nelore
// original (curral 4-TN, BG). Usa dados 100% SINTÉTICOS (curral/animais/tratos
// próprios, datas em 2099) em vez do lote real: o dono já fechou aquele lote
// de verdade (venda_lote real, curral 4-TN 100% vendido), então não dá mais
// pra usá-lo como fixture sem se misturar com dado real.
//
// Também simula a baixa automática de verdade (marca os animais como
// 'vendido', esvaziando o curral de teste) — foi exatamente esse cenário
// ("curral fica com 0 cabeças ativas") que expôs o bug do rateio de custo de
// ração dividindo por zero/nulo e propagando NULL pro lucro inteiro
// (corrigido em 0007_venda_rateio_fix.sql).
import { supabase } from "../import/lib";

const DATA_SAIDA = "2099-08-12";
const NUM_ANIMAIS = 29;
const PESO_ENTRADA_TOTAL = 13462;
const PESO_SAIDA_TOTAL = 16203;

function proximo(valor: number | null, esperado: number, tolerancia: number): boolean {
  if (valor === null) return false;
  return Math.abs(valor - esperado) <= tolerancia;
}

async function main() {
  console.log("\n== Apuração de venda bate com a planilha (Venda_Nelore), incl. curral esvaziado pela baixa ==");

  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();
  const { data: categoria } = await supabase.from("categorias").select("id").eq("fazenda_id", fazenda!.id).limit(1).single();

  const { data: curral, error: curralErr } = await supabase
    .from("currais")
    .insert({ fazenda_id: fazenda!.id, codigo: "TESTE-VENDA-TEMP", descricao: "sintético, teste de regressão" })
    .select("id")
    .single();
  if (curralErr) throw curralErr;
  const curralId = curral!.id as string;

  // 28 animais com 42 dias confinados + 1 com 41 dias = 1217 cab-dias, igual
  // ao "1.217 cab-dias" citado na planilha pro custo fixo.
  const pesoEntradaUnit = PESO_ENTRADA_TOTAL / NUM_ANIMAIS;
  const pesoSaidaUnit = PESO_SAIDA_TOTAL / NUM_ANIMAIS;
  const animaisRows = Array.from({ length: NUM_ANIMAIS }, (_, i) => ({
    fazenda_id: fazenda!.id,
    tipo: "individual" as const,
    categoria_id: categoria!.id,
    curral_id: curralId,
    data_entrada: i === 0 ? "2099-07-02" : "2099-07-01",
    brinco: `TESTE-VENDA-${i + 1}`,
    peso_entrada_kg: pesoEntradaUnit,
  }));
  const { data: animais, error: animaisErr } = await supabase.from("animais").insert(animaisRows).select("id");
  if (animaisErr) throw animaisErr;

  await supabase.from("pesagens").insert(
    animais!.map((a) => ({
      fazenda_id: fazenda!.id,
      animal_id: a.id,
      data: DATA_SAIDA,
      curral_id: curralId,
      peso_kg: pesoSaidaUnit,
    })),
  );

  // Um único trato cobre o custo de ração real (20138.405 na planilha).
  const { data: dieta } = await supabase.from("dietas").select("id").eq("fazenda_id", fazenda!.id).limit(1).single();
  await supabase.from("tratos_diarios").insert({
    fazenda_id: fazenda!.id,
    data: DATA_SAIDA,
    curral_id: curralId,
    trato_manha_kg: 20138.405,
    dieta_id: dieta!.id,
    preco_dieta_congelado: 1,
  });

  const { data: vendaLote, error: vendaErr } = await supabase
    .from("venda_lote")
    .insert({
      fazenda_id: fazenda!.id,
      curral_id: curralId,
      frigorifico: "PRIMA FOODS S.A. — Araguari/MG",
      nf: "NF 78727 · PR/01-239058-01",
      data_abate: "2099-08-13",
      data_saida: DATA_SAIDA,
      cabecas: NUM_ANIMAIS,
      preco_arroba: 330,
      preco_arroba_entrada: 310,
      peso_carcaca_total: 8819.5,
      deducoes: 388.06,
    })
    .select("id")
    .single();
  if (vendaErr) throw vendaErr;
  const vendaLoteId = vendaLote.id as string;

  await supabase.from("venda_item").insert(animais!.map((a) => ({ venda_lote_id: vendaLoteId, animal_id: a.id })));

  // Baixa automática de verdade — é isso que esvazia o curral e expôs o bug.
  await supabase.from("animais").update({ status: "vendido" }).in("id", animais!.map((a) => a.id));

  const { data: ap, error: apErr } = await supabase
    .from("v_venda_apuracao")
    .select("*")
    .eq("venda_lote_id", vendaLoteId)
    .single();
  if (apErr) throw apErr;

  const checks: Array<[string, number | null, number, number]> = [
    ["peso_entrada_total_kg (esperado 13462)", ap.peso_entrada_total_kg, 13462, 1],
    ["custo_entrada (esperado 139107.33)", ap.custo_entrada, 139107.33, 1],
    ["custo_racao_vendidos (esperado 20138.40, não-nulo mesmo com curral vazio)", ap.custo_racao_vendidos, 20138.4, 1],
    ["custo_fixo_vendidos (esperado 3042.50)", ap.custo_fixo_vendidos, 3042.5, 0.5],
    ["custo_total (esperado 162288.24)", ap.custo_total, 162288.24, 2],
    ["valor_liquido (esperado 193640.94)", ap.valor_liquido, 193640.94, 1],
    ["lucro_lote (esperado 31352.70)", ap.lucro_lote, 31352.7, 3],
    ["lucro_por_cab (esperado 1081.13)", ap.lucro_por_cab, 1081.13, 1],
    ["margem (esperado 0.162)", ap.margem, 0.162, 0.002],
    ["roi (esperado 0.193)", ap.roi, 0.193, 0.002],
    ["custo_arroba_total (esperado 166.49)", ap.custo_arroba_total, 166.49, 1],
  ];

  let falhas = 0;
  for (const [label, valor, esperado, tolerancia] of checks) {
    const passou = proximo(valor, esperado, tolerancia);
    if (!passou) falhas++;
    console.log(`  ${label}: ${valor} -> ${passou ? "OK" : "FALHOU"}`);
  }

  await supabase.from("venda_item").delete().eq("venda_lote_id", vendaLoteId);
  await supabase.from("venda_lote").delete().eq("id", vendaLoteId);
  await supabase.from("tratos_diarios").delete().eq("curral_id", curralId);
  await supabase.from("pesagens").delete().in("animal_id", animais!.map((a) => a.id));
  await supabase.from("animais").delete().in("id", animais!.map((a) => a.id));
  await supabase.from("currais").delete().eq("id", curralId);
  console.log("  limpo (tudo sintético; nenhum dado real da fazenda foi tocado).");

  if (falhas > 0) {
    throw new Error(`${falhas} verificação(ões) falharam.`);
  }
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
