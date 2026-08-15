export type CurralIndicadores = {
  curral_id: string;
  fazenda_id: string;
  codigo: string;
  descricao: string | null;
  num_cabecas: number;
  peso_total_atual_kg: number | null;
  ganho_total_kg: number | null;
  arroba_viva_total: number | null;
  arroba_produzida: number | null;
  peso_medio_entrada_kg: number | null;
  peso_medio_atual_kg: number | null;
  gmd_medio: number | null;
  num_gmd_validos: number;
  num_nao_vencidos: number;
  num_na_meta: number;
  pct_na_meta_gmd: number | null;
  dias_desde_ultima_pesagem: number | null;
  consumo_racao_total_kg: number | null;
  custo_racao_acumulado: number | null;
  dias_com_trato: number;
  custo_racao_por_arroba: number | null;
  conversao_alimentar: number | null;
  custo_cab_dia_medio_racao: number | null;
  custo_fixo_dia: number;
  dias_conf_curral: number | null;
  custo_total_acumulado: number | null;
  custo_total_por_arroba: number | null;
  custo_cab_dia_medio_total: number | null;
};

export type IngredienteEstoque = {
  ingrediente_id: string;
  fazenda_id: string;
  nome: string;
  estoque_base_kg: number | null;
  estoque_base_data: string | null;
  estoque_atual_kg: number | null;
  dias_de_estoque: number | null;
};

export type Parametros = {
  preco_arroba_referencia: number;
  pct_materia_seca: number;
  custo_fixo_dia: number;
  gmd_meta: number;
  peso_abate_alvo: number | null;
  data_referencia: string;
  alerta_pesagem_atencao_dias: number;
  alerta_pesagem_forte_dias: number;
  alerta_estoque_dias: number;
};
