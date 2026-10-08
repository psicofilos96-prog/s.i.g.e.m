/** Catálogo NUI.1 — agora fachada do registro único `src/config/ui-vocabulary.ts` (NUI.3). */
import { ACTION, STATE_TEXT } from "@/config/ui-vocabulary";
export const ACTION_LABEL = {
  salvar: ACTION.salvar, cancelar: ACTION.cancelar, voltar: ACTION.voltar, fechar: ACTION.fechar,
  confirmar: ACTION.confirmar, excluir: "Excluir", encerrar: "Encerrar",
  tentarNovamente: ACTION.tentarNovamente, limparFiltros: ACTION.limparFiltros, buscar: "Buscar",
} as const;
export const STATE_LABEL = {
  carregando: STATE_TEXT.carregando, vazio: STATE_TEXT.nenhumResultado, naoInformado: "Não informado",
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
