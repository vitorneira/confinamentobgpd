import Link from "next/link";
import { notFound } from "next/navigation";
import { getFazendaByCodigo, getPapelUsuario } from "@/lib/queries/fazenda";
import { getVendaLoteEditavel, getItensVenda, getAnimaisAtivosDoCurral } from "@/lib/queries/vendas";
import { EditarVendaForm } from "./EditarVendaForm";

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ fazenda: string; id: string }>;
}) {
  const { fazenda: codigo, id } = await params;
  const fazenda = await getFazendaByCodigo(codigo);
  if (!fazenda) notFound();

  const papel = await getPapelUsuario(fazenda.id);
  if (papel !== "dono") notFound();

  const venda = await getVendaLoteEditavel(fazenda.id, id);
  if (!venda) notFound();

  const [itens, animaisDisponiveis] = await Promise.all([
    getItensVenda(id),
    getAnimaisAtivosDoCurral(fazenda.id, venda.curralId),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <Link
          href={`/${codigo.toLowerCase()}/vendas/${id}`}
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          ← relatório da venda
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">Editar venda</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Só o dono edita uma venda já fechada — corrige animal esquecido, valores, frete/comissão etc.
        </p>
      </div>

      <EditarVendaForm
        fazendaCodigo={codigo}
        fazendaId={fazenda.id}
        vendaLoteId={id}
        venda={venda}
        itensIniciais={itens}
        animaisDisponiveis={animaisDisponiveis}
      />
    </div>
  );
}
