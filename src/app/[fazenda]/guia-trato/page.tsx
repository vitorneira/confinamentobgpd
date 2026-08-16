import Link from "next/link";
import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import {
  getCurraisComDietaVigente,
  getGuiaTrato,
  getUltimoGuiaAntesDe,
  getVagoesSalvos,
} from "@/lib/queries/guia-trato";
import { GuiaTratoForm } from "./GuiaTratoForm";
import { formatData } from "@/lib/format";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function GuiaTratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ fazenda: string }>;
  searchParams: Promise<{ data?: string }>;
}) {
  const { fazenda: codigo } = await params;
  const { data: dataParam } = await searchParams;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const data = dataParam ?? hojeISO();
  const base_ = `/${codigo.toLowerCase()}`;

  const [currais, guiaExistente, ultimoGuia] = await Promise.all([
    getCurraisComDietaVigente(fazenda.id, data),
    getGuiaTrato(fazenda.id, data),
    getUltimoGuiaAntesDe(fazenda.id, data),
  ]);

  const base = guiaExistente ?? ultimoGuia;
  const vagoesSalvos = guiaExistente ? await getVagoesSalvos(guiaExistente.id) : [];

  const curraisIniciais = currais.map((c) => {
    const prefill = base?.porCurral.get(c.curralId);
    return {
      curralId: c.curralId,
      curralCodigo: c.curralCodigo,
      dietaId: c.dietaId,
      dietaNome: c.dietaNome,
      totalDiaKg: prefill?.totalDiaKg ?? 0,
      ajustePct: prefill?.ajustePct ?? 0,
      ajusteKg: prefill?.ajusteKg ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Guia de Trato — {formatData(data)}</h1>
        <div className="flex gap-3 text-sm">
          <Link href={`${base_}/guia-trato/confirmacao`} className="text-zinc-600 underline dark:text-zinc-400">
            Confirmar tratos
          </Link>
          {guiaExistente && (
            <a
              href={`/api/guia-trato-folha?fazenda=${codigo}&data=${data}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-600 underline dark:text-zinc-400"
            >
              Folha PDF
            </a>
          )}
        </div>
      </div>
      {guiaExistente ? (
        <p className="mb-4 text-xs text-zinc-500">plano já salvo neste dia — editando</p>
      ) : ultimoGuia ? (
        <p className="mb-4 text-xs text-zinc-500">
          sem plano salvo hoje ainda — pré-preenchido com o último guia salvo antes de {formatData(data)}; confirme
          ou ajuste
        </p>
      ) : null}

      <GuiaTratoForm
        fazendaCodigo={codigo}
        fazendaId={fazenda.id}
        data={data}
        guiaTratoIdInicial={guiaExistente?.id ?? null}
        capacidadeVagaoInicial={base?.capacidadeVagao ?? 2200}
        splitInicial={{
          manha: base?.splitManha ?? 0.4,
          almoco: base?.splitAlmoco ?? 0.2,
          tarde: base?.splitTarde ?? 0.4,
        }}
        curraisIniciais={curraisIniciais}
        vagoesSalvosIniciais={vagoesSalvos}
      />
    </div>
  );
}
