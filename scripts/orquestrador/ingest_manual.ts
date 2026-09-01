// Roda o pipeline completo (ingest.ts) num texto colado ou áudio local, e
// grava de verdade no Supabase — pra conferir que cria os/registro_admin e
// que não duplica ao rodar de novo com o mesmo id.
//
// Uso:
//   tsx scripts/orquestrador/ingest_manual.ts --fazenda <codigo BG|PD> --texto "..." [--id <id>]
//   tsx scripts/orquestrador/ingest_manual.ts --fazenda <codigo BG|PD> --audio <caminho.ogg> [--id <id>]
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const args = process.argv.slice(2);
  const pegar = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const codigoFazenda = pegar("--fazenda");
  const texto = pegar("--texto");
  const audio = pegar("--audio");
  const id = pegar("--id") ?? `manual-${Date.now()}`;

  if (!codigoFazenda || (!texto && !audio)) {
    console.error(
      'Uso: tsx scripts/orquestrador/ingest_manual.ts --fazenda BG --texto "..." [--id ID]\n' +
        "  ou --audio caminho.ogg no lugar de --texto",
    );
    process.exit(1);
  }

  // imports depois do dotenv.config() — os módulos leem env var na hora de importar (supabase-servico.ts falha cedo se faltar chave)
  const { supabaseServico } = await import("../../src/lib/orquestrador/supabase-servico");
  const { ingest } = await import("../../src/lib/orquestrador/ingest");

  const { data: fazenda, error } = await supabaseServico
    .from("fazendas")
    .select("id, codigo")
    .eq("codigo", codigoFazenda)
    .single();
  if (error || !fazenda) {
    console.error(`Fazenda '${codigoFazenda}' não encontrada:`, error?.message);
    process.exit(1);
  }

  const resultado = await ingest({
    id,
    canal: "manual",
    remetente: "teste-cli",
    tipo: audio ? "audio" : "texto",
    conteudoBruto: texto,
    caminhoAudio: audio,
    fazendaId: fazenda.id,
  });

  console.log(JSON.stringify(resultado, null, 2));
}

main();
