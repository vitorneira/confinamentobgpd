import Link from "next/link";
import { getFuncionariosCompletos, getPendenciasFuncionario } from "@/lib/queries/funcionarios";
import { getFazendasAcessiveis } from "@/lib/queries/ordens-servico";
import { PendenciasPainel } from "./PendenciasPainel";

export default async function PendenciasFuncionarioPage() {
  const [pendencias, funcionarios, fazendas] = await Promise.all([
    getPendenciasFuncionario(),
    getFuncionariosCompletos(),
    getFazendasAcessiveis(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Documentos pendentes</h1>
        <Link href="/funcionarios" className="text-sm text-zinc-500 underline">
          ← voltar pra funcionários
        </Link>
      </div>
      <PendenciasPainel pendencias={pendencias} funcionarios={funcionarios} fazendas={fazendas} />
    </div>
  );
}
