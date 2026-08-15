import { parseBG } from "./parse-bg";
import { parsePD } from "./parse-pd";
import { insertFarm } from "./insert-farm";
import { resetFazenda } from "./reset";

async function main() {
  for (const parse of [parseBG, parsePD]) {
    const parsed = parse();
    console.log(`\n=== ${parsed.codigo} — ${parsed.nome} ===`);

    console.log(`Limpando dados anteriores de ${parsed.codigo} (se houver)...`);
    await resetFazenda(parsed.codigo);

    console.log("Importando...");
    const counts = await insertFarm(parsed);

    console.log(`Resultado ${parsed.codigo}:`);
    console.log(`  currais: ${counts.currais}`);
    console.log(`  categorias: ${counts.categorias}`);
    console.log(`  ingredientes: ${counts.ingredientes}`);
    console.log(`  dietas: ${counts.dietas}`);
    console.log(`  vigências de dieta: ${counts.dietaVigencias}`);
    console.log(`  animais: ${counts.animais}`);
    console.log(`  pesagens: ${counts.pesagens}`);
    console.log(`  tratos diários: ${counts.tratos}`);
    console.log(`  compras de insumo: ${counts.compras}`);
  }

  console.log("\nImportação concluída.");
}

main().catch((err) => {
  console.error("Erro na importação:", err);
  process.exit(1);
});
