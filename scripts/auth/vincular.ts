import { supabase } from "../import/lib";

/**
 * Vincula um usuário já existente no Supabase Auth a uma ou mais fazendas,
 * com um papel (dono/gestor/leitura). Não cria usuário nem altera senha.
 *
 * Uso: tsx scripts/auth/vincular.ts <email> <papel> <codigo_fazenda...>
 * Ex.:  tsx scripts/auth/vincular.ts apoio@bonsmarabarragrande.com.br dono BG PD
 */

async function buscarUsuarioPorEmail(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const usuario = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!usuario) throw new Error(`Usuário "${email}" não encontrado no Supabase Auth`);
  return usuario.id;
}

async function vincular(usuarioId: string, fazendaCodigo: string, papel: string) {
  const { data: fazenda, error } = await supabase
    .from("fazendas")
    .select("id")
    .eq("codigo", fazendaCodigo)
    .single();
  if (error) throw new Error(`Fazenda "${fazendaCodigo}" não encontrada: ${error.message}`);

  await supabase
    .from("usuarios_fazendas")
    .delete()
    .eq("usuario_id", usuarioId)
    .eq("fazenda_id", fazenda.id as string);

  const { error: insErr } = await supabase
    .from("usuarios_fazendas")
    .insert({ usuario_id: usuarioId, fazenda_id: fazenda.id as string, papel });
  if (insErr) throw insErr;
}

async function main() {
  const [email, papel, ...codigos] = process.argv.slice(2);
  if (!email || !papel || codigos.length === 0) {
    console.error("Uso: tsx scripts/auth/vincular.ts <email> <papel> <codigo_fazenda...>");
    process.exit(1);
  }

  const usuarioId = await buscarUsuarioPorEmail(email);
  for (const codigo of codigos) {
    await vincular(usuarioId, codigo, papel);
    console.log(`  ${email} -> ${codigo} como "${papel}"`);
  }
  console.log("OK");
}

main().catch((err) => {
  console.error("Erro vinculando usuário:", err);
  process.exit(1);
});
