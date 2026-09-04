// Testa a transcrição num arquivo de áudio só, sem classificar nem tocar em
// banco. Uso:
//   tsx scripts/orquestrador/transcrever_uma.ts caminho/do/audio.opus
import path from "node:path";
import dotenv from "dotenv";
import { transcrever } from "../../src/lib/orquestrador/transcrever";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error("Uso: tsx scripts/orquestrador/transcrever_uma.ts caminho/do/audio.opus");
    process.exit(1);
  }
  const resultado = await transcrever(caminho);
  console.log(JSON.stringify(resultado, null, 2));
}

main();
