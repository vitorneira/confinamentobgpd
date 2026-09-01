// Testa a classificação num texto só, sem tocar em banco. Uso:
//   tsx scripts/orquestrador/classificar_uma.ts "Está acabando a ração do curral 2"
import path from "node:path";
import dotenv from "dotenv";
import { classificar } from "../../src/lib/orquestrador/classificar";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const texto = process.argv.slice(2).join(" ");
  if (!texto) {
    console.error('Uso: tsx scripts/orquestrador/classificar_uma.ts "texto da mensagem"');
    process.exit(1);
  }
  const resultado = await classificar(texto);
  console.log(JSON.stringify(resultado, null, 2));
}

main();
