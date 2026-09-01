import Link from "next/link";
import {
  getAtivosDaFazenda,
  getCurraisDaFazenda,
  getFazendasAcessiveis,
  getMensagensPendentesTriagem,
  getUsuariosDaFazenda,
} from "@/lib/queries/ordens-servico";
import { formatTempoRelativo } from "@/lib/format";
import { TriagemCard } from "./TriagemCard";

export default async function TriagemPage() {
  const [pendentes, fazendasBase] = await Promise.all([getMensagensPendentesTriagem(), getFazendasAcessiveis()]);

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
        <div className="flex flex-col gap-4 lg:flex-row">
          <TriagemCard mensagem={pendentes[0]} fazendas={fazendas} posicao={1} total={pendentes.length} />

          {pendentes.length > 1 && (
            <div className="flex-1">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Na fila de triagem</h2>
              <div className="space-y-2">
                {pendentes.slice(1).map((m) => (
                  <div
                    key={m.id}
                    className="rounded-card border border-zinc-200 bg-white py-2 pl-3 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    style={{ borderLeft: "3px solid var(--os-atencao-fg)" }}
                  >
                    <p className="truncate font-medium text-black dark:text-zinc-50">
                      {m.transcricao ?? m.conteudo_bruto ?? "(sem texto)"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {m.canal ?? "manual"} · {formatTempoRelativo(m.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
