import { randomBytes } from "node:crypto";
import { supabase } from "../import/lib";

function gerarSenha(): string {
  return randomBytes(9).toString("base64url");
}

async function criarOuPegarUsuario(email: string, senha: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (!error) return data.user.id;

  // já existe — busca o id e reseta a senha pro valor gerado agora (senão o
  // valor impresso no final ficaria errado)
  if (error.message.includes("already been registered") || error.status === 422) {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;
    const existente = list.users.find((u) => u.email === email);
    if (!existente) throw new Error(`Usuário "${email}" não encontrado após conflito`);
    const { error: updErr } = await supabase.auth.admin.updateUserById(existente.id, { password: senha });
    if (updErr) throw updErr;
    return existente.id;
  }
  throw error;
}

async function vincular(usuarioId: string, fazendaCodigo: string, papel: string) {
  const { data: fazenda, error } = await supabase
    .from("fazendas")
    .select("id")
    .eq("codigo", fazendaCodigo)
    .single();
  if (error) throw error;

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
  const senhaDono = gerarSenha();
  const senhaGestorBG = gerarSenha();
  const senhaGestorPD = gerarSenha();

  const donoId = await criarOuPegarUsuario("vitorneira@gmail.com", senhaDono);
  await vincular(donoId, "BG", "dono");
  await vincular(donoId, "PD", "dono");

  const gestorBgId = await criarOuPegarUsuario("teste.gestor.bg@confinamento.dev", senhaGestorBG);
  await vincular(gestorBgId, "BG", "gestor");

  const gestorPdId = await criarOuPegarUsuario("teste.gestor.pd@confinamento.dev", senhaGestorPD);
  await vincular(gestorPdId, "PD", "gestor");

  console.log("\nContas criadas/atualizadas:");
  console.log(`  dono          vitorneira@gmail.com            senha: ${senhaDono}`);
  console.log(`  gestor BG     teste.gestor.bg@confinamento.dev senha: ${senhaGestorBG}`);
  console.log(`  gestor PD     teste.gestor.pd@confinamento.dev senha: ${senhaGestorPD}`);
}

main().catch((err) => {
  console.error("Erro criando usuários:", err);
  process.exit(1);
});
