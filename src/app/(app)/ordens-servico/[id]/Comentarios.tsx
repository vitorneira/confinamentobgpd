"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarComentario } from "../actions";
import { formatDataHora } from "@/lib/format";
import type { ComentarioOs } from "@/lib/queries/ordens-servico";

export function Comentarios({
  osId,
  comentarios,
  emailDe,
}: {
  osId: string;
  comentarios: ComentarioOs[];
  emailDe: (id: string | null) => string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    setErro(null);
    if (!texto.trim()) return;
    startTransition(async () => {
      const resultado = await adicionarComentario(osId, texto.trim());
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível comentar.");
        return;
      }
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Comentários</h2>
      {comentarios.length === 0 ? (
        <p className="mb-3 text-sm text-zinc-500">Nenhum comentário ainda.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {comentarios.map((c) => (
            <li key={c.id} className="rounded-input bg-zinc-100 p-2 text-sm dark:bg-zinc-800/60">
              <p className="text-black dark:text-zinc-50">{c.texto}</p>
              <p className="mt-1 text-[10.5px] text-zinc-500">
                {emailDe(c.autor_id)} · {formatDataHora(c.criado_em)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Adicionar um comentário..."
          className="flex-1 rounded-input border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          disabled={pending}
          onClick={enviar}
          className="rounded-btn bg-primary-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
      {erro && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  );
}
