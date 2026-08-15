import { supabase } from "./lib";

const ESPERADO: Record<string, { animais: number; pesagens: number }> = {
  BG: { animais: 385, pesagens: 731 },
  PD: { animais: 646, pesagens: 646 },
};

async function contarPorFazenda(table: string, fazendaId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("fazenda_id", fazendaId);
  if (error) throw new Error(`Erro contando ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const { data: fazendas, error } = await supabase.from("fazendas").select("id, codigo, nome");
  if (error) throw new Error(error.message);

  for (const f of fazendas ?? []) {
    const codigo = f.codigo as string;
    const fazendaId = f.id as string;
    const animais = await contarPorFazenda("animais", fazendaId);
    const pesagens = await contarPorFazenda("pesagens", fazendaId);
    const tratos = await contarPorFazenda("tratos_diarios", fazendaId);
    const compras = await contarPorFazenda("compras_insumos", fazendaId);
    const currais = await contarPorFazenda("currais", fazendaId);
    const esperado = ESPERADO[codigo];

    console.log(`\n=== ${codigo} — ${f.nome} ===`);
    console.log(
      `  animais:  ${animais}${esperado ? ` (esperado ${esperado.animais}) ${animais === esperado.animais ? "OK" : "DIVERGE"}` : ""}`,
    );
    console.log(
      `  pesagens: ${pesagens}${esperado ? ` (esperado ${esperado.pesagens}) ${pesagens === esperado.pesagens ? "OK" : "DIVERGE"}` : ""}`,
    );
    console.log(`  tratos diários: ${tratos}`);
    console.log(`  compras de insumo: ${compras}`);
    console.log(`  currais: ${currais}`);
  }
}

main().catch((err) => {
  console.error("Erro na verificação:", err);
  process.exit(1);
});
