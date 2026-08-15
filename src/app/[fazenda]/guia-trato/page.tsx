import { notFound } from "next/navigation";
import { getFazendaByCodigo } from "@/lib/queries/fazenda";
import { getCurraisComDietaVigente, getGuiaTrato, getUltimoGuiaAntesDe } from "@/lib/queries/guia-trato";
import { GuiaTratoForm } from "./GuiaTratoForm";

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

  const [currais, guiaExistente] = await Promise.all([
    getCurraisComDietaVigente(fazenda.id, data),
    getGuiaTrato(fazenda.id, data),
  ]);

  const base = guiaExistente ?? (await getUltimoGuiaAntesDe(fazenda.id, data));

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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Guia de Trato — {data}</h1>
        {guiaExistente && <span className="text-xs text-zinc-500">já confirmado neste dia (editando)</span>}
      </div>

      <GuiaTratoForm
        fazendaCodigo={codigo}
        fazendaId={fazenda.id}
        data={data}
        capacidadeVagaoInicial={base?.capacidadeVagao ?? 2200}
        splitInicial={{
          manha: base?.splitManha ?? 0.4,
          almoco: base?.splitAlmoco ?? 0.2,
          tarde: base?.splitTarde ?? 0.4,
        }}
        curraisIniciais={curraisIniciais}
      />
    </div>
  );
}
