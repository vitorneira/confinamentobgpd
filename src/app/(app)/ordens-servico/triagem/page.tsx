import Link from "next/link";
import {
  getAtivosDaFazenda,
  getCurraisDaFazenda,
  getFazendasAcessiveis,
  getFornecedores,
  getMensagensPendentesTriagem,
  getPrestadores,
  getUsuariosDaFazenda,
} from "@/lib/queries/ordens-servico";
import { TriagemCard } from "./TriagemCard";

export default async function TriagemPage() {
  const [pendentes, fazendasBase, fornecedores, prestadores] = await Promise.all([
    getMensagensPendentesTriagem(),
    getFazendasAcessiveis(),
    getFornecedores(),
    getPrestadores(),
  ]);

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
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Triagem</h1>
        <Link href="/ordens-servico" className="text-sm text-zinc-500 underline">
          ← voltar pra fila
        </Link>
      </div>
      <p className="mb-6 text-sm text-zinc-500">
        Toda mensagem classificada como demanda espera confirmação aqui antes de virar OS de verdade.
      </p>

      {pendentes.length === 0 ? (
        <div className="rounded-card border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-medium text-black dark:text-zinc-50">Nada pendente</p>
          <p className="mt-1 text-sm text-zinc-500">Todas as mensagens classificadas já foram revisadas.</p>
        </div>
      ) : (
        <TriagemCard pendentes={pendentes} fazendas={fazendas} fornecedores={fornecedores} prestadores={prestadores} />
      )}
    </div>
  );
}
