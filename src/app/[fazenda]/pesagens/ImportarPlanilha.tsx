"use client";

import { useState, useTransition } from "react";
import { previewImportacao, confirmarImportacao } from "./actions";
import type { AnimalValidado, PesagemValidada } from "@/lib/pesagens/validacao";
import { formatData, formatNumero } from "@/lib/format";

export function ImportarPlanilha({ fazendaCodigo, fazendaId }: { fazendaCodigo: string; fazendaId: string }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ pesagens: PesagemValidada[]; animaisNovos: AnimalValidado[] } | null>(
    null,
  );
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [selecionadosNovos, setSelecionadosNovos] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<string | null>(null);

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setResultado(null);
    startTransition(async () => {
      const resultado = await previewImportacao(fazendaId, file);
      setPreview(resultado);
      setSelecionadas(new Set(resultado.pesagens.filter((p) => !p.erro).map((p) => p.linha)));
      setSelecionadosNovos(new Set(resultado.animaisNovos.filter((a) => !a.erro).map((a) => a.linha)));
    });
  }

  function handleConfirmar() {
    if (!preview) return;
    setErro(null);
    startTransition(async () => {
      const pesagens = preview.pesagens.filter((p) => selecionadas.has(p.linha));
      const animaisNovos = preview.animaisNovos.filter((a) => selecionadosNovos.has(a.linha));
      const r = await confirmarImportacao(fazendaCodigo, fazendaId, pesagens, animaisNovos);
      if (!r.ok) {
        setErro(r.erro ?? "Erro ao confirmar.");
        return;
      }
      setResultado(`${r.pesagensGravadas} pesagens gravadas, ${r.animaisCriados} animais novos cadastrados.`);
      setPreview(null);
    });
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".xlsx"
        onChange={handleArquivo}
        className="block text-sm file:mr-3 file:rounded file:border-0 file:bg-black file:px-4 file:py-2 file:text-white dark:file:bg-white dark:file:text-black"
      />
      {pending && <p className="text-sm text-zinc-500">Processando...</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {resultado && <p className="text-sm text-green-700 dark:text-green-400">{resultado}</p>}

      {preview && (
        <>
          {preview.animaisNovos.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Cadastro de animais novos ({preview.animaisNovos.length})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                    <tr>
                      <th className="px-2 py-2"></th>
                      <th className="px-2 py-2">Linha</th>
                      <th className="px-2 py-2">Tipo</th>
                      <th className="px-2 py-2">Brinco/Qtd</th>
                      <th className="px-2 py-2">Categoria</th>
                      <th className="px-2 py-2">Curral</th>
                      <th className="px-2 py-2">Entrada</th>
                      <th className="px-2 py-2">Peso</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {preview.animaisNovos.map((a) => (
                      <tr key={a.linha} className={a.erro ? "bg-red-50 dark:bg-red-950/40" : "bg-white dark:bg-zinc-950"}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            disabled={!!a.erro}
                            checked={selecionadosNovos.has(a.linha)}
                            onChange={(e) =>
                              setSelecionadosNovos((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(a.linha);
                                else next.delete(a.linha);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">{a.linha}</td>
                        <td className="px-2 py-2">{a.tipoEntrada}</td>
                        <td className="px-2 py-2">{a.tipoEntrada === "individual" ? a.brinco : a.quantidade}</td>
                        <td className="px-2 py-2">{a.categoria}</td>
                        <td className="px-2 py-2">{a.curralCodigo}</td>
                        <td className="px-2 py-2">{formatData(a.dataEntrada)}</td>
                        <td className="px-2 py-2">{formatNumero(a.pesoEntradaKg)}</td>
                        <td className="px-2 py-2 text-xs">{a.erro ? <span className="text-red-600">{a.erro}</span> : "ok"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Pesagens ({preview.pesagens.length})
            </h3>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-2 py-2"></th>
                    <th className="px-2 py-2">Linha</th>
                    <th className="px-2 py-2">Data</th>
                    <th className="px-2 py-2">Brinco</th>
                    <th className="px-2 py-2">Curral</th>
                    <th className="px-2 py-2">Peso</th>
                    <th className="px-2 py-2">Animal</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {preview.pesagens.map((p) => (
                    <tr key={p.linha} className={p.erro ? "bg-red-50 dark:bg-red-950/40" : "bg-white dark:bg-zinc-950"}>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          disabled={!!p.erro}
                          checked={selecionadas.has(p.linha)}
                          onChange={(e) =>
                            setSelecionadas((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(p.linha);
                              else next.delete(p.linha);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">{p.linha}</td>
                      <td className="px-2 py-2">{formatData(p.data)}</td>
                      <td className="px-2 py-2">{p.brinco}</td>
                      <td className="px-2 py-2">{p.curralCodigo}</td>
                      <td className="px-2 py-2">{formatNumero(p.pesoKg)}</td>
                      <td className="px-2 py-2 text-xs">{p.novoAnimal ? "novo (via pesagem)" : "existente"}</td>
                      <td className="px-2 py-2 text-xs">{p.erro ? <span className="text-red-600">{p.erro}</span> : "ok"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={pending}
            className="rounded bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Confirmando..." : `Confirmar importação (${selecionadas.size + selecionadosNovos.size} linhas)`}
          </button>
        </>
      )}
    </div>
  );
}
