import Link from "next/link";
import {
  getAtivosDaFazenda,
  getCurraisDaFazenda,
  getFazendasAcessiveis,
  getFornecedores,
  getUsuariosDaFazenda,
} from "@/lib/queries/ordens-servico";
import { NovaOsForm } from "./NovaOsForm";

export default async function NovaOsPage() {
  const [fazendasBase, fornecedores] = await Promise.all([getFazendasAcessiveis(), getFornecedores()]);

  const fazendas = await Promise.all(
    fazendasBase.map(async (f) => {
      const [ativos, currais, usuarios] = await Promise.all([
        getAtivosDaFazenda(f.id),
        getCurraisDaFazenda(f.id),
        getUsuariosDaFazenda(f.id),
      ]);
      return { ...f, ativos, currais, usuarios };
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Nova OS</h1>
        <Link href="/ordens-servico" className="text-sm text-zinc-500 underline">
          ← voltar pra fila
        </Link>
      </div>
      <NovaOsForm fazendas={fazendas} fornecedores={fornecedores} />
    </div>
  );
}
