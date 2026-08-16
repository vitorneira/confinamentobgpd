"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        setErro("E-mail ou senha inválidos.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErro("Não foi possível conectar. Verifique sua internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="mb-6 text-xl font-semibold text-black dark:text-zinc-50">
          Confinamento BG / PD
        </h1>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          E-mail
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Senha
        </label>
        <input
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mb-4 w-full rounded border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
