import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim();

async function checarComo(email: string, senha: string) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: authError } = await client.auth.signInWithPassword({ email, password: senha });
  if (authError) throw new Error(`Login falhou para ${email}: ${authError.message}`);

  const { data: fazendas, error: fErr } = await client.from("fazendas").select("codigo, nome");
  if (fErr) throw fErr;

  console.log(`\n== ${email} ==`);
  console.log("  fazendas visíveis:", fazendas?.map((f) => f.codigo).join(", ") || "(nenhuma)");

  for (const f of fazendas ?? []) {
    const { count } = await client
      .from("animais")
      .select("*", { count: "exact", head: true })
      .eq(
        "fazenda_id",
        (
          await client.from("fazendas").select("id").eq("codigo", f.codigo).single()
        ).data!.id as string,
      );
    console.log(`  animais em ${f.codigo}: ${count}`);
  }

  // tenta ver a outra fazenda diretamente (sem filtrar por vínculo) — deve retornar 0 linhas
  const { data: todasAnimais } = await client.from("animais").select("fazenda_id");
  const fazendaIdsVistos = new Set((todasAnimais ?? []).map((a) => a.fazenda_id));
  console.log("  fazenda_ids distintos vistos em animais:", fazendaIdsVistos.size);

  // gestor não deve conseguir alterar parâmetros (só dono edita cadastro/config).
  // Escreve de volta o próprio valor atual (idempotente, sem efeito colateral
  // mesmo quando a escrita é permitida).
  if (fazendas && fazendas.length > 0) {
    const { data: fazendaId } = await client
      .from("fazendas")
      .select("id")
      .eq("codigo", fazendas[0].codigo)
      .single();
    const { data: atual } = await client
      .from("parametros")
      .select("preco_arroba_referencia")
      .eq("fazenda_id", fazendaId!.id as string)
      .single();
    const { data: updRows, error: updErr } = await client
      .from("parametros")
      .update({ preco_arroba_referencia: atual?.preco_arroba_referencia })
      .eq("fazenda_id", fazendaId!.id as string)
      .select();
    const bloqueado = !!updErr || (updRows?.length ?? 0) === 0;
    console.log(
      `  update em parametros: ${bloqueado ? `bloqueado pela RLS${updErr ? ` (${updErr.message})` : " (0 linhas afetadas)"}` : "PERMITIDO"}`,
    );
  }

  await client.auth.signOut();
}

async function main() {
  await checarComo("vitorneira@gmail.com", process.argv[2]);
  await checarComo("teste.gestor.bg@confinamento.dev", process.argv[3]);
  await checarComo("teste.gestor.pd@confinamento.dev", process.argv[4]);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
