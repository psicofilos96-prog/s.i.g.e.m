/** Texto exibido do Conselho de Classe Final: no calendário da rede ele coincide com o Término do Ano Letivo. */
export const FINAL_COUNCIL_TEXT = "Conselho de Classe Final / Término do Ano Letivo";
/** Quadro de conselhos: o Conselho Final coincide com o Término. */
export function finalCouncilText(label: string): string {
  return /^\s*conselho de classe final\s*$/i.test(label) ? FINAL_COUNCIL_TEXT : label;
}
/** Legenda: CF fica só "Conselho de Classe Final"; a entrada própria CF + T (TERMINO) leva o texto combinado. */
export function legendLabel(code: string, label: string): string {
  return code === "TERMINO" ? FINAL_COUNCIL_TEXT : label;
}
/** Garante a entrada CF + T logo após CF na legenda. */
export function withFinalTerminoLegend(codes: string[]): string[] {
  if (!codes.includes("CF") || codes.includes("TERMINO")) return codes;
  const out = [...codes];
  out.splice(out.indexOf("CF") + 1, 0, "TERMINO");
  return out;
}
/** Lista do quadro: o ÚLTIMO Conselho Final (por data, com ou sem sufixo " / N") recebe o texto combinado. */
export function councilItemText(name: string, on: string, items: ReadonlyArray<{ name: string; on: string }>): string {
  const isFinal = (n: string) => /^\s*conselho de classe final(\s*\/\s*\d+)?\s*$/i.test(n);
  if (!isFinal(name)) return name;
  const last = items.filter((i) => isFinal(i.name)).map((i) => i.on).sort().at(-1);
  return on === last ? FINAL_COUNCIL_TEXT : finalCouncilText(name);
}
