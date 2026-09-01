// Taxonomia de classificação do Orquestrador (docs/orquestrador/GROUNDING.md §1).
// Só abrir_demanda cria OS; registrar_lancar cria registro_admin; os demais
// (confirmar_fechar, relatar_manejo, informacao) não geram nada por si só no M1
// (confirmar_fechar passa a fechar OS existente só na Fase M2/P1).

export const DOMINIOS = [
  "nutricao_confinamento",
  "manutencao_mecanica",
  "sanidade",
  "defensivos",
  "construcao_infra",
  "logistica",
  "documentos_contratos",
  "movimentacao_gado",
  "rh_pessoal",
  "financeiro",
  "outro",
] as const;
export type Dominio = (typeof DOMINIOS)[number];

export const INTENCOES = [
  "abrir_demanda",
  "confirmar_fechar",
  "registrar_lancar",
  "relatar_manejo",
  "informacao",
] as const;
export type Intencao = (typeof INTENCOES)[number];

export type ItemExtraido = {
  qtd: string | null;
  item: string;
};

export type ClassificacaoMensagem = {
  dominio: Dominio;
  intencao: Intencao;
  itens: ItemExtraido[];
  gera_os: boolean;
  /** 0-1. Abaixo do limiar (ver classificar.ts), marcar pra revisão manual em vez de agir (CLAUDE.md guardrail). */
  confianca: number;
};
