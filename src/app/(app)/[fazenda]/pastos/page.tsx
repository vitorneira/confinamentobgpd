import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getPastosDaFazenda, getHistoricoEstoque, getPendenciasEstoquePasto, type PastoCadastro } from "@/lib/queries/pastos";
import { calcularEstadoPasto, labelDiasEstado, bandaVazio, type EstadoPasto } from "@/lib/pastos/linha-do-tempo";
import { formatData, formatNumero } from "@/lib/format";
import { ScrollHint } from "@/components/ScrollHint";
import { Conferencia } from "./Conferencia";
import { LancamentoManual } from "./LancamentoManual";

// Escala de "dias vazio" — verde=descanso normal, escala até vermelho=capim
// ocioso. Não é StatusBadge (ok/atencao/critico): aquelas são semânticas
// fixas do sistema (CLAUDE.md) pra outra coisa; esta é uma escala própria
// de 4 níveis, só pra este indicador.
const BANDA_CLASSES: Record<string, string> = {
  calmo: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400",
  atencao: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400",
  laranja: "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/40 dark:border-orange-900 dark:text-orange-400",
  critico: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400",
};

const chipOcupado = "inline-block shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

function formatCategorias(categorias: EstadoPasto["categorias"]): string {
  return categorias.map((c) => `${c.categoria} ${formatNumero(c.quantidade)}`).join(" · ");
}

