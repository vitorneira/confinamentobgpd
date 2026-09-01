// Cliente Supabase com a chave de serviço (bypassa RLS) — SÓ pra contexto de
// servidor sem sessão de usuário (scripts, webhook/Edge Function de ingestão).
// NUNCA importar isto de um componente cliente ('use client') ou de qualquer
// código que rode no browser (CLAUDE.md guardrail: nunca expor a chave de
// serviço no front). Mesmo padrão de scripts/import/lib.ts.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!supabaseUrl || !serviceKey) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no .env.local");
}

export const supabaseServico = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});
