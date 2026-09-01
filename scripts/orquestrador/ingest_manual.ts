// Roda o pipeline de ingestão (ingest.ts) num texto colado ou áudio local, e
// grava de verdade no Supabase — pra conferir que não duplica ao rodar de
// novo com o mesmo id. Não cria OS/registro (isso é a Triagem, na M2).
//
// Uso:
//   tsx scripts/orquestrador/ingest_manual.ts --texto "..." [--id <id>]
//   tsx scripts/orquestrador/ingest_manual.ts --audio <caminho.ogg> [--id <id>]
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const args = process.argv.slice(2);
  const pegar = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const texto = pegar("--texto");
  const audio = pegar("--audio");
  const id = pegar("--id") ?? `manual-${Date.now()}`;

  if (!texto && !audio) {
    console.error(
      'Uso: tsx scripts/orquestrador/ingest_manual.ts --texto "..." [--id ID]\n' +
        "  ou --audio caminho.ogg no lugar de --texto",
    );
    process.exit(1);
  }

  const { ingest } = await import("../../src/lib/orquestrador/ingest");

  const resultado = await ingest({
    id,
    canal: "manual",
    remetente: "teste-cli",
    tipo: audio ? "audio" : "texto",
    conteudoBruto: texto,
    caminhoAudio: audio,
  });

  console.log(JSON.stringify(resultado, null, 2));
}

main();
