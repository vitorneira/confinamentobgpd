import { createClient } from "@/lib/supabase/server";
import { compararCodigo } from "@/lib/format";

export type PesagemExportada = {
  data: string;
  curralCodigo: string;
  tipo: "individual" | "agregado";
  identificacao: string;
  pesoKg: number | null;
  obs: string | null;
};

/** Histórico completo de pesagens da fazenda (evento — fonte da verdade), para exportação. */
export async function getPesagensParaExportacao(fazendaId: string): Promise<PesagemExportada[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pesagens")
    .select("data, peso_kg, evento_obs, animais(tipo, brinco), currais(codigo)")
    .eq("fazenda_id", fazendaId);

  return (data ?? [])
    .map((p) => {
      const animal = p.animais as unknown as { tipo: "individual" | "agregado"; brinco: string | null } | null;
      const curral = p.currais as unknown as { codigo: string } | null;
      return {
        data: p.data as string,
        curralCodigo: curral?.codigo ?? "?",
        tipo: animal?.tipo ?? "individual",
        identificacao: animal?.tipo === "agregado" ? "Lote agregado" : animal?.brinco ?? "?",
        pesoKg: p.peso_kg as number | null,
        obs: p.evento_obs as string | null,
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data) || compararCodigo(a.curralCodigo, b.curralCodigo));
}
