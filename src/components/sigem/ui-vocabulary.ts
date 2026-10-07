/** Catálogo NUI.1: verbos, estados e formatos padronizados (pt-BR). */
export const ACTION_LABEL = {
  salvar: "Salvar", cancelar: "Cancelar", voltar: "Voltar", fechar: "Fechar",
  confirmar: "Confirmar", excluir: "Excluir", encerrar: "Encerrar",
  tentarNovamente: "Tentar novamente", limparFiltros: "Limpar filtros", buscar: "Buscar",
} as const;
export const STATE_LABEL = {
  carregando: "Carregando…", vazio: "Nada encontrado", naoInformado: "Não informado",
  naoConfigurado: "Ainda não configurado",
} as const;
export type ButtonRole = "primario" | "secundario" | "destrutivo";
export const BUTTON_VARIANT: Record<ButtonRole, "default" | "outline" | "destructive"> = {
  primario: "default", secundario: "outline", destrutivo: "destructive",
};
/** Ação destrutiva exige pergunta + consequência explícita. */
export function destructiveConfirmText(action: string, consequence: string): string {
  const c = consequence.trim();
  if (!c) throw new Error("Ação destrutiva sem consequência explícita");
  return `${action}? ${c}`;
}
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return STATE_LABEL.naoInformado;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : STATE_LABEL.naoInformado;
}
