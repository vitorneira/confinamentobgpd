// Testa o novo fluxo em duas etapas do Guia de Trato: salvar plano NÃO cria
// custo; confirmar (por curral/data) sim. E a tabela guia_trato_vagao
// (kg por vagão editado manualmente). Direto no banco (bypassa RLS via
// service role, como os outros _check.ts), data sintética futura, limpa tudo.
import { supabase } from "../import/lib";

const DATA_TESTE = "2099-02-01";

async function testeFluxoDuasEtapas() {
  console.log("\n== Salvar plano não cria trato; confirmar sim (e guia_trato_vagao persiste) ==");

  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();
  const fazendaId = fazenda!.id as string;

  const { data: curral } = await supabase.from("currais").select("id, codigo").eq("fazenda_id", fazendaId).eq("codigo", "3").single();
  const { data: dietaVig } = await supabase
    .from("dieta_vigencia")
    .select("dieta_id, dietas(nome)")
    .eq("curral_id", curral!.id)
    .lte("data_inicio", DATA_TESTE)
    .order("data_inicio", { ascending: false })
    .limit(1)
    .single();
  const dietaId = dietaVig!.dieta_id as string;

  // 1) salva o plano (equivalente a salvarPlano) — sem tocar tratos_diarios
  const { data: guia } = await supabase
    .from("guia_trato")
    .upsert(
      { fazenda_id: fazendaId, data: DATA_TESTE, capacidade_vagao: 2200, split_manha: 0.4, split_almoco: 0.2, split_tarde: 0.4 },
      { onConflict: "fazenda_id,data" },
    )
    .select("id")
    .single();
  const guiaTratoId = guia!.id as string;
  await supabase
    .from("guia_trato_curral")
    .upsert({ guia_trato_id: guiaTratoId, curral_id: curral!.id, total_dia_kg: 1000, ajuste_pct: 0, ajuste_kg: 0 }, { onConflict: "guia_trato_id,curral_id" });

  const { count: tratosDepoisDoPlano } = await supabase
    .from("tratos_diarios")
    .select("*", { count: "exact", head: true })
    .eq("fazenda_id", fazendaId)
    .eq("curral_id", curral!.id)
    .eq("data", DATA_TESTE);
  console.log(`  tratos_diarios após salvar plano (esperado 0 — "pendente"): ${tratosDepoisDoPlano} -> ${tratosDepoisDoPlano === 0 ? "OK" : "FALHOU"}`);

  // 2) guia_trato_vagao — kg por vagão editado manualmente
  const { error: vagaoErr } = await supabase.from("guia_trato_vagao").insert([
    { guia_trato_id: guiaTratoId, dieta_id: dietaId, horario: "manha", vagao_index: 0, carga_kg: 300 },
    { guia_trato_id: guiaTratoId, dieta_id: dietaId, horario: "manha", vagao_index: 1, carga_kg: 100 },
  ]);
  const { data: vagoesLidos } = await supabase
    .from("guia_trato_vagao")
    .select("vagao_index, carga_kg")
    .eq("guia_trato_id", guiaTratoId)
    .order("vagao_index");
  const vagoesOk = !vagaoErr && vagoesLidos?.length === 2 && Number(vagoesLidos[0].carga_kg) === 300 && Number(vagoesLidos[1].carga_kg) === 100;
  console.log(`  guia_trato_vagao grava e lê de volta (300+100): ${vagoesOk ? "OK" : "FALHOU"}`);

  // 3) confirma o trato desse curral/data (equivalente a confirmarTratoCurral)
  const { data: custoVitrine } = await supabase.from("v_dieta_custo_vitrine").select("custo_por_kg").eq("dieta_id", dietaId).single();
  await supabase.from("tratos_diarios").upsert(
    {
      fazenda_id: fazendaId,
      data: DATA_TESTE,
      curral_id: curral!.id,
      trato_manha_kg: 1000 * 0.4,
      trato_almoco_kg: 1000 * 0.2,
      trato_tarde_kg: 1000 * 0.4,
      dieta_id: dietaId,
      preco_dieta_congelado: custoVitrine?.custo_por_kg ?? 0,
      obs: "TESTE confirmação",
    },
    { onConflict: "fazenda_id,curral_id,data" },
  );

  const { data: tratoConfirmado } = await supabase
    .from("tratos_diarios")
    .select("trato_manha_kg, trato_almoco_kg, trato_tarde_kg")
    .eq("fazenda_id", fazendaId)
    .eq("curral_id", curral!.id)
    .eq("data", DATA_TESTE)
    .single();
  const kgConfirmado = tratoConfirmado
    ? Number(tratoConfirmado.trato_manha_kg) + Number(tratoConfirmado.trato_almoco_kg) + Number(tratoConfirmado.trato_tarde_kg)
    : null;
  console.log(`  trato confirmado (esperado 1000, "confirmado" = existe): ${kgConfirmado} -> ${kgConfirmado === 1000 ? "OK" : "FALHOU"}`);

  await supabase.from("tratos_diarios").delete().eq("fazenda_id", fazendaId).eq("curral_id", curral!.id).eq("data", DATA_TESTE);
  await supabase.from("guia_trato_vagao").delete().eq("guia_trato_id", guiaTratoId);
  await supabase.from("guia_trato_curral").delete().eq("guia_trato_id", guiaTratoId);
  await supabase.from("guia_trato").delete().eq("id", guiaTratoId);
  console.log("  limpo.");

  return tratosDepoisDoPlano === 0 && vagoesOk && kgConfirmado === 1000;
}

async function main() {
  const okFluxo = await testeFluxoDuasEtapas();
  if (!okFluxo) throw new Error("Alguma verificação falhou.");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
