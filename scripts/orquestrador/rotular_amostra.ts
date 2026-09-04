// Fase M1 — rotula a amostra sanitizada (scripts/orquestrador/amostrar_corpus.ts)
// com a taxonomia do GROUNDING.md, usando o classificador real. Saída é o eval
// set publicável: dados_originais/orquestrador_corpus/eval_set.json.
//
// Uso: tsx scripts/orquestrador/rotular_amostra.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { classificar } from "../../src/lib/orquestrador/classificar";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const ENTRADA = path.join(process.cwd(), "scripts", "orquestrador", "_amostra_candidata.json");
const SAIDA = path.join(
  process.cwd(),
  "dados_originais",
  "orquestrador_corpus",
  "eval_set.json",
);

type MensagemCandidata = {
  origem: string;
  dt: string;
  remetente_papel: string;
  tipo: string;
  texto: string;
  categoria_bruta: string;
  is_demanda_bruta: boolean;
  revisar_manual: boolean;
};

async function main() {
  const candidatos: MensagemCandidata[] = JSON.parse(fs.readFileSync(ENTRADA, "utf8"));
  const resultado: unknown[] = [];
  let falhas = 0;

  for (let i = 0; i < candidatos.length; i++) {
    const c = candidatos[i];
    process.stdout.write(`\r${i + 1}/${candidatos.length}`);
    try {
      const classificacao = await classificar(c.texto);
      resultado.push({
        origem: c.origem,
        remetente_papel: c.remetente_papel,
        tipo: c.tipo,
        texto: c.texto,
        categoria_bruta_origem: c.categoria_bruta,
        is_demanda_bruta_origem: c.is_demanda_bruta,
        ...classificacao,
      });
    } catch (err) {
      falhas++;
      console.error(`\nFalha ao classificar #${i + 1}: ${(err as Error).message}`);
    }
  }
  console.log(`\nRotulado: ${resultado.length}, falhas: ${falhas}`);

  fs.writeFileSync(SAIDA, JSON.stringify(resultado, null, 2), "utf8");
  console.log(`Escrito em ${path.relative(process.cwd(), SAIDA)}`);
}

main();
