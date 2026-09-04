// Cliente Supabase com a chave de serviço (bypassa RLS) — SÓ pra contexto de
// servidor sem sessão de usuário (scripts, webhook de ingestão). NUNCA
// importar isto de um componente cliente ('use client') ou de qualquer
// código que rode no browser (CLAUDE.md guardrail: nunca expor a chave de
// serviço no front).
//
// Preguiçoso de propósito: o Next.js/Vercel avalia este módulo durante o
// PRÓPRIO BUILD (ao coletar a configuração de cada rota, inclusive
// /api/telegram-webhook, que importa isto via ingest.ts) — se o client
// fosse criado (e as env vars conferidas) no top-level do arquivo, o build
// quebraria sempre que essas variáveis não estivessem visíveis nesse
// momento, mesmo que estejam corretas em runtime. Um Proxy adia a criação
// (e a checagem das env vars) pro primeiro uso de verdade, sem mudar como
// o resto do código chama (`supabaseServico.from(...)` continua igual).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

function obterCliente(): SupabaseClient {
  if (cliente) return cliente;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no .env.local");
  }

  cliente = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  return cliente;
}

export const supabaseServico: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(obterCliente(), prop, receiver);
  },
});
