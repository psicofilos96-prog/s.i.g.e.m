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
/**
 * Lista do quadro: só o conselho da ÚLTIMA data do ano (o Término) leva "Término do Ano Letivo".
 * Conselho Final de outra data (ex.: fim do 1º semestre) fica só "Conselho de Classe Final".
 * Linha do Término que veio só com o nome "Término do ano letivo" vira o texto combinado.
 */
export function councilItemText(name: string, on: string, items: ReadonlyArray<{ name: string; on: string }>): string {
  const norm = (n: string) => n.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  const n = norm(name);
  const hasTermino = /t[ée]rmino/.test(n);
  const isFinal = n.includes("conselho de classe final");
  const last = items.map((i) => i.on).sort().at(-1);
  if (on !== last) {
    // Fora do último dia nunca é Término: remove o sufixo combinado se tiver vindo do cadastro.
    if (isFinal && hasTermino) return name.replace(/\s*[-/–—]\s*t[ée]rmino do ano letivo\s*$/i, "").trim() || "Conselho de Classe Final";
    return name;
  }
  if (hasTermino && isFinal) return name;
  if (hasTermino) return FINAL_COUNCIL_TEXT;
  if (!isFinal) return name;
  return n === "conselho de classe final" ? FINAL_COUNCIL_TEXT : `${name} - Término do Ano Letivo`;
}
