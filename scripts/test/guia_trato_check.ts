// Testa a lógica do Guia de Trato (balanceamento + upsert de tratos_diarios)
// direto no banco, sem passar pela server action (que depende de cookies() do
// Next.js). Usa uma data sintética futura só pra não mexer nos dados reais, e
// limpa tudo no final.
import { supabase } from "../import/lib";
import { calcularBalanceamento, totalAjustado, type CurralAjuste } from "../../src/lib/guia-trato/balanceamento";

const DATA_TESTE = "2099-01-01";

async function confirmarGuiaTeste(fazendaId: string, currais: CurralAjuste[], capacidade: number, splits: { manha: number; almoco: number; tarde: number }) {
  const { data: guia, error: guiaErr } = await supabase
    .from("guia_trato")
    .upsert(
      {
        fazenda_id: fazendaId,
        data: DATA_TESTE,
        capacidade_vagao: capacidade,
        split_manha: splits.manha,
        split_almoco: splits.almoco,
        split_tarde: splits.tarde,
      },
      { onConflict: "fazenda_id,data" },
    )
    .select("id")
    .single();
  if (guiaErr) throw guiaErr;

  const { error: curralErr } = await supabase.from("guia_trato_curral").upsert(
    currais.map((c) => ({
      guia_trato_id: guia.id,
      curral_id: c.curralId,
      total_dia_kg: c.totalDiaKg,
      ajuste_pct: c.ajustePct,
      ajuste_kg: c.ajusteKg,
    })),
    { onConflict: "guia_trato_id,curral_id" },
  );
  if (curralErr) throw curralErr;

  const { data: custos } = await supabase
    .from("v_dieta_custo_vitrine")
    .select("dieta_id, custo_por_kg")
    .in(
      "dieta_id",
      [...new Set(currais.map((c) => c.dietaId))],
    );
  const custoPorDieta = new Map((custos ?? []).map((c) => [c.dieta_id as string, c.custo_por_kg as number]));

  const tratos = currais.map((c) => {
    const total = totalAjustado(c.totalDiaKg, c.ajustePct, c.ajusteKg);
    return {
      fazenda_id: fazendaId,
      data: DATA_TESTE,
      curral_id: c.curralId,
      trato_manha_kg: total * splits.manha,
      trato_almoco_kg: total * splits.almoco,
      trato_tarde_kg: total * splits.tarde,
      dieta_id: c.dietaId,
      preco_dieta_congelado: custoPorDieta.get(c.dietaId) ?? 0,
      obs: "TESTE",
    };
  });

  const { error: tratoErr } = await supabase
    .from("tratos_diarios")
    .upsert(tratos, { onConflict: "fazenda_id,curral_id,data" });
  if (tratoErr) throw tratoErr;

  return guia.id as string;
}

async function main() {
  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();
  const fazendaId = fazenda!.id as string;

  const { data: curraisRaw } = await supabase.from("currais").select("id, codigo").eq("fazenda_id", fazendaId);
  const { data: vigencias } = await supabase
    .from("dieta_vigencia")
    .select("curral_id, data_inicio, dietas(id, nome)")
    .in("curral_id", (curraisRaw ?? []).map((c) => c.id))
    .order("data_inicio", { ascending: false });
  const dietaPorCurral = new Map<string, { id: string; nome: string }>();
  for (const v of vigencias ?? []) {
    if (dietaPorCurral.has(v.curral_id as string)) continue;
    const d = v.dietas as unknown as { id: string; nome: string } | null;
    if (d) dietaPorCurral.set(v.curral_id as string, d);
  }

  const currais: CurralAjuste[] = (curraisRaw ?? [])
    .filter((c) => dietaPorCurral.has(c.id as string))
    .map((c) => {
      const d = dietaPorCurral.get(c.id as string)!;
      return {
        curralId: c.id as string,
        curralCodigo: c.codigo as string,
        dietaId: d.id,
        dietaNome: d.nome,
        totalDiaKg: 1000,
        ajustePct: 0,
        ajusteKg: 0,
      };
    });

  console.log(`Currais de teste (BG, com dieta vigente): ${currais.map((c) => c.curralCodigo).join(", ")}`);

  const bal = calcularBalanceamento(currais, { manha: 0.4, almoco: 0.2, tarde: 0.4 }, 2200);
  console.log("\nBalanceamento (todos com 1000kg base, 4 dietas separadas):");
  for (const h of bal.porHorario) {
    console.log(`  ${h.horario}: total=${h.totalKg.toFixed(1)}kg, viagens no total=${h.numVagoesTotal}`);
    for (const g of h.grupos) {
      console.log(
        `    dieta ${g.dietaNome} (currais ${g.curraisCodigos.join(",")}): total=${g.totalKg.toFixed(1)}kg, vagões=${g.numVagoes}, carga/vagão=${g.cargaPorVagao.toFixed(1)}kg, aproveitamento=${(g.aproveitamento * 100).toFixed(1)}%`,
      );
    }
  }

  console.log("\n1ª confirmação (1000kg por curral)...");
  const guiaId = await confirmarGuiaTeste(fazendaId, currais, 2200, { manha: 0.4, almoco: 0.2, tarde: 0.4 });
  const { count: countApos1 } = await supabase
    .from("tratos_diarios")
    .select("*", { count: "exact", head: true })
    .eq("fazenda_id", fazendaId)
    .eq("data", DATA_TESTE);
  console.log(`  tratos_diarios criados: ${countApos1} (esperado ${currais.length})`);

  console.log("\n2ª confirmação (2000kg por curral) — reconfirmando o mesmo dia...");
  const currais2 = currais.map((c) => ({ ...c, totalDiaKg: 2000 }));
  await confirmarGuiaTeste(fazendaId, currais2, 2200, { manha: 0.4, almoco: 0.2, tarde: 0.4 });
  const { count: countApos2, data: tratosApos2 } = await supabase
    .from("tratos_diarios")
    .select("trato_manha_kg", { count: "exact" })
    .eq("fazenda_id", fazendaId)
    .eq("data", DATA_TESTE);
  console.log(`  tratos_diarios após reconfirmar: ${countApos2} (esperado ${currais.length}, sem duplicar)`);
  const manhaEsperado = 2000 * 0.4;
  const bateu = (tratosApos2 ?? []).every((t) => Math.abs(Number(t.trato_manha_kg) - manhaEsperado) < 0.01);
  console.log(`  valores atualizados pra 2000kg (não ficou com o valor antigo): ${bateu ? "OK" : "FALHOU"}`);

  console.log("\nLimpando dados de teste...");
  await supabase.from("tratos_diarios").delete().eq("fazenda_id", fazendaId).eq("data", DATA_TESTE);
  await supabase.from("guia_trato_curral").delete().eq("guia_trato_id", guiaId);
  await supabase.from("guia_trato").delete().eq("id", guiaId);
  console.log("Limpo.");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
