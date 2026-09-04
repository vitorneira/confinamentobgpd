"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";

export async function atualizarCeCm(
  fazendaCodigo: string,
  animalId: string,
  ceCm: number | null,
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("animais_dados_po")
    .upsert({ animal_id: animalId, ce_cm: ceCm, updated_at: new Date().toISOString() });
  if (error) return { ok: false, erro: erroAmigavel(error) };

  revalidatePath(`/${fazendaCodigo.toLowerCase()}/animais/${animalId}`);
  return { ok: true };
}
