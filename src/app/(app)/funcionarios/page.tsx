import Link from "next/link";
import { getFuncionariosCompletos } from "@/lib/queries/funcionarios";
import { getFazendasAcessiveis } from "@/lib/queries/ordens-servico";
import { FuncionariosPainel } from "./FuncionariosPainel";

export default async function FuncionariosPage() {
  const [funcionarios, fazendas] = await Promise.all([getFuncionariosCompletos(), getFazendasAcessiveis()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Funcionários</h1>
        <Link href="/ordens-servico" className="text-sm text-zinc-500 underline">
          ← voltar pra fila
        </Link>
      </div>
      <FuncionariosPainel funcionarios={funcionarios} fazendas={fazendas} />
    </div>
  );
}
