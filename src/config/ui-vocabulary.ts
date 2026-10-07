/**
 * NUI.2 — Vocabulário único da interface (pt-BR). Só apresentação: nenhuma regra de negócio.
 * Ações, estados de tela e rótulos de status equivalentes têm UMA forma canônica.
 */
export const ACTION = {
  voltar: "Voltar",        // retorna à tela anterior, sem descartar nada salvo
  cancelar: "Cancelar",    // desiste da ação em curso; nada é gravado
  salvar: "Salvar",        // grava rascunho/alteração, a tarefa continua aberta
  continuar: "Continuar",  // avança para a próxima etapa de um assistente
  concluir: "Concluir",    // encerra a tarefa (último passo)
  fechar: "Fechar",        // fecha painel/diálogo informativo
  confirmar: "Confirmar",  // confirma ação perigosa em diálogo
  tentarNovamente: "Tentar novamente", // só refaz leitura
  limparFiltros: "Limpar filtros",
  limparBusca: "Limpar busca",
} as const;

export const STATE_TEXT = {
  carregando: "Carregando…",
  nenhumResultado: "Nenhum resultado.",
  nenhumRegistro: "Nenhum registro.",
  naoDisponivel: "não disponível", // ausência; nunca zero
} as const;

/** Status equivalentes → rótulo canônico exibido no badge. */
export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", draft: "Rascunho",
  "em-revisao": "Em revisão", em_revisao: "Em revisão", review: "Em revisão",
  enviado: "Enviado", submitted: "Enviado",
  devolvido: "Devolvido", returned: "Devolvido",
  aprovado: "Aprovado", approved: "Aprovado",
  homologado: "Homologado", homologated: "Homologado",
  publicado: "Publicado", published: "Publicado",
  pendente: "Pendente", pending: "Pendente",
  cancelado: "Cancelado", cancelled: "Cancelado", canceled: "Cancelado",
  substituido: "Substituído", superseded: "Substituído",
  expirado: "Expirado", expired: "Expirado",
};

/** Desconhecido não é traduzido por palpite: aparece como "Situação não reconhecida". */
export const statusLabel = (raw: string | null | undefined): string =>
  raw ? STATUS_LABEL[raw.trim().toLowerCase()] ?? "Situação não reconhecida" : "Sem situação registrada";

/** Variações proibidas no texto visível → forma canônica. Guardado por teste de varredura. */
export const FORBIDDEN_VARIANTS: readonly (readonly [RegExp, string])[] = [
  [/>\s*(Avançar|Próximo|Seguinte)\s*</, ACTION.continuar],
  [/>\s*Anterior\s*</, ACTION.voltar],
  [/>\s*Tentar de novo\s*</, ACTION.tentarNovamente],
  [/>\s*Carregando(\.\.\.)?\s*</, STATE_TEXT.carregando],
  [/>\s*(Sem resultados|Nada encontrado\.?)\s*</, STATE_TEXT.nenhumResultado],
  [/>\s*(Save|Cancel|Back|Submit|Close|Loading\.*|Delete|Edit|Next|Previous|Search|Retry|Confirm|Done|OK|Ok|Details|Settings|Upload|Download|Export|Logout|Sign in|Sign out|Draft|Pending|Approved|Rejected|Preview)\s*</, "termo em português"],
];
