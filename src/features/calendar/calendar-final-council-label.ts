/** Texto exibido do Conselho de Classe Final: no calendário da rede ele coincide com o Término do Ano Letivo. */
export const FINAL_COUNCIL_TEXT = "Conselho de Classe Final / Término do Ano Letivo";
export function finalCouncilText(label: string): string {
  return /^\s*conselho de classe final\s*$/i.test(label) ? FINAL_COUNCIL_TEXT : label;
}
