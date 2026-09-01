import { notFound } from "next/navigation";
import { getFazendaByCodigo, getPapelUsuario } from "@/lib/queries/fazenda";
import { getFichaAnimal } from "@/lib/queries/animais";
import { WeightChart } from "@/components/WeightChart";
import { StatusBadge } from "@/components/StatusBadge";
import { formatData, formatNumero, formatMoeda } from "@/lib/format";
import { CeCmForm } from "./CeCmForm";

function Campo({ label, valor }: { label: string; valor: string | number | null | undefined }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium text-black dark:text-zinc-50">{valor}</p>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">{titulo}</h2>
      <div className="grid grid-cols-2 gap-3 rounded-card border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </div>
    </div>
  );
}

export default async function FichaAnimalPage({
  params,
}: {
  params: Promise<{ fazenda: string; id: string }>;
}) {
  const { fazenda: codigo, id } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const [ficha, papel] = await Promise.all([
    getFichaAnimal(fazenda.id, id),
    getPapelUsuario(fazenda.id),
  ]);
  if (!ficha) notFound();

  const podeEditar = papel === "dono" || papel === "gestor";
  const po = ficha.dadosPo;
  const ind = ficha.indicadores;
  const valorReferencial =
    ind?.arrobaViva != null && ficha.precoArrobaReferencia != null
      ? ind.arrobaViva * ficha.precoArrobaReferencia
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{ficha.brinco}</h1>
        <p className="text-sm text-zinc-500">
          Curral {ficha.curralCodigo} · {ficha.categoriaNome}
        </p>
      </div>

      {po && (po.conciliacaoStatus === "Revisar") && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          Conciliação com a base de registro (PO) pendente de revisão
          {po.conciliacaoObservacao ? `: ${po.conciliacaoObservacao}` : "."}
        </div>
      )}

      {po && (
        <Bloco titulo="Identificação">
          <Campo label="Nome completo" valor={po.nomeCompleto} />
          <Campo label="Apelido" valor={po.apelido} />
          <Campo label="RGN" valor={po.rgn} />
          <Campo label="RGD" valor={po.rgd} />
          <Campo label="Raça" valor={po.racaPo} />
          <Campo label="GS" valor={po.gs} />
          <Campo label="Tipo" valor={po.tipoReprodutivo} />
          <Campo label="Status conciliação" valor={po.conciliacaoStatus} />
        </Bloco>
      )}

      {po && (po.pai || po.mae) && (
        <Bloco titulo="Genealogia">
          <Campo label="Pai" valor={po.pai} />
          <Campo label="RGN do pai" valor={po.rgnPai} />
          <Campo label="RGD do pai" valor={po.rgdPai} />
          <Campo label="Mãe" valor={po.mae} />
          <Campo label="Mãe receptora" valor={po.maeReceptora} />
          <Campo label="Avô paterno" valor={po.avoPaterno} />
          <Campo label="Avó paterna" valor={po.avoPaterna} />
          <Campo label="Avô materno" valor={po.avoMaterno} />
          <Campo label="Avó materna" valor={po.avoMaterna} />
        </Bloco>
      )}

      {po && (po.dataNascimento || po.pesoNascimentoKg || po.pesoDesmameKg || po.pesoPoUltimaKg) && (
        <Bloco titulo="Nascimento e pesos">
          <Campo label="Data de nascimento" valor={formatData(po.dataNascimento)} />
          <Campo label="Peso ao nascer" valor={po.pesoNascimentoKg ? `${formatNumero(po.pesoNascimentoKg)} kg` : null} />
          <Campo
            label="Peso à desmama"
            valor={po.pesoDesmameKg ? `${formatNumero(po.pesoDesmameKg)} kg (${formatData(po.dataDesmame)})` : null}
          />
          <Campo
            label="Último peso (base PO)"
            valor={po.pesoPoUltimaKg ? `${formatNumero(po.pesoPoUltimaKg)} kg (${formatData(po.dataPesoPo)})` : null}
          />
        </Bloco>
      )}

      <Bloco titulo="Confinamento">
        <Campo label="Origem" valor={ficha.loteOrigem} />
        <Campo label="Entrada" valor={formatData(ficha.dataEntrada)} />
        <Campo label="Peso entrada" valor={`${formatNumero(ficha.pesoEntradaKg)} kg`} />
        <Campo label="Dieta vigente" valor={ficha.dietaAtualNome} />
        <Campo label="Última pesagem" valor={formatData(ind?.dataUltimaPesagem)} />
        <Campo label="Peso atual" valor={ind?.pesoAtualKg != null ? `${formatNumero(ind.pesoAtualKg)} kg` : null} />
        <Campo label="Dias confinado" valor={ind?.diasConfinado} />
        <Campo label="GMD" valor={ind?.gmdKgDia != null ? `${formatNumero(ind.gmdKgDia, 3)} kg/dia` : null} />
        <Campo label="@ viva atual" valor={ind?.arrobaViva != null ? formatNumero(ind.arrobaViva, 2) : null} />
        <Campo
          label="Valor de referência"
          valor={
            valorReferencial != null
              ? `${formatMoeda(valorReferencial)} — @ a ${formatMoeda(ficha.precoArrobaReferencia)}`
              : null
          }
        />
        <Campo
          label="Meta de GMD"
          valor={ind?.atingiuMetaGmd === null || ind?.atingiuMetaGmd === undefined ? null : ind.atingiuMetaGmd ? "Sim" : "Não"}
        />
        {ind?.alertaPesagem && (
          <div>
            <p className="text-xs text-zinc-500">Pesagem</p>
            <StatusBadge status={ind.alertaPesagem} label={`${formatNumero(ind.diasDesdeUltimaPesagem)} dias sem pesar`} />
          </div>
        )}
      </Bloco>

      {po && (
        <Bloco titulo="Andrológico">
          <div className="col-span-2 sm:col-span-3">
            <p className="mb-1 text-xs text-zinc-500">Circunferência escrotal (CE)</p>
            {podeEditar ? (
              <CeCmForm fazendaCodigo={codigo} animalId={ficha.animalId} ceCmAtual={po.ceCm} />
            ) : (
              <p className="font-medium text-black dark:text-zinc-50">
                {po.ceCm != null ? `${formatNumero(po.ceCm, 1)} cm` : "—"}
              </p>
            )}
          </div>
        </Bloco>
      )}

      {po && (po.statusPo || po.fazendaPo || po.localPo || po.loteReprodutivo || po.fornecedor || po.dataAquisicao) && (
        <Bloco titulo="Outros (base PO)">
          <Campo label="Status PO" valor={po.statusPo} />
          <Campo label="Fazenda" valor={po.fazendaPo} />
          <Campo label="Local" valor={po.localPo} />
          <Campo label="Lote reprodutivo" valor={po.loteReprodutivo} />
          <Campo label="Fornecedor" valor={po.fornecedor} />
          <Campo label="Data de aquisição" valor={formatData(po.dataAquisicao)} />
        </Bloco>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Peso ao longo do tempo
        </h2>
        <div className="rounded-card border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <WeightChart pontos={ficha.historicoPesagens.map((p) => ({ data: p.data, pesoKg: p.pesoKg }))} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Histórico de pesagens
        </h2>
        <div className="overflow-x-auto rounded-card border border-zinc-200 shadow-sm dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2 text-right">Peso (kg)</th>
                <th className="px-3 py-2">Obs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ficha.historicoPesagens.map((p, i) => (
                <tr key={i} className="bg-white dark:bg-zinc-950">
                  <td className="px-3 py-2 tabular-nums">{formatData(p.data)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumero(p.pesoKg)}</td>
                  <td className="px-3 py-2 text-zinc-500">{p.obs ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
