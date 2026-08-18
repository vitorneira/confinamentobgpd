// Testa a lógica pura de cálculo da aba Simulação (Etapa 9+). Sem banco —
// só as fórmulas de src/lib/kpi/simulacao.ts. Cenário sintético fácil de
// conferir na mão: 10 cabeças, peso de entrada 350kg, peso atual 450kg.
import {
  baseSimulacaoDoCurral,
  calcularBreakEven,
  calcularPontoOtimo,
  diasParaAtingirPeso,
  gmdForaDaFaixa,
  projetarCenario,
  type BaseSimulacao,
} from "../../src/lib/kpi/simulacao";
import type { CurralIndicadores } from "../../src/lib/kpi/types";

let falhas = 0;
function checar(nome: string, valor: unknown, esperado: unknown, tolerancia = 0.01) {
  const ok =
    typeof valor === "number" && typeof esperado === "number"
      ? Math.abs(valor - esperado) <= tolerancia
      : valor === esperado;
  console.log(`${ok ? "OK " : "FAIL"} ${nome}: ${valor} (esperado ${esperado})`);
  if (!ok) falhas++;
}

console.log("\n== gmdForaDaFaixa ==");
checar("gmd 1.2 dentro da faixa", gmdForaDaFaixa(1.2), false);
checar("gmd -2.652 fora da faixa (caso real reportado)", gmdForaDaFaixa(-2.652), true);
checar("gmd 3.0 fora da faixa", gmdForaDaFaixa(3.0), true);
checar("gmd 0 dentro da faixa (limite)", gmdForaDaFaixa(0), false);
checar("gmd 2.5 dentro da faixa (limite)", gmdForaDaFaixa(2.5), false);

console.log("\n== baseSimulacaoDoCurral ==");
const curralFicticio: CurralIndicadores = {
  curral_id: "curral-teste",
  fazenda_id: "fazenda-teste",
  codigo: "T1",
  descricao: null,
  num_cabecas: 10,
  peso_total_atual_kg: 4500, // 450 kg/cab
  ganho_total_kg: 1000, // 100 kg/cab de ganho -> entrada 350 kg/cab
  arroba_viva_total: 150,
  arroba_produzida: 33.33,
  peso_medio_entrada_kg: 350,
  peso_medio_atual_kg: 450,
  gmd_medio: 1.2,
  num_gmd_validos: 10,
  num_nao_vencidos: 10,
  num_na_meta: 10,
  pct_na_meta_gmd: 1,
  dias_desde_ultima_pesagem: 2,
  consumo_racao_total_kg: 6000, // 100 dias * 10 cab * 6 kg/cab/dia
  custo_racao_acumulado: 9000, // R$0,90/kg médio -> R$0,90/cab/dia * 10 dias... ver custo_cab_dia abaixo
  dias_com_trato: 100,
  custo_racao_por_arroba: 270,
  conversao_alimentar: 6,
  custo_cab_dia_medio_racao: 9, // R$/cab/dia real histórico
  custo_fixo_dia: 3, // R$/cab/dia
  dias_conf_curral: 100,
  custo_total_acumulado: 12000, // 9000 racao + 100*10*3 fixo
  custo_total_por_arroba: 360,
  custo_cab_dia_medio_total: 12,
};

const base = baseSimulacaoDoCurral(curralFicticio) as BaseSimulacao;
checar("base não é null", base !== null, true);
checar("pesoEntradaMedioKg = 350", base.pesoEntradaMedioKg, 350);
checar("consumoRacaoCabDiaMedioKg = 6", base.consumoRacaoCabDiaMedioKg, 6);

console.log("\n== diasParaAtingirPeso ==");
checar("120 kg a 1.2 kg/dia = 100 dias", diasParaAtingirPeso(450, 1.2, 570), 100);
checar("já no alvo -> 0 dias", diasParaAtingirPeso(450, 1.2, 400), 0);
checar("GMD <= 0 e falta peso -> nunca (null)", diasParaAtingirPeso(450, 0, 500), null);

