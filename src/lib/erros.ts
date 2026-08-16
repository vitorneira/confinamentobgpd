// Traduz erros crus do Postgres/Supabase (código + mensagem técnica) pra algo
// que um gestor de fazenda entende. Nunca repassar error.message direto pro
// usuário — vaza texto tipo "duplicate key value violates unique constraint".
export function erroAmigavel(error: { message: string; code?: string } | null | undefined): string {
  if (!error) return "Não foi possível salvar. Tente novamente.";

  switch (error.code) {
    case "23505":
      return "Já existe um registro com esses dados (ex.: brinco ou nome duplicado).";
    case "23502":
      return "Faltou preencher um campo obrigatório.";
    case "23503":
      return "O item selecionado (curral, dieta, categoria...) não foi encontrado — pode ter sido removido.";
    case "42501":
      return "Você não tem permissão para fazer essa ação.";
  }

  if (/row-level security/i.test(error.message)) {
    return "Você não tem permissão para fazer essa ação.";
  }
  if (/duplicate key/i.test(error.message)) {
    return "Já existe um registro com esses dados.";
  }

  return "Não foi possível salvar. Tente novamente em instantes.";
}
