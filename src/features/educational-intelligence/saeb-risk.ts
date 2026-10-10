/**
 * R3 — Importação SAEB por leiaute validado e risco pedagógico parametrizável (não oficial).
 * Leiaute é declarado; coluna ausente ou desconhecida recusa o arquivo. Risco sem
 * parâmetros homologados é sempre "não oficial" e nunca vira classificação da pessoa.
 */
export type SaebLayout = { id: string; version: number; required: readonly string[] };
export const SAEB_LAYOUT_V1: SaebLayout = { id: "saeb-resultados-escola", version: 1, required: ["inep", "ano", "etapa", "componente", "proficiencia_media", "participacao"] };

export function validateSaeb(header: readonly string[], rows: readonly (readonly string[])[], layout: SaebLayout = SAEB_LAYOUT_V1) {
  const norm = header.map((h) => h.trim().toLowerCase());
  const missing = layout.required.filter((c) => !norm.includes(c));
  if (missing.length) return { ok: false as const, reason: `Colunas ausentes: ${missing.join(", ")}` };
  const idx = Object.fromEntries(layout.required.map((c) => [c, norm.indexOf(c)]));
  const errors: string[] = []; const parsed = rows.map((r, i) => {
    const inep = r[idx["inep"]!] ?? ""; const prof = r[idx["proficiencia_media"]!] ?? "";
    if (!/^\d{8}$/.test(inep)) errors.push(`Linha ${i + 2}: INEP inválido`);
    const n = prof.trim() === "" ? null : Number(prof.replace(",", "."));
    if (n !== null && Number.isNaN(n)) errors.push(`Linha ${i + 2}: proficiência inválida`);
    return { inep, year: r[idx["ano"]!] ?? "", stage: r[idx["etapa"]!] ?? "", component: r[idx["componente"]!] ?? "", proficiency: n };
  });
  return errors.length ? { ok: false as const, reason: errors.slice(0, 20).join("; ") } : { ok: true as const, layout: `${layout.id}@${layout.version}`, rows: parsed };
}

export type RiskParams = { state: "homologado" | "pendente"; ref: string | null; attendanceBelow: number | null; gradeBelow: number | null };
export function pedagogicalSignal(p: RiskParams, input: { attendanceRate: number | null; gradeAverage: number | null }) {
  const signals: string[] = [];
  if (p.attendanceBelow !== null && input.attendanceRate !== null && input.attendanceRate < p.attendanceBelow) signals.push("frequência abaixo do parâmetro");
  if (p.gradeBelow !== null && input.gradeAverage !== null && input.gradeAverage < p.gradeBelow) signals.push("rendimento abaixo do parâmetro");
  const unknown = input.attendanceRate === null && input.gradeAverage === null;
  return { official: p.state === "homologado" && !!p.ref, signals, unknown, label: p.state === "homologado" ? "sinal" : "sinal não oficial (parâmetro pendente)" };
}

/** Devolutiva/plano: escrita só para quem tem a capability de escrita; leitura separada. */
export const feedbackAccess = (caps: ReadonlySet<string>) => ({ read: caps.has("consultar-devolutivas") || caps.has("registrar-devolutivas"), write: caps.has("registrar-devolutivas") });
