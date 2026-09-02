// Few-shot + glossário extraídos de docs/orquestrador/GROUNDING.md §2 e §4
// (corpus real, mensagens levemente limpas). Mudou lá? Atualiza aqui também —
// não há geração automática, é cópia intencional pra manter os exemplos
// revisáveis em code review.
import type { ClassificacaoMensagem } from "./tipos";

export type ExemploFewShot = {
  texto: string;
  classificacao: ClassificacaoMensagem;
};

export const EXEMPLOS_GROUNDING: ExemploFewShot[] = [
  {
    texto: "Arruma pra nós por favor: 3 flumax, 2 pacotes de faixas, 6 spray prata",
    classificacao: {
      dominio: "sanidade",
      intencao: "abrir_demanda",
      itens: [
        { qtd: "3", item: "flumax" },
        { qtd: "2", item: "pacotes de faixas" },
        { qtd: "6", item: "spray prata" },
      ],
      gera_os: true,
      confianca: 1,
      fazenda: null,
    },
  },
  {
    texto: "Trazer para Barra Grande: 36 atadura, 1 terramin, 4 ganadol",
    classificacao: {
      dominio: "sanidade",
      intencao: "abrir_demanda",
      itens: [
        { qtd: "36", item: "atadura" },
        { qtd: "1", item: "terramin" },
        { qtd: "4", item: "ganadol" },
      ],
      gera_os: true,
      confianca: 1,
      fazenda: "BG",
    },
  },
  {
    texto: "Está acabando a ração do curral 2, precisa trazer mais",
    classificacao: {
      dominio: "nutricao_confinamento",
      intencao: "abrir_demanda",
      itens: [{ qtd: null, item: "ração curral 2" }],
      gera_os: true,
      confianca: 0.95,
      fazenda: null,
    },
  },
  {
    texto: "Lote 420kg: 38 animais, média 441,6 kg, consumo 6,6 kg",
    classificacao: {
      dominio: "nutricao_confinamento",
      intencao: "relatar_manejo",
      itens: [],
      gera_os: false,
      confianca: 0.95,
      fazenda: null,
    },
  },
  {
    texto: "O misturador quebrou, precisa arrumar urgente",
    classificacao: {
      dominio: "manutencao_mecanica",
      intencao: "abrir_demanda",
      itens: [{ qtd: null, item: "conserto do misturador" }],
      gera_os: true,
      confianca: 1,
      fazenda: null,
    },
  },
  {
    texto: "Dois biquinhos da bomba, pega lá com a Paula",
    classificacao: {
      dominio: "manutencao_mecanica",
      intencao: "abrir_demanda",
      itens: [{ qtd: "2", item: "biquinhos de bomba" }],
      gera_os: true,
      confianca: 0.9,
      fazenda: null,
    },
  },
  {
    texto: "Precisa comprar mais triclopyr e picloram pro drone",
    classificacao: {
      dominio: "defensivos",
      intencao: "abrir_demanda",
      itens: [
        { qtd: null, item: "triclopyr" },
        { qtd: null, item: "picloram" },
      ],
      gera_os: true,
      confianca: 1,
      fazenda: null,
    },
  },
  {
    texto: "Chegou o veneno aqui: cinco baldes e 14 frasquinhos do outro",
    classificacao: {
      dominio: "defensivos",
      intencao: "confirmar_fechar",
      itens: [],
      gera_os: false,
      confianca: 0.9,
      fazenda: null,
    },
  },
  {
    texto:
      "Hoje vai comprar milho pra fazenda Pau D'Arco, o motorista é o Sr. Francisco e o produtor cobrou R$ 64,50 por saca, umas 35 toneladas ao todo",
    classificacao: {
      dominio: "nutricao_confinamento",
      intencao: "abrir_demanda",
      itens: [{ qtd: "35 toneladas", item: "milho" }],
      gera_os: true,
      confianca: 0.9,
      fazenda: "PD",
    },
  },
  {
    texto: "O caminhão está carregando na indústria, daqui uns 40 min sai",
    classificacao: {
      dominio: "logistica",
      intencao: "informacao",
      itens: [],
      gera_os: false,
      confianca: 0.9,
      fazenda: null,
    },
  },
  {
    texto: "Está acabando o adubo, o caminhão chega que horas?",
    classificacao: {
      dominio: "logistica",
      intencao: "abrir_demanda",
      itens: [{ qtd: null, item: "adubo" }],
      gera_os: true,
      confianca: 0.8,
      fazenda: null,
    },
  },
  {
    texto: "Boias de bebedouro, ver onde tem",
    classificacao: {
      dominio: "construcao_infra",
      intencao: "abrir_demanda",
      itens: [{ qtd: null, item: "boias de bebedouro" }],
      gera_os: true,
      confianca: 0.9,
      fazenda: null,
    },
  },
  {
    texto: "Lança as mortes do Caminho do Lago: 3 cabeças",
    classificacao: {
      dominio: "movimentacao_gado",
      intencao: "registrar_lancar",
      itens: [],
      gera_os: false,
      confianca: 0.95,
      fazenda: null,
    },
  },
  {
    texto: "Lança no ClickUp a saída do lote 2, 38 animais",
    classificacao: {
      dominio: "movimentacao_gado",
      intencao: "registrar_lancar",
      itens: [],
      gera_os: false,
      confianca: 0.9,
      fazenda: null,
    },
  },
  {
    texto: "Precisa mandar o contrato de arrendamento pro cartório",
    classificacao: {
      dominio: "documentos_contratos",
      intencao: "abrir_demanda",
      itens: [{ qtd: null, item: "contrato de arrendamento" }],
      gera_os: true,
      confianca: 0.85,
      fazenda: null,
    },
  },
  {
    texto: "Peguei folga hoje mas estou na escuta",
    classificacao: {
      dominio: "rh_pessoal",
      intencao: "informacao",
      itens: [],
      gera_os: false,
      confianca: 0.9,
      fazenda: null,
    },
  },
  {
    texto: "Paga R$ 200 pro fulano, chave PIX ...",
    classificacao: {
      dominio: "financeiro",
      intencao: "informacao",
      itens: [],
      gera_os: false,
      confianca: 0.85,
      fazenda: null,
    },
  },
  {
    texto: "A Constanza fez os pagamentos hoje?",
    classificacao: {
      dominio: "financeiro",
      intencao: "informacao",
      itens: [],
      gera_os: false,
      confianca: 0.9,
      fazenda: null,
    },
  },
  {
    texto: "Já achei, comprei",
    classificacao: {
      dominio: "outro",
      intencao: "confirmar_fechar",
      itens: [],
      gera_os: false,
      confianca: 0.85,
      fazenda: null,
    },
  },
  {
    texto: "Beleza, positivo",
    classificacao: {
      dominio: "outro",
      intencao: "confirmar_fechar",
      itens: [],
      gera_os: false,
      confianca: 0.7,
      fazenda: null,
    },
  },
  {
    texto: "Peguei os trens lá no torneiro",
    classificacao: {
      dominio: "outro",
      intencao: "confirmar_fechar",
      itens: [],
      gera_os: false,
      confianca: 0.75,
      fazenda: null,
    },
  },
];

// GROUNDING.md §4 — termos que o classificador (e o STT) tende a errar.
export const GLOSSARIO_JARGAO: { termo: string; dominio: string }[] = [
  { termo: "flumax", dominio: "sanidade" },
  { termo: "terramin (terramicina)", dominio: "sanidade" },
  { termo: "ganadol", dominio: "sanidade" },
  { termo: "higiene casco", dominio: "sanidade" },
  { termo: "unguento / spray prata", dominio: "sanidade" },
  { termo: "partomicina, umbicura, triatox, cidental", dominio: "sanidade" },
  { termo: "triclopyr (triclopir), picloram, tordon, calaris, metsulfuron", dominio: "defensivos" },
  { termo: "adubo (adupa), ureia", dominio: "nutrição/lavoura" },
  { termo: "cocho, curral, piquete, lote, arroba, GMD", dominio: "nutricao_confinamento" },
  { termo: "misturador (vagão), biquinho de bomba, rolamento, roseta", dominio: "manutencao_mecanica" },
  { termo: "GTA, brinco, desmama, apartar", dominio: "movimentacao_gado" },
];