export default async function PastosPage({ params }: { params: Promise<{ fazenda: string }> }) {
  const { fazenda: codigo } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const [pastos, historico, pendencias] = await Promise.all([
    getPastosDaFazenda(fazenda.id),
    getHistoricoEstoque(fazenda.id),
    getPendenciasEstoquePasto(fazenda.id),
  ]);

  const eventosPorPasto = new Map<string, { categoria: string; quantidade: number; data: string }[]>();
  for (const e of historico) {
    const lista = eventosPorPasto.get(e.pasto_id);
    if (lista) lista.push(e);
    else eventosPorPasto.set(e.pasto_id, [e]);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const linhas = pastos
    .map((pasto) => {
      const estado = calcularEstadoPasto(eventosPorPasto.get(pasto.id) ?? [], hoje);
      return estado ? { pasto, estado } : null;
    })
    .filter((l): l is { pasto: PastoCadastro; estado: EstadoPasto } => l !== null);

  const vazios = linhas.filter((l) => l.estado.vazio).sort((a, b) => b.estado.diasNoEstado - a.estado.diasNoEstado);
  const ocupados = linhas.filter((l) => !l.estado.vazio).sort((a, b) => b.estado.diasNoEstado - a.estado.diasNoEstado);
  const totalCabecas = linhas.reduce((soma, l) => soma + l.estado.totalAtual, 0);
  const haOciosos = vazios.reduce((soma, l) => soma + (l.pasto.hectares ?? 0), 0);

  const pastoIdPorNome = new Map(pastos.map((p) => [p.nome, p.id]));

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Estoque por Pasto</h1>
          <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
            {formatNumero(linhas.length)} {linhas.length === 1 ? "pasto" : "pastos"} · {formatNumero(totalCabecas)} cabeças
            {vazios.length > 0 && ` · ${formatNumero(vazios.length)} ${vazios.length === 1 ? "vazio" : "vazios"}`}
          </p>
        </div>
        <a
          href="#lancamento"
          className="rounded-btn bg-primary-900 px-4 py-2 text-center text-sm font-medium text-white dark:bg-primary-500"
        >
          Lançar estoque
        </a>
      </div>

      {vazios.length > 0 && (
        <section className="rounded-card border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-black dark:text-zinc-50">{vazios.length}</span>
              <span className="text-sm font-semibold text-black dark:text-zinc-50">
                {vazios.length === 1 ? "pasto sem gado agora" : "pastos sem gado agora"}
              </span>
            </div>
            <span className="text-xs tabular-nums text-zinc-500">
              {haOciosos > 0 && `${formatNumero(haOciosos)} ha ociosos · `}
              mais antigo há {labelDiasEstado(vazios[0].estado)} dias
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {vazios.map(({ pasto, estado }) => {
              const banda = bandaVazio(estado.diasNoEstado);
              return (
                <div key={pasto.id} className={`rounded-input border p-3 ${BANDA_CLASSES[banda.chave]}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-black dark:text-zinc-50">{pasto.nome}</span>
                    {pasto.hectares != null && (
                      <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">{formatNumero(pasto.hectares)} ha</span>
                    )}
                  </div>
                  <div className="text-base font-bold tabular-nums">vazio há {labelDiasEstado(estado)} d</div>
                  <div className="mt-0.5 text-[10px] tabular-nums text-zinc-500">zerou em {formatData(estado.desde)}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            Vazio pouco tempo é descanso normal — a cor só escala quando o vazio começa a virar capim ocioso.
          </p>
        </section>
      )}

      {pendencias.length > 0 && (
        <a
          href="#conferencia"
          className="flex items-center gap-2 rounded-input border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600 dark:bg-amber-400" />
          <span className="font-medium text-amber-800 dark:text-amber-400">
            {pendencias.length} {pendencias.length === 1 ? "lançamento aguardando" : "lançamentos aguardando"} conferência
          </span>
          <span className="ml-auto shrink-0 text-xs font-semibold text-amber-800 underline dark:text-amber-400">Conferir</span>
        </a>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Pastos com gado{ocupados.length > 0 && ` · ${ocupados.length}`}
        </h2>
        {ocupados.length === 0 ? (
          <p className="rounded-card border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            Nenhum pasto ocupado.
          </p>
        ) : (
          <>
            <ScrollHint />
            <div className="hidden overflow-x-auto rounded-card border border-zinc-200 shadow-sm sm:block dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">Pasto</th>
                    <th className="px-3 py-2 text-right">ha</th>
                    <th className="px-3 py-2 text-right">Cabeças</th>
                    <th className="px-3 py-2">Categorias</th>
                    <th className="px-3 py-2">Ocupado</th>
                    <th className="px-3 py-2">Últ. lançamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {ocupados.map(({ pasto, estado }) => (
                    <tr key={pasto.id} className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                      <td className="px-3 py-2 font-medium text-black dark:text-zinc-50">{pasto.nome}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {pasto.hectares != null ? formatNumero(pasto.hectares) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-[15px] font-bold tabular-nums text-black dark:text-zinc-50">
                        {formatNumero(estado.totalAtual)}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">{formatCategorias(estado.categorias)}</td>
                      <td className="px-3 py-2">
                        <span className={chipOcupado}>há {labelDiasEstado(estado)} d</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{formatData(estado.ultimoLancamento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 sm:hidden">
              {ocupados.map(({ pasto, estado }) => (
                <div key={pasto.id} className="rounded-card border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-black dark:text-zinc-50">{pasto.nome}</p>
                      <p className="text-xs tabular-nums text-zinc-500">
                        {pasto.hectares != null ? `${formatNumero(pasto.hectares)} ha · ` : ""}
                        {formatData(estado.ultimoLancamento)}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-bold tabular-nums text-black dark:text-zinc-50">
                      {formatNumero(estado.totalAtual)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={chipOcupado}>ocupado há {labelDiasEstado(estado)} d</span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{formatCategorias(estado.categorias)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {pendencias.length > 0 && (
        <section id="conferencia">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Aguardando conferência ({pendencias.length})
          </h2>
          <Conferencia fazendaCodigo={codigo} fazendaId={fazenda.id} pendencias={pendencias} pastoIdPorNome={pastoIdPorNome} />
        </section>
      )}

      <section id="lancamento">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Lançamento manual</h2>
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <LancamentoManual fazendaCodigo={codigo} fazendaId={fazenda.id} pastos={pastos} />
        </div>
      </section>

      <details className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-zinc-500">
          Como contamos os dias
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>
            <strong className="text-black dark:text-zinc-50">Estado atual</strong> — soma das categorias do lançamento mais
            recente de cada pasto. Zero ⇒ vazio.
          </p>
          <p>
            <strong className="text-black dark:text-zinc-50">Vazio/ocupado há N dias</strong> — desde o primeiro lançamento
            da sequência atual, não o último: reforçar o mesmo estado não reinicia a contagem, só uma mudança de zero para
            não-zero (ou o contrário) reinicia.
          </p>
          <p>
            <strong className="text-black dark:text-zinc-50">Pasto sem histórico do estado anterior</strong> — conta desde o
            primeiro lançamento existente; acima de 120 dias mostramos &quot;120+&quot; pra não sugerir uma precisão que o
            dado não tem.
          </p>
        </div>
      </details>
    </div>
  );
}
