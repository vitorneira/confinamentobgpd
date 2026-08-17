// Golden test (lógica pura, sem banco) — confere se `montarFolhaImpressao`
// bate exatamente com o exemplo real da aba IMPRESSÃO/AJUSTE de
// `dados_originais/Guia de Trato e Vagao - Pau DArco.xlsx` (Pau D'Arco, split
// 41/18/41, capacidade 2200, dieta única).
import { montarFolhaImpressao, type ComposicaoDieta } from "../../src/lib/guia-trato/vagao-planilha";
import type { CurralAjuste } from "../../src/lib/guia-trato/balanceamento";

const TOTAIS_DIA_AJUSTADO = [1598, 487, 1618, 1676, 1551, 1451, 1560, 1247, 211, 555];

const entrada: CurralAjuste[] = TOTAIS_DIA_AJUSTADO.map((totalDiaKg, i) => ({
  curralId: `curral-${i + 1}`,
  curralCodigo: String(i + 1),
  dietaId: "dieta-unica",
  dietaNome: "Dieta PD",
  totalDiaKg,
  ajustePct: 0,
  ajusteKg: 0,
}));

const composicao = new Map<string, ComposicaoDieta[]>([
  [
    "dieta-unica",
    [
      { ingredienteNome: "Silagem de capim", proporcao: 0.5 },
      { ingredienteNome: "Farelo de soja", proporcao: 0.12 },
      { ingredienteNome: "Milho moído", proporcao: 0.363 },
      { ingredienteNome: "Ureia", proporcao: 0.007 },
      { ingredienteNome: "Núcleo (Flex)", proporcao: 0.01 },
    ],
  ],
]);

let falhas = 0;
function checar(label: string, atual: unknown, esperado: unknown) {
  const ok = JSON.stringify(atual) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK" : "FALHOU"} ${label}: atual=${JSON.stringify(atual)} esperado=${JSON.stringify(esperado)}`);
}

function main() {
  console.log("\n== Folha do Guia de Trato (padrão planilha) bate com o exemplo real de Pau D'Arco ==");

  const folha = montarFolhaImpressao(
    entrada,
    { manha: 0.41, almoco: 0.18, tarde: 0.41 },
    2200,
    composicao,
    "Pau D'Arco",
    "2026-08-17",
  );

  checar("mostrarColunaDieta", folha.mostrarColunaDieta, false);
  checar("cabecalhoCurral", folha.cabecalhoCurral, ["MANHÃ/TARDE", "ALMOÇO"]);
  checar(
    "legenda",
    folha.legenda,
    ["KG POR CURRAL POR TRATO", "TRATO DA MANHÃ É IGUAL O DA TARDE. ALMOÇO É MENOS."],
  );

  const manhaTarde = folha.currais.map((c) => c.valores[0]);
  const almoco = folha.currais.map((c) => c.valores[1]);
  checar("kg manhã/tarde por curral", manhaTarde, [655, 200, 663, 687, 636, 595, 640, 511, 87, 228]);
  checar("kg almoço por curral", almoco, [288, 88, 291, 302, 279, 261, 281, 224, 38, 100]);

  checar("nº de blocos de dieta", folha.blocosDieta.length, 1);
  const bloco = folha.blocosDieta[0];
  checar("dietaNome do bloco (null pq só tem 1 dieta)", bloco.dietaNome, null);
  checar(
    "títulos das colunas de receita",
    bloco.colunas.map((c) => `${c.tituloLinha1} / ${c.tituloLinha2}`),
    [
      "VAGÃO GRANDE / (2200 kg)",
      "VAGÃO PEQUENO / MANHÃ/TARDE (502 kg)",
      "VAGÃO PEQUENO / ALMOÇO — MENOR (2152 kg)",
    ],
  );

  const esperadoIngredientes: Record<string, number[]> = {
    "Silagem de capim": [1100, 251, 1076],
    "Farelo de soja": [264, 60.2, 258.2],
    "Milho moído": [798.6, 182.2, 781.2],
    Ureia: [15.4, 3.5, 15.1],
    "Núcleo (Flex)": [22, 5, 21.5],
  };
  for (const ing of bloco.ingredientes) {
    checar(`receita — ${ing.ingredienteNome}`, ing.valores, esperadoIngredientes[ing.ingredienteNome]);
  }

  checar("rodapé (batidas)", bloco.rodape, [
    "MANHÃ E TARDE: 2 VAGÃO GRANDE + 1 PEQUENO",
    "ALMOÇO: 0 VAGÃO GRANDE + 1 PEQUENO (MENOR)",
  ]);

  console.log(falhas === 0 ? "\nTudo bateu com o exemplo real da planilha." : `\n${falhas} verificação(ões) falharam.`);
  if (falhas > 0) process.exit(1);
}

main();
