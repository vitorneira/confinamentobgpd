// Testa a apuração de venda (Etapa 8) contra o fechamento real do lote de
// touros Nelore da BG (aba Venda_Nelore, curral 4-TN), sem tocar animais.status
// nem "vender" o lote de verdade: insere venda_lote/venda_item, lê a view,
// confere contra os números da planilha original e desfaz tudo no final.
import { supabase } from "../import/lib";

function proximo(valor: number | null, esperado: number, tolerancia: number): boolean {
  if (valor === null) return false;
  return Math.abs(valor - esperado) <= tolerancia;
}

async function main() {
  console.log("\n== Fechamento do lote Nelore (curral 4-TN, BG) bate com a planilha ==");

  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();
  const { data: curral } = await supabase
    .from("currais")
    .select("id")
    .eq("fazenda_id", fazenda!.id)
    .eq("codigo", "4-TN")
    .single();

  const { data: animais } = await supabase
    .from("animais")
    .select("id")
    .eq("curral_id", curral!.id)
    .eq("status", "ativo");
  if (!animais || animais.length !== 29) {
    throw new Error(`Esperava 29 animais ativos no curral 4-TN, achei ${animais?.length ?? 0}. Abortando teste.`);
  }

  const { data: vendaLote, error: vendaErr } = await supabase
    .from("venda_lote")
    .insert({
      fazenda_id: fazenda!.id,
      curral_id: curral!.id,
      frigorifico: "PRIMA FOODS S.A. — Araguari/MG",
      nf: "NF 78727 · PR/01-239058-01",
      data_abate: "2026-08-13",
      data_saida: "2026-08-12",
      cabecas: 29,
      preco_arroba: 330,
      preco_arroba_entrada: 310,
      peso_carcaca_total: 8819.5,
      deducoes: 388.06,
    })
    .select("id")
    .single();
  if (vendaErr) throw vendaErr;
  const vendaLoteId = vendaLote.id as string;

  const { error: itensErr } = await supabase
    .from("venda_item")
    .insert(animais.map((a) => ({ venda_lote_id: vendaLoteId, animal_id: a.id })));
  if (itensErr) throw itensErr;

  const { data: ap, error: apErr } = await supabase
    .from("v_venda_apuracao")
    .select("*")
    .eq("venda_lote_id", vendaLoteId)
    .single();
  if (apErr) throw apErr;

  const checks: Array<[string, number | null, number, number]> = [
    ["peso_entrada_total_kg (esperado 13462)", ap.peso_entrada_total_kg, 13462, 1],
    ["custo_entrada (esperado 139107.33)", ap.custo_entrada, 139107.33, 1],
    ["custo_racao_vendidos (esperado 20138.40)", ap.custo_racao_vendidos, 20138.4, 1],
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
  console.log("  limpo (venda_lote/venda_item de teste removidos; animais não foram alterados).");

  if (falhas > 0) {
    throw new Error(`${falhas} verificação(ões) falharam.`);
  }
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
