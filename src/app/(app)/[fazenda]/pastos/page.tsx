import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getEstoqueAtual, getPastosDaFazenda, getPendenciasEstoquePasto } from "@/lib/queries/pastos";
import { formatData, formatNumero } from "@/lib/format";
import { Conferencia } from "./Conferencia";
import { LancamentoManual } from "./LancamentoManual";

export default async function PastosPage({ params }: { params: Promise<{ fazenda: string }> }) {
  const { fazenda: codigo } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const [estoque, pastos, pendencias] = await Promise.all([
    getEstoqueAtual(fazenda.id),
    getPastosDaFazenda(fazenda.id),
    getPendenciasEstoquePasto(fazenda.id),
  ]);

  const pastoIdPorNome = new Map(pastos.map((p) => [p.nome, p.id]));

  const porPasto = new Map<string, { pastoNome: string; hectares: number | null; total: number; dataEvento: string; categorias: { categoria: string; quantidade: number }[] }>();
  for (const linha of estoque) {
    const atual = porPasto.get(linha.pasto_id) ?? {
      pastoNome: linha.pasto_nome,
      hectares: linha.hectares,
      total: 0,
      dataEvento: linha.data_evento,
      categorias: [],
    };
    atual.total += linha.quantidade;
    atual.categorias.push({ categoria: linha.categoria, quantidade: linha.quantidade });
    if (linha.data_evento > atual.dataEvento) atual.dataEvento = linha.data_evento;
    porPasto.set(linha.pasto_id, atual);
  }
  const totalGeral = [...porPasto.values()].reduce((soma, p) => soma + p.total, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Estoque por Pasto</h1>
        <span className="text-sm text-zinc-500">{formatNumero(totalGeral)} cabeças (total)</span>
      </div>

      {pendencias.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Aguardando conferência ({pendencias.length})
          </h2>
          <Conferencia fazendaCodigo={codigo} fazendaId={fazenda.id} pendencias={pendencias} pastoIdPorNome={pastoIdPorNome} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Estoque atual</h2>
        {porPasto.size === 0 ? (
          <p className="rounded-card border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            Nenhum estoque lançado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {[...porPasto.entries()]
              .sort((a, b) => a[1].pastoNome.localeCompare(b[1].pastoNome))
              .map(([pastoId, p]) => (
                <div key={pastoId} className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-black dark:text-zinc-50">{p.pastoNome}</p>
                      <p className="text-xs text-zinc-500">
                        {p.hectares ? `${formatNumero(p.hectares, 1)} ha · ` : ""}
                        atualizado {formatData(p.dataEvento)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-black dark:text-zinc-50">{formatNumero(p.total)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {p.categorias
                      .sort((a, b) => b.quantidade - a.quantidade)
                      .map((c) => (
                        <span key={c.categoria}>
                          {c.categoria}: <span className="font-medium text-black dark:text-zinc-50">{formatNumero(c.quantidade)}</span>
                        </span>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Lançamento manual</h2>
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <LancamentoManual fazendaCodigo={codigo} fazendaId={fazenda.id} pastos={pastos} />
        </div>
      </section>
    </div>
  );
}
