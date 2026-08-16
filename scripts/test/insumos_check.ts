// Testa compras -> preço de vitrine, e vigência -> dieta resolvida pro Guia de
// Trato, direto no banco (bypassa RLS via service role). Usa nomes/datas
// sintéticos e limpa tudo no final.
import { supabase } from "../import/lib";

const DATA_TESTE = "2099-01-01";

// Mesma lógica de src/lib/queries/guia-trato.ts::getCurraisComDietaVigente,
// mas usando o client de service role (aquela versão usa cookies() do
// Next.js, que só funciona dentro de uma requisição real).
async function dietaVigenteDoCurral(curralId: string, data: string): Promise<string | null> {
  const { data: vigencias } = await supabase
    .from("dieta_vigencia")
    .select("data_inicio, dietas(nome)")
    .eq("curral_id", curralId)
    .lte("data_inicio", data)
    .order("data_inicio", { ascending: false })
    .limit(1);
  const nome = (vigencias?.[0]?.dietas as unknown as { nome: string } | null)?.nome;
  return nome ?? null;
}

async function testeCompraMudaPrecoDeVitrine() {
  console.log("\n== Compra muda o preço de vitrine ==");
  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();

  const { data: ingrediente, error: ingErr } = await supabase
    .from("ingredientes")
    .insert({ fazenda_id: fazenda!.id, nome: "TESTE-INSUMO-TEMP" })
    .select("id")
    .single();
  if (ingErr) throw ingErr;

  await supabase.from("compras_insumos").insert({
    fazenda_id: fazenda!.id,
    data: "2026-01-01",
    ingrediente_id: ingrediente.id,
    preco_kg: 1.0,
  });
  await supabase.from("compras_insumos").insert({
    fazenda_id: fazenda!.id,
    data: "2026-06-01",
    ingrediente_id: ingrediente.id,
    preco_kg: 2.5, // compra mais recente — deve ser o "preço atual"
  });

  const { data: precoAtual } = await supabase
    .from("v_ingrediente_preco_atual")
    .select("preco_atual")
    .eq("ingrediente_id", ingrediente.id)
    .single();
  console.log(
    `  preço atual (esperado 2.5): ${precoAtual?.preco_atual} -> ${precoAtual?.preco_atual === 2.5 ? "OK" : "FALHOU"}`,
  );

  const { data: dietaTeste } = await supabase
    .from("dietas")
    .insert({ fazenda_id: fazenda!.id, nome: "DIETA-TESTE-TEMP" })
    .select("id")
    .single();
  await supabase
    .from("dieta_ingredientes")
    .insert({ dieta_id: dietaTeste!.id, ingrediente_id: ingrediente.id, proporcao: 1 });

  const { data: custo } = await supabase
    .from("v_dieta_custo_vitrine")
    .select("custo_por_kg")
    .eq("dieta_id", dietaTeste!.id)
    .single();
  console.log(`  custo de vitrine da dieta 100% desse insumo (esperado 2.5): ${custo?.custo_por_kg} -> ${custo?.custo_por_kg === 2.5 ? "OK" : "FALHOU"}`);

  // limpeza
  await supabase.from("dieta_ingredientes").delete().eq("dieta_id", dietaTeste!.id);
  await supabase.from("dietas").delete().eq("id", dietaTeste!.id);
  await supabase.from("compras_insumos").delete().eq("ingrediente_id", ingrediente.id);
  await supabase.from("ingredientes").delete().eq("id", ingrediente.id);
  console.log("  limpo.");
}

async function testeVigenciaMudaDietaResolvida() {
  console.log("\n== Nova vigência muda a dieta resolvida pro Guia de Trato ==");
  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();

  const { data: curral } = await supabase
    .from("currais")
    .select("id")
    .eq("fazenda_id", fazenda!.id)
    .eq("codigo", "5")
    .single();

  const dietaAntes = await dietaVigenteDoCurral(curral!.id, DATA_TESTE);
  console.log(`  dieta do curral 5 antes (esperado "Descarte"): ${dietaAntes}`);

  const { data: dietaTouros } = await supabase
    .from("dietas")
    .select("id")
    .eq("fazenda_id", fazenda!.id)
    .eq("nome", "Touros")
    .single();

  const { data: vigenciaNova } = await supabase
    .from("dieta_vigencia")
    .insert({ curral_id: curral!.id, dieta_id: dietaTouros!.id, data_inicio: DATA_TESTE })
    .select("id")
    .single();

  const dietaDepois = await dietaVigenteDoCurral(curral!.id, DATA_TESTE);
  console.log(
    `  dieta do curral 5 na data de teste, depois de trocar (esperado "Touros"): ${dietaDepois} -> ${dietaDepois === "Touros" ? "OK" : "FALHOU"}`,
  );

  // confere que numa data ANTES da nova vigência a dieta antiga ainda vale
  const dietaAntesDaTroca = await dietaVigenteDoCurral(curral!.id, "2026-08-11");
  console.log(
    `  dieta do curral 5 numa data anterior (esperado "Descarte", não deve ter mudado retroativamente): ${dietaAntesDaTroca} -> ${dietaAntesDaTroca === "Descarte" ? "OK" : "FALHOU"}`,
  );

  await supabase.from("dieta_vigencia").delete().eq("id", vigenciaNova!.id);
  console.log("  limpo.");
}

async function main() {
  await testeCompraMudaPrecoDeVitrine();
  await testeVigenciaMudaDietaResolvida();
}
main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
