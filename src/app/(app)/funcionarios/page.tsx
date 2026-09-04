import Link from "next/link";
import { getFuncionariosCompletos, getPendenciasFuncionario } from "@/lib/queries/funcionarios";
import { getFazendasAcessiveis } from "@/lib/queries/ordens-servico";
import { FuncionariosPainel } from "./FuncionariosPainel";

export default async function FuncionariosPage() {
  const [funcionarios, fazendas, pendencias] = await Promise.all([
    getFuncionariosCompletos(),
    getFazendasAcessiveis(),
    getPendenciasFuncionario(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Funcionários</h1>
        <Link href="/ordens-servico" className="text-sm text-zinc-500 underline">
          ← voltar pra fila
        </Link>
      </div>
      {pendencias.length > 0 && (
        <Link
          href="/funcionarios/pendencias"
          className="mb-4 flex items-center justify-between rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
        >
          <span>
            {pendencias.length} documento{pendencias.length > 1 ? "s" : ""} pendente{pendencias.length > 1 ? "s" : ""} de revisão
          </span>
          <span className="underline">revisar →</span>
        </Link>
      )}
      <FuncionariosPainel funcionarios={funcionarios} fazendas={fazendas} />
    </div>
  );
}
