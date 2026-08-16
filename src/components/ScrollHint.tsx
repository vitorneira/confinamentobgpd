// Tabelas largas viram scroll horizontal no celular (overflow-x-auto), mas
// sem indicação visual o usuário não percebe que tem mais coluna pro lado.
export function ScrollHint() {
  return <p className="mb-1 text-xs text-zinc-400 sm:hidden">deslize pro lado para ver mais →</p>;
}
