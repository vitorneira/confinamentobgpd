import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { getOsDetalhe, getStatusHistorico, getUsuariosDaFazenda } from "@/lib/queries/ordens-servico";
import { ROTULO_DOMINIO } from "@/lib/orquestrador/tipos";
import { OsStatusBadge } from "@/components/OsStatusBadge";
import { formatData, formatDataHora, formatMoeda, formatTempoRelativo } from "@/lib/format";
import { StatusChanger } from "./StatusChanger";

function Campo({ label, valor, destaque }: { label: string; valor: React.ReactNode; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-[13.5px] font-semibold ${destaque ? "" : "text-black dark:text-zinc-50"}`}>{valor}</p>
    </div>
  );
}

function prazoEstaProximo(prazoPedido: string | null): boolean {
  return Boolean(prazoPedido && new Date(prazoPedido).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000);
}

export default async function OsDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const os = await getOsDetalhe(id);
  if (!os) notFound();

  const [historico, usuarios] = await Promise.all([getStatusHistorico(id), getUsuariosDaFazenda(os.fazenda_id)]);
  const emailDe = (userId: string | null) => (userId ? (usuarios.find((u) => u.id === userId)?.email ?? "—") : "—");

  const totalItens = os.itens.reduce((soma, it) => {
    const qtd = Number(it.qtd) || 0;
    return soma + qtd * (it.valor_unitario ?? 0);
  }, 0);

  const prazoProximo = prazoEstaProximo(os.prazo_pedido);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tabular-nums text-primary-300">{os.id}</span>
            <OsStatusBadge status={os.status} />
            <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium dark:border-zinc-700">
              {os.fazenda_codigo}
            </span>
          </div>
          <h1 className="mt-1 text-[19px] font-extrabold text-black dark:text-zinc-50">
            {os.descricao ?? "Sem descrição"}
          </h1>
        </div>
        <StatusChanger osId={os.id} statusAtual={os.status} />
      </div>

      <div className="grid grid-cols-1 gap-[30px] lg:grid-cols-[1.55fr_1fr]">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Dados da ordem</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Campo label="Solicitante" valor={emailDe(os.solicitante_id)} />
              <Campo label="Responsável" valor={emailDe(os.responsavel_id)} />
              <Campo label="Domínio" valor={ROTULO_DOMINIO[os.dominio]} />
              <Campo label="Fornecedor" valor={os.fornecedor_nome ?? "—"} />
              <Campo
                label="Curral vinculado"
                valor={
                  os.curral_codigo ? (
                    <Link href={`/${os.fazenda_codigo.toLowerCase()}/currais`} className="text-primary-300 hover:underline">
                      Curral {os.curral_codigo} ↗
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Campo label="Aberta em" valor={formatDataHora(os.criado_em)} />
              <Campo
                label="Prazo pedido"
                valor={<span style={prazoProximo ? { color: "var(--os-atencao-fg)" } : undefined}>{formatData(os.prazo_pedido)}</span>}
              />
              <Campo label="Valor estimado" valor={formatMoeda(os.valor_estimado)} />
            </div>
          </div>

          <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">Intenção declarada</h2>
            <div className="rounded-input bg-zinc-100 p-3 text-sm italic text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              &ldquo;{os.descricao}&rdquo;
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Classificado como <strong>{ROTULO_DOMINIO[os.dominio]}</strong> · intenção <strong>{os.intencao.replace("_", " ")}</strong>
              {os.canal_origem && ` · origem: ${os.canal_origem}`}
            </p>
          </div>

          <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">Itens</h2>
            {os.itens.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum item registrado.</p>
            ) : (
              <div className="overflow-x-auto rounded-input bg-zinc-50 dark:bg-zinc-800/60">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Qtd</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Valor unit.</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {os.itens.map((it, i) => (
                      <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                        <td className="px-3 py-2 tabular-nums">{it.qtd ?? "—"}</td>
                        <td className="px-3 py-2">{it.item}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(it.valor_unitario)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {it.valor_unitario ? formatMoeda((Number(it.qtd) || 0) * it.valor_unitario) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-300 font-semibold dark:border-zinc-600">
                      <td className="px-3 py-2" colSpan={3}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(totalItens)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-card border border-dashed border-zinc-400 p-4 dark:border-zinc-600">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={os.autorizacao_dono} readOnly className="h-4 w-4" />
              <p className="text-sm font-semibold text-black dark:text-zinc-50">Autorização do dono</p>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Campo registrado, sem fluxo automático nesta versão — marcar aqui não dispara notificação nem libera
              compra.
            </p>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Anexos</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                em breve
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-input border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500 opacity-65 dark:border-zinc-700">
              <Paperclip size={14} /> Arraste foto, PDF ou NF aqui — upload em breve
            </div>
          </div>

          <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Timeline</h2>
            <ol className="space-y-4">
              {historico.map((h, i) => {
                const atual = i === historico.length - 1;
                return (
                  <li key={i} className="relative pl-6">
                    {i < historico.length - 1 && (
                      <span
                        className="absolute left-[5px] top-4 h-full w-px"
                        style={{ background: atual ? undefined : "var(--os-sucesso-borda)" }}
                      />
                    )}
                    <span
                      className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full"
                      style={{
                        background: atual ? "var(--os-atencao-fg)" : "var(--os-sucesso-fg)",
                        boxShadow: atual ? "0 0 0 4px var(--os-atencao-bg)" : undefined,
                      }}
                    />
                    <p
                      className="text-sm font-medium"
                      style={{ color: atual ? "var(--os-atencao-fg)" : undefined }}
                    >
                      {h.status.replace("_", " ")}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDataHora(h.criado_em)} · {emailDe(h.autor_id)}
                      {atual && ` · ${formatTempoRelativo(h.criado_em)} parado`}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