console.log("\n== projetarCenario (dia 0 = vender agora) ==");
const cenarioAgora = projetarCenario(
  base,
  { gmdKgDia: 1.2, rendimentoCarcaca: 0.5, precoArrobaCarcaca: 320, precoArrobaEntrada: 280 },
  0,
);
// arroba carcaça = 450*0.5*10/15 = 150 @ ; receita = 150*320 = 48000
checar("arroba carcaça dia 0", cenarioAgora.arrobaCarcacaTotal, 150);
checar("receita dia 0", cenarioAgora.receitaProjetada, 48000);
// arroba produzida (viva) = ganho total (450-350)*10/30 = 33.33
checar("arroba produzida (viva) dia 0", cenarioAgora.arrobaProduzidaTotal, 33.33, 0.1);
// custo entrada = 350*10*0.5/15*280 = 32666.67
checar("custo de entrada dia 0", cenarioAgora.custoEntradaReais!, 32666.67, 0.5);
// contribuição = 48000 - 12000 = 36000
checar("contribuição do confinamento dia 0", cenarioAgora.contribuicaoConfinamento, 36000);
// resultado cheio = 36000 - 32666.67 = 3333.33
checar("resultado cheio dia 0", cenarioAgora.resultadoCheio!, 3333.33, 0.5);

console.log("\n== projetarCenario (+100 dias, sem preço de entrada informado) ==");
const cenario100 = projetarCenario(
  base,
  { gmdKgDia: 1.2, rendimentoCarcaca: 0.5, precoArrobaCarcaca: 320, precoArrobaEntrada: null },
  100,
);
checar("peso projetado em 100 dias", cenario100.pesoProjetadoKg, 570);
checar("custo de entrada desconhecido -> null", cenario100.custoEntradaReais, null);
checar("resultado cheio desconhecido -> null", cenario100.resultadoCheio, null);
checar("margem operacional não depende da compra", cenario100.margemOperacional !== null, true);
// conversão projetada = consumo/cab/dia (6) / gmd (1.2) = 5
checar("conversão alimentar projetada", cenario100.conversaoAlimentarProjetada!, 5);

console.log("\n== calcularPontoOtimo ==");
// valor marginal/dia = 1.2*10*0.5/15*320 = 128 ; custo marginal/dia = (9+3)*10 = 120 -> vale esperar
const otimoPositivo = calcularPontoOtimo(base, { gmdKgDia: 1.2, rendimentoCarcaca: 0.5, precoArrobaCarcaca: 320, precoArrobaEntrada: null }, 100);
checar("margem diária positiva", otimoPositivo.margemDiariaReais, 8);
checar("vale esperar", otimoPositivo.valeEsperar, true);
checar("dia ótimo = dia do alvo (100)", otimoPositivo.diaOtimo, 100);

// preço mais baixo inverte a decisão: valor marginal/dia = 1.2*10*0.5/15*150 = 60 < custo 120
const otimoNegativo = calcularPontoOtimo(base, { gmdKgDia: 1.2, rendimentoCarcaca: 0.5, precoArrobaCarcaca: 150, precoArrobaEntrada: null }, 100);
checar("margem diária negativa a preço baixo", otimoNegativo.valeEsperar, false);
checar("dia ótimo = agora (0)", otimoNegativo.diaOtimo, 0);

console.log("\n== calcularBreakEven ==");
// break-even sem compra no dia 0: custoTotalReais(12000) / arrobaCarcacaTotal(150) = 80
const breakEven = calcularBreakEven(cenarioAgora);
checar("break-even sem compra", breakEven.precoArrobaSemCompra!, 80);
// com compra: (12000+32666.67)/150 = 297.78
checar("break-even com compra", breakEven.precoArrobaComCompra!, 297.78, 0.5);

if (falhas > 0) {
  console.log(`\n${falhas} checagem(ns) falharam.`);
  process.exit(1);
}
console.log("\nTudo bateu.");
