// Testa src/lib/pastos/linha-do-tempo.ts com casos sintéticos — lógica pura,
// sem banco. Rodar com: npx tsx scripts/test/pastos_linha_do_tempo_check.ts
import { calcularEstadoPasto, labelDiasEstado, bandaVazio } from "../../src/lib/pastos/linha-do-tempo";

let falhas = 0;
function checar(nome: string, esperado: unknown, obtido: unknown) {
  const ok = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`  ${nome} (esperado ${JSON.stringify(esperado)}): ${JSON.stringify(obtido)} -> ${ok ? "OK" : "FALHOU"}`);
  if (!ok) falhas++;
}

console.log("\n== Pasto vazio agora — conta desde o PRIMEIRO zero da sequência, não o último ==");
{
  const estado = calcularEstadoPasto(
    [
      { categoria: "Garrote", quantidade: 164, data: "2026-01-01" },
      { categoria: "Garrote", quantidade: 0, data: "2026-06-16" }, // zerou aqui
      { categoria: "Garrote", quantidade: 0, data: "2026-07-20" }, // relançado zerado — não reinicia
    ],
    "2026-09-03",
  )!;
  checar("vazio", true, estado.vazio);
  checar("desde", "2026-06-16", estado.desde);
  checar("diasNoEstado (2026-06-16 -> 2026-09-03)", 79, estado.diasNoEstado);
  checar("inferido", false, estado.inferido);
}

console.log("\n== Pasto ocupado — soma de categorias no lançamento mais recente ==");
{
  const estado = calcularEstadoPasto(
    [
      { categoria: "Vaca", quantidade: 0, data: "2026-05-01" },
      { categoria: "Vaca", quantidade: 215, data: "2026-06-25" }, // saiu do vazio aqui
      { categoria: "Touro", quantidade: 29, data: "2026-06-25" },
      { categoria: "Vaca", quantidade: 220, data: "2026-08-10" }, // ajuste de quantidade não reinicia
    ],
    "2026-09-03",
  )!;
  checar("vazio", false, estado.vazio);
  checar("totalAtual", 249, estado.totalAtual);
  checar("categorias", [
    { categoria: "Vaca", quantidade: 220 },
    { categoria: "Touro", quantidade: 29 },
  ], estado.categorias);
  checar("desde", "2026-06-25", estado.desde);
  checar("diasNoEstado (2026-06-25 -> 2026-09-03)", 70, estado.diasNoEstado);
}

console.log("\n== Sem histórico do sinal oposto -> inferido, rótulo capado em 120+ ==");
{
  const estado = calcularEstadoPasto([{ categoria: "Novilha", quantidade: 198, data: "2026-01-01" }], "2026-09-03")!;
  checar("inferido", true, estado.inferido);
  checar("diasNoEstado", 245, estado.diasNoEstado);
  checar("label (capado)", "120+", labelDiasEstado(estado));
}

console.log("\n== Inferido mas recente -> mostra dias exatos, sem capar ==");
{
  const estado = calcularEstadoPasto([{ categoria: "Bezerro", quantidade: 91, data: "2026-08-24" }], "2026-09-03")!;
  checar("inferido", true, estado.inferido);
  checar("label (não capado)", "10", labelDiasEstado(estado));
}

console.log("\n== Sem eventos -> null ==");
checar("estado nulo", null, calcularEstadoPasto([], "2026-09-03"));

console.log("\n== Bandas de vazio ==");
checar("15 dias -> calmo", "calmo", bandaVazio(15).chave);
checar("16 dias -> atencao", "atencao", bandaVazio(16).chave);
checar("61 dias -> critico", "critico", bandaVazio(61).chave);

console.log(falhas === 0 ? "\nTudo OK.\n" : `\n${falhas} checagem(ns) falharam.\n`);
if (falhas > 0) process.exit(1);
