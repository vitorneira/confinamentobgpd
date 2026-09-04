import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";
import {
  getContagensPorStatus,
  getFazendasAcessiveis,
  getFilaOs,
  getMensagensPendentesTriagem,
  type OsStatus,
} from "@/lib/queries/ordens-servico";
import { DOMINIOS, ROTULO_DOMINIO, type Dominio } from "@/lib/orquestrador/tipos";
import { OsStatusBadge } from "@/components/OsStatusBadge";
import { formatMoeda } from "@/lib/format";

const STATUS_ORDEM: OsStatus[] = [
  "aberta",
  "cotando",
  "aguardando_autorizacao",
  "aprovada",
  "comprada",
  "entregue",
  "conferida",
  "cancelada",
];

export default async function OrdensServicoPage({
  searchParams,
}: {
  searchParams: Promise<{ fazenda?: string; status?: string; dominio?: string; q?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const pagina = Number(sp.pagina) || 1;

  const fazendas = await getFazendasAcessiveis();
  const fazendaSelecionada = sp.fazenda ? fazendas.find((f) => f.codigo === sp.fazenda) : undefined;

  const [{ itens, total }, contagens, pendentesTriagem] = await Promise.all([
    getFilaOs({
      fazendaId: fazendaSelecionada?.id,
      status: sp.status as OsStatus | undefined,
      dominio: sp.dominio as Dominio | undefined,
      busca: sp.q,
      pagina,
    }),
    getContagensPorStatus(fazendaSelecionada?.id),
    getMensagensPendentesTriagem(),
  ]);

  const totalGeral = Object.values(contagens).reduce((a, b) => a + b, 0);
  const totalAbertas = contagens.aberta ?? 0;
  const totalAguardando = contagens.aguardando_autorizacao ?? 0;

  const filtrosAtivos = Boolean(sp.fazenda || sp.status || sp.dominio || sp.q);
  const construirLink = (ajustes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const atual = { fazenda: sp.fazenda, status: sp.status, dominio: sp.dominio, q: sp.q, ...ajustes };
    for (const [k, v] of Object.entries(atual)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/ordens-servico?${qs}` : "/ordens-servico";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Fila</h1>
          <p className="text-sm text-zinc-500">
            {totalAbertas} abertas · {totalAguardando} aguardando autorização
            {pendentesTriagem.length > 0 && ` · ${pendentesTriagem.length} chegando agora`}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <Link href="/fornecedores" className="text-sm text-zinc-500 underline hover:text-black dark:hover:text-zinc-200">
            Fornecedores
          </Link>
          <Link href="/prestadores" className="text-sm text-zinc-500 underline hover:text-black dark:hover:text-zinc-200">
            Prestadores
          </Link>
          <Link href="/funcionarios" className="text-sm text-zinc-500 underline hover:text-black dark:hover:text-zinc-200">
            Funcionários
          </Link>
          <Link
            href="/ordens-servico/nova"
            className="flex items-center gap-1.5 rounded-btn bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus size={16} /> Nova OS
          </Link>
        </div>
      </div>

      {pendentesTriagem.length > 0 && (
        <div
          className="mb-4 flex items-center gap-3 rounded-card border p-3 text-sm"
          style={{ background: "var(--os-atencao-bg)", borderColor: "var(--os-atencao-borda)", color: "var(--os-atencao-fg)" }}
        >
          <AlertCircle size={18} className="shrink-0" />
          <p className="flex-1">
            {pendentesTriagem.length} mensagem{pendentesTriagem.length > 1 ? "s" : ""} classificada
            {pendentesTriagem.length > 1 ? "s" : ""} esperando confirmação — revise domínio e itens antes de
            virarem OS.
          </p>
          <Link href="/ordens-servico/triagem" className="shrink-0 font-semibold underline">
            Revisar
          </Link>
        </div>
      )}

      <form className="mb-3 flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Buscar por ID, título ou solicitante"
          className="min-w-[220px] flex-1 rounded-input border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          name="fazenda"
          defaultValue={sp.fazenda ?? ""}
          className="rounded-input border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Todas as fazendas</option>
          {fazendas.map((f) => (
            <option key={f.id} value={f.codigo}>
              {f.codigo} — {f.nome}
            </option>
          ))}
        </select>
        <select
          name="dominio"
          defaultValue={sp.dominio ?? ""}
          className="rounded-input border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Todos os domínios</option>
          {DOMINIOS.map((d) => (
            <option key={d} value={d}>
              {ROTULO_DOMINIO[d]}
            </option>
          ))}
        </select>
        <input type="hidden" name="status" value={sp.status ?? ""} />
        <button type="submit" className="rounded-btn bg-primary-900 px-4 py-2 text-sm font-medium text-white dark:bg-primary-500">
          Filtrar
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={construirLink({ status: undefined, pagina: undefined })}
          className={`rounded-full border px-3 py-1 text-xs font-bold ${
            !sp.status
              ? "border-primary-500 bg-primary-500 text-white"
              : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          Todos · {totalGeral}
        </Link>
        {STATUS_ORDEM.map((s) => (
          <Link key={s} href={construirLink({ status: sp.status === s ? undefined : s, pagina: undefined })}>
            <OsStatusBadge status={s} tamanho="sm" />
          </Link>
        ))}
      </div>

      {itens.length === 0 ? (
        <div className="rounded-card border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-medium text-black dark:text-zinc-50">Nenhuma ordem com esses filtros</p>
          <p className="mt-1 text-sm text-zinc-500">
            {filtrosAtivos
              ? `Você está vendo ${fazendaSelecionada?.nome ?? "todas as fazendas"}${sp.status ? ` + status ${sp.status.replace("_", " ")}` : ""} — existem ${totalGeral} ordens sem filtro.`
              : "Nenhuma ordem de serviço cadastrada ainda."}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {filtrosAtivos && (
              <Link href="/ordens-servico" className="rounded-btn border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700">
                Limpar filtros
              </Link>
            )}
            <Link href="/ordens-servico/nova" className="rounded-btn bg-primary-500 px-4 py-2 text-sm font-semibold text-white">
              Nova OS
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
            <table className="w-full text-sm" style={{ minWidth: 1000 }}>
              <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Domínio</th>
                  <th className="px-3 py-2">Fazenda</th>
                  <th className="px-3 py-2 text-right">Valor est.</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {itens.map((os, i) => (
                  <tr
                    key={os.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-900 ${i % 2 === 1 ? "bg-zinc-50/60 dark:bg-zinc-900/40" : "bg-white dark:bg-zinc-950"}`}
                  >
                    <td className="px-3 py-2">
                      <Link href={`/ordens-servico/${os.id}`} className="font-bold tabular-nums text-primary-700 dark:text-primary-300">
                        {os.id}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-3 py-2">
                      <Link href={`/ordens-servico/${os.id}`} className="hover:underline">
                        {os.descricao ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{ROTULO_DOMINIO[os.dominio]}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium dark:border-zinc-700">
                        {os.fazenda_codigo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(os.valor_estimado)}</td>
                    <td className="px-3 py-2">
                      <OsStatusBadge status={os.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
            <p>
              Mostrando {itens.length} de {total} ordens
            </p>
            {itens.length < total && (
              <Link href={construirLink({ pagina: String(pagina + 1) })} className="font-medium underline">
                Carregar mais
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
