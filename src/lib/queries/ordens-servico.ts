// Fase M2 — leitura pro Painel de Ordens de Serviço. Client de sessão (RLS
// normal), nunca o supabaseServico de src/lib/orquestrador — aqui sempre tem
// usuário autenticado.
import { createClient } from "@/lib/supabase/server";
import type { Dominio, Intencao } from "@/lib/orquestrador/tipos";

export type OsStatus =
  | "aberta"
  | "cotando"
  | "aguardando_autorizacao"
  | "aprovada"
  | "comprada"
  | "entregue"
  | "conferida"
  | "cancelada";

export type FiltrosFila = {
  fazendaId?: string; // undefined = todas (RLS já limita às acessíveis)
  status?: OsStatus;
  dominio?: Dominio;
  responsavelId?: string;
  busca?: string;
  pagina?: number;
};

const ITENS_POR_PAGINA = 30;

export type OsFilaItem = {
  id: string;
  descricao: string | null;
  dominio: Dominio;
  solicitante_id: string | null;
  responsavel_id: string | null;
  fazenda_id: string;
  fazenda_codigo: string;
  valor_estimado: number | null;
  status: OsStatus;
  criado_em: string;
};

export async function getFilaOs(filtros: FiltrosFila): Promise<{ itens: OsFilaItem[]; total: number }> {
  const supabase = await createClient();
  const pagina = filtros.pagina ?? 1;
  const de = (pagina - 1) * ITENS_POR_PAGINA;
  const ate = de + ITENS_POR_PAGINA - 1;

  let query = supabase
    .from("os")
    .select(
      "id, descricao, dominio, solicitante_id, responsavel_id, fazenda_id, valor_estimado, status, criado_em, fazendas(codigo)",
      { count: "exact" },
    )
    .order("criado_em", { ascending: false })
    .range(de, ate);

  if (filtros.fazendaId) query = query.eq("fazenda_id", filtros.fazendaId);
  if (filtros.status) query = query.eq("status", filtros.status);
  if (filtros.dominio) query = query.eq("dominio", filtros.dominio);
  if (filtros.responsavelId) query = query.eq("responsavel_id", filtros.responsavelId);
  if (filtros.busca) query = query.or(`id.ilike.%${filtros.busca}%,descricao.ilike.%${filtros.busca}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Falha ao listar fila de OS: ${error.message}`);

  const itens: OsFilaItem[] = (data ?? []).map((row) => {
    const fazenda = Array.isArray(row.fazendas) ? row.fazendas[0] : row.fazendas;
    return {
      id: row.id,
      descricao: row.descricao,
      dominio: row.dominio,
      solicitante_id: row.solicitante_id,
      responsavel_id: row.responsavel_id,
      fazenda_id: row.fazenda_id,
      fazenda_codigo: fazenda?.codigo ?? "—",
      valor_estimado: row.valor_estimado,
      status: row.status,
      criado_em: row.criado_em,
    };
  });

  return { itens, total: count ?? 0 };
}

