import Link from "next/link";
import { getFornecedoresCompletos } from "@/lib/queries/mestres";
import { FornecedoresPainel } from "./FornecedoresPainel";

export default async function FornecedoresPage() {
  const fornecedores = await getFornecedoresCompletos();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Fornecedores</h1>
        <Link href="/ordens-servico" className="text-sm text-zinc-500 underline">
          ← voltar pra fila
        </Link>
      </div>
      <FornecedoresPainel fornecedores={fornecedores} />
    </div>
  );
}
