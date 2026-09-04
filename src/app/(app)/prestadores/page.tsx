import Link from "next/link";
import { getPrestadoresCompletos } from "@/lib/queries/mestres";
import { PrestadoresPainel } from "./PrestadoresPainel";

export default async function PrestadoresPage() {
  const prestadores = await getPrestadoresCompletos();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Prestadores de serviço</h1>
        <Link href="/ordens-servico" className="text-sm text-zinc-500 underline">
          ← voltar pra fila
        </Link>
      </div>
      <PrestadoresPainel prestadores={prestadores} />
    </div>
  );
}