export async function getContagensPorStatus(fazendaId?: string): Promise<Record<OsStatus, number>> {
  const supabase = await createClient();
  let query = supabase.from("os").select("status");
  if (fazendaId) query = query.eq("fazenda_id", fazendaId);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao contar OS por status: ${error.message}`);

  const contagens = {} as Record<OsStatus, number>;
  for (const row of data ?? []) {
    const s = row.status as OsStatus;
    contagens[s] = (contagens[s] ?? 0) + 1;
  }
  return contagens;
}

export type ItemOs = { qtd: string | null; item: string; valor_unitario?: number | null };

export type OsDetalhe = {
  id: string;
  fazenda_id: string;
  fazenda_codigo: string;
  solicitante_id: string | null;
  responsavel_id: string | null;
  dominio: Dominio;
  intencao: Intencao;
  descricao: string | null;
  itens: ItemOs[];
  comprar_produto: boolean;
  contratar_servico: boolean;
  autorizacao_dono: boolean;
  dono_designado_id: string | null;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  ativo_destino_id: string | null;
  ativo_destino_nome: string | null;
  curral_id: string | null;
  curral_codigo: string | null;
  valor_estimado: number | null;
  status: OsStatus;
  canal_origem: string | null;
  prazo_pedido: string | null;
  criado_em: string;
  concluido_em: string | null;
};

export async function getOsDetalhe(id: string): Promise<OsDetalhe | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os")
    .select(
      `id, fazenda_id, solicitante_id, responsavel_id, dominio, intencao, descricao, itens,
       comprar_produto, contratar_servico, autorizacao_dono, dono_designado_id,
       fornecedor_id, ativo_destino_id, curral_id, valor_estimado, status, canal_origem,
       prazo_pedido, criado_em, concluido_em,
       fazendas(codigo), fornecedor(nome), ativo(nome), currais(codigo)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar OS ${id}: ${error.message}`);
  if (!data) return null;

  const fazenda = Array.isArray(data.fazendas) ? data.fazendas[0] : data.fazendas;
  const fornecedor = Array.isArray(data.fornecedor) ? data.fornecedor[0] : data.fornecedor;
  const ativo = Array.isArray(data.ativo) ? data.ativo[0] : data.ativo;
  const curral = Array.isArray(data.currais) ? data.currais[0] : data.currais;

  return {
    id: data.id,
    fazenda_id: data.fazenda_id,
    fazenda_codigo: fazenda?.codigo ?? "—",
    solicitante_id: data.solicitante_id,
    responsavel_id: data.responsavel_id,
    dominio: data.dominio,
    intencao: data.intencao,
    descricao: data.descricao,
    itens: (data.itens as ItemOs[] | null) ?? [],
    comprar_produto: data.comprar_produto,
    contratar_servico: data.contratar_servico,
    autorizacao_dono: data.autorizacao_dono,
    dono_designado_id: data.dono_designado_id,
    fornecedor_id: data.fornecedor_id,
    fornecedor_nome: fornecedor?.nome ?? null,
    ativo_destino_id: data.ativo_destino_id,
    ativo_destino_nome: ativo?.nome ?? null,
    curral_id: data.curral_id,
    curral_codigo: curral?.codigo ?? null,
    valor_estimado: data.valor_estimado,
    status: data.status,
    canal_origem: data.canal_origem,
    prazo_pedido: data.prazo_pedido,
    criado_em: data.criado_em,
    concluido_em: data.concluido_em,
  };
}

export type StatusHistoricoItem = {
  status: OsStatus;
  autor_id: string | null;
  criado_em: string;
};

export async function getStatusHistorico(osId: string): Promise<StatusHistoricoItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os_status_historico")
    .select("status, autor_id, criado_em")
    .eq("os_id", osId)
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`Falha ao buscar histórico da OS ${osId}: ${error.message}`);
  return data ?? [];
}

export type MensagemTriagem = {
  id: string;
  canal: string | null;
  remetente: string | null;
  conteudo_bruto: string | null;
  transcricao: string | null;
  confianca_transcricao: number | null;
  confianca_classificacao: number | null;
  dominio: Dominio | null;
  intencao: Intencao | null;
  itens: ItemOs[];
  fazenda_sugerida: "BG" | "PD" | null;
  timestamp: string;
};

export async function getMensagensPendentesTriagem(): Promise<MensagemTriagem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mensagem")
    .select(
      "id, canal, remetente, conteudo_bruto, transcricao, confianca_transcricao, confianca_classificacao, dominio, intencao, itens, fazenda_sugerida, timestamp",
    )
    .in("intencao", ["abrir_demanda", "registrar_lancar"])
    .is("os_id", null)
    .is("registro_id", null)
    .eq("descartada", false)
    .order("timestamp", { ascending: true });
  if (error) throw new Error(`Falha ao listar triagem: ${error.message}`);
  return (data ?? []).map((m) => ({ ...m, itens: (m.itens as ItemOs[] | null) ?? [] }));
}

export async function getFazendasAcessiveis() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fazendas").select("id, codigo, nome").order("codigo");
  if (error) throw new Error(`Falha ao listar fazendas: ${error.message}`);
  return data ?? [];
}

export async function getUsuariosDaFazenda(fazendaId: string): Promise<{ id: string; email: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usuarios_da_fazenda", { p_fazenda_id: fazendaId });
  if (error) throw new Error(`Falha ao listar usuários da fazenda: ${error.message}`);
  return data ?? [];
}

export async function getFornecedores() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fornecedor").select("id, nome").order("nome");
  if (error) throw new Error(`Falha ao listar fornecedores: ${error.message}`);
  return data ?? [];
}

export async function getAtivosDaFazenda(fazendaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ativo").select("id, nome").eq("fazenda_id", fazendaId).order("nome");
  if (error) throw new Error(`Falha ao listar ativos: ${error.message}`);
  return data ?? [];
}

export async function getCurraisDaFazenda(fazendaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("currais")
    .select("id, codigo")
    .eq("fazenda_id", fazendaId)
    .order("codigo");
  if (error) throw new Error(`Falha ao listar currais: ${error.message}`);
  return data ?? [];
}
