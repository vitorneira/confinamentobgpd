import { supabase } from "../import/lib";
import { calcularFazendaRollup } from "../../src/lib/kpi/fazenda-rollup";
import type { CurralIndicadores, Parametros } from "../../src/lib/kpi/types";

let falhas = 0;
let checagens = 0;

function checar(label: string, atual: number | null, esperado: number, tolerancia = 0.05) {
  checagens++;
  if (atual === null) {
    falhas++;
    console.log(`  ✗ ${label}: atual=null, esperado=${esperado}`);
    return;
  }
  const diff = Math.abs(atual - esperado);
  const ok = diff <= tolerancia;
  if (!ok) falhas++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${label}: atual=${atual.toFixed(4)}, esperado=${esperado.toFixed(4)}${ok ? "" : ` (diff=${diff.toFixed(4)})`}`,
  );
}

async function testeCustoRealPorCurral() {
  console.log("\n== Custo real acumulado por curral (BG) — vs Custo_Nutricao_Lote.xlsx ==");
  const esperados: Record<string, number> = {
    "2": 18766.109999999997,
    "3": 17164.125000000007,
    "4": 45923.35500000003,
    "4-TN": 20138.40499999998,
  };
  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();
  const { data: rows, error } = await supabase
    .from("v_curral_indicadores")
    .select("codigo, custo_racao_acumulado")
    .eq("fazenda_id", fazenda!.id);
  if (error) throw error;
  for (const [codigo, esperado] of Object.entries(esperados)) {
    const row = rows!.find((r) => r.codigo === codigo);
    checar(`custo_racao_acumulado curral ${codigo}`, row?.custo_racao_acumulado ?? null, esperado, 1);
  }
}

async function testeCustoCabDiaMedio() {
  console.log("\n== Custo/cab/dia médio (BG) — vs Custo_Diario_Cab.xlsx ==");
  const esperados: Record<string, number> = {
    "2": 14.109857142857141,
    "3": 10.660947204968949,
    "4": 7.136496503496509,
    "4-TN": 16.149482758620675,
  };
  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();
  const { data: rows, error } = await supabase
    .from("v_curral_indicadores")
    .select("codigo, custo_cab_dia_medio_racao")
    .eq("fazenda_id", fazenda!.id);
  if (error) throw error;
  for (const [codigo, esperado] of Object.entries(esperados)) {
    const row = rows!.find((r) => r.codigo === codigo);
    checar(`custo_cab_dia_medio curral ${codigo}`, row?.custo_cab_dia_medio_racao ?? null, esperado, 0.01);
  }
}

async function testeArrobaVivaTotal() {
  // Não usamos o "@ Total"/"@ em Estoque" do Excel original como referência aqui:
  // aquelas colunas usam peso × rendimento ÷ 15 (fórmula de carcaça), que a revisão
  // de KPIs decidiu abandonar (ver CLAUDE.md). O esperado abaixo é peso vivo total
  // (que bate com "Peso Total Atual"/"Peso vivo total atual" do Excel) ÷ 30.
  console.log("\n== @ viva total do rebanho (peso vivo ÷ 30) — vs Peso Total Atual.xlsx ==");
  const esperados: Record<string, number> = { BG: 134331 / 30, PD: 258734 / 30 };
  for (const [codigo, esperado] of Object.entries(esperados)) {
    const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", codigo).single();
    const { data: rows, error } = await supabase
      .from("v_curral_indicadores")
      .select("arroba_viva_total")
      .eq("fazenda_id", fazenda!.id);
    if (error) throw error;
    const total = rows!.reduce((acc, r) => acc + Number(r.arroba_viva_total ?? 0), 0);
    checar(`@ viva total ${codigo}`, total, esperado, 0.5);
  }
}

async function testeGmdConsistenciaGeral() {
  console.log("\n== Consistência do GMD por animal (recálculo manual vs view) ==");
  const { data: animais, error } = await supabase
    .from("v_animal_indicadores")
    .select("animal_id, fazenda_id, data_entrada, peso_entrada_kg, data_ultima_pesagem, peso_atual_kg, gmd_valido, gmd_kg_dia")
    .eq("gmd_valido", true);
  if (error) throw error;

  let divergentes = 0;
  for (const a of animais ?? []) {
    const dias =
      (new Date(a.data_ultima_pesagem as string).getTime() - new Date(a.data_entrada as string).getTime()) /
      86400000;
    const esperado = (Number(a.peso_atual_kg) - Number(a.peso_entrada_kg)) / dias;
    const atual = Number(a.gmd_kg_dia);
    if (Math.abs(atual - esperado) > 0.001) {
      divergentes++;
      console.log(`  ✗ animal ${a.animal_id}: view=${atual}, manual=${esperado}`);
    }
  }
  checagens++;
  if (divergentes > 0) {
    falhas++;
    console.log(`  ✗ ${divergentes} de ${animais?.length} animais com GMD divergente`);
  } else {
    console.log(`  ✓ todos os ${animais?.length} animais com GMD válido batem com o recálculo manual`);
  }
}

async function testeEstoque() {
  // dias_de_estoque é uma projeção (taxa recente de consumo real) — pequena
  // diferença do Excel é esperada, já que ele usa o consumo PLANEJADO do dia
  // (Guia de Trato), que só existe a partir da Etapa 5. estoque_atual_kg é fato
  // (base + compras − consumo reais) e deve bater exato.
  console.log("\n== Estoque de insumos (PD) — vs Estoque_Insumos.xlsx ==");
  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "PD").single();
  const { data: rows, error } = await supabase
    .from("v_ingrediente_estoque_completo")
    .select("nome, estoque_atual_kg, dias_de_estoque")
    .eq("fazenda_id", fazenda!.id);
  if (error) throw error;

  const esperados: Record<string, { estoque: number; dias: number }> = {
    "Farelo de Soja": { estoque: 16245.232, dias: 11.472621468926553 },
    "Milho Moído": { estoque: 35549.99279999998, dias: 8.299480039221175 },
  };
  for (const [nome, esperado] of Object.entries(esperados)) {
    const row = rows!.find((r) => r.nome === nome);
    checar(`estoque_atual_kg ${nome}`, row?.estoque_atual_kg ?? null, esperado.estoque, 0.01);
    checar(`dias_de_estoque ${nome} (projeção, tolerância maior)`, row?.dias_de_estoque ?? null, esperado.dias, 0.5);
  }
}

async function testeRollupFazenda() {
  // GMD médio da fazenda (Etapa 4) bate com a linha "AO VIVO" do Historico_KPIs —
  // achado sem procurar de propósito, bom sinal de que a ponderação está certa.
  console.log("\n== Rollup de fazenda (Etapa 4) — vs Historico_KPIs.xlsx (BG) ==");
  const { data: fazenda } = await supabase.from("fazendas").select("id").eq("codigo", "BG").single();
  const { data: parametros } = await supabase
    .from("parametros")
    .select("*")
    .eq("fazenda_id", fazenda!.id)
    .single<Parametros>();
  const { data: currais } = await supabase
    .from("v_curral_indicadores_completo")
    .select("*")
    .eq("fazenda_id", fazenda!.id)
    .returns<CurralIndicadores[]>();

  const rollup = calcularFazendaRollup(currais ?? [], parametros!);
  checar("numCabecas", rollup.numCabecas, 385, 0);
  checar("pesoTotalAtualKg", rollup.pesoTotalAtualKg, 134331, 0);
  checar("gmdMedio (Historico_KPIs AO VIVO)", rollup.gmdMedio, 2.3696280303497628, 0.001);
}

async function main() {
  await testeCustoRealPorCurral();
  await testeCustoCabDiaMedio();
  await testeArrobaVivaTotal();
  await testeGmdConsistenciaGeral();
  await testeEstoque();
  await testeRollupFazenda();

  console.log(`\n${checagens - falhas}/${checagens} checagens passaram.`);
  if (falhas > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Erro nos testes:", err);
  process.exit(1);
});
