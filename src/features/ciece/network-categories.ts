/**
 * Categorias oficiais da rede para o CIECE (filtro do Mapa da rede, consolidação e alcance dos avisos).
 * Deriva só de `classifySchool`/`matchesNetwork` (cadastro localização × dependência): escola sem
 * classificação nunca entra numa categoria, porque presumir rede duplicaria ou excluiria escola.
 */
import { matchesNetwork, type SchoolClassification } from "@/features/statistical-map/declared-inconsistencies";

export const NETWORK_CATEGORIES = ["todas", "municipal-urbana", "municipal-rural", "conveniada"] as const;
export type NetworkCategory = (typeof NETWORK_CATEGORIES)[number];
export const NETWORK_CATEGORY_LABEL: Record<NetworkCategory, string> = {
  todas: "Todas as escolas", "municipal-urbana": "Urbanas", "municipal-rural": "Rurais", conveniada: "Conveniadas",
};

export function inCategory(c: SchoolClassification | undefined, cat: NetworkCategory): boolean {
  return cat === "todas" ? true : matchesNetwork(c, cat);
}

/** Impressão digital estável da consolidação vista (ordem das chaves e escolas normalizada). */
export async function consolidationFingerprint(input: { year: number; month: number; audience: NetworkCategory; schoolIds: string[]; totals: Record<string, number | null> }): Promise<string> {
  const canon = JSON.stringify({
    y: input.year, m: input.month, a: input.audience, s: [...input.schoolIds].sort(),
    t: Object.keys(input.totals).sort().map((k) => [k, input.totals[k] ?? null]),
  });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Aviso chega à escola só se o alcance a inclui pela classificação do cadastro. */
export function noticeReachesSchool(audience: NetworkCategory, c: SchoolClassification | undefined): boolean {
  return inCategory(c, audience);
}
