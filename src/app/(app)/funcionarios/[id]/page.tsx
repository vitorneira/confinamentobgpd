import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocumentosFuncionario, getFuncionario } from "@/lib/queries/funcionarios";
import { getPapelUsuario } from "@/lib/queries/fazenda";
import { FuncionarioDetalhe } from "./FuncionarioDetalhe";

export default async function FuncionarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const funcionario = await getFuncionario(id);
  if (!funcionario) notFound();

  const [documentos, papel] = await Promise.all([getDocumentosFuncionario(id), getPapelUsuario(funcionario.fazenda_id)]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{funcionario.apelido || funcionario.nome_completo}</h1>
        <Link href="/funcionarios" className="text-sm text-zinc-500 underline">
          ← voltar pra lista
        </Link>
      </div>
      <FuncionarioDetalhe funcionario={funcionario} documentos={documentos} podeEditar={papel === "dono"} />
    </div>
  );
}
