/**
 * SIGEM 2.0 A&A Lote 2 — matrizes, habilidades e domínio por habilidade.
 * Matrizes são famílias declaradas; o conteúdo (códigos/descritores) só entra por importação de fonte
 * verificada no repositório curricular (Frente Y). Equivalência entre matrizes nunca é 1:1 automática.
 */
export type MatrixFamily = {
  key: string; name: string; codeScheme: string; components: string[]; grades: string;
  hasCyclePresence: boolean; kind: "descritores" | "habilidades" | "rubrica" | "campos-experiencia";
  source: string; contentLoaded: false;
};
const F = (m: Omit<MatrixFamily, "contentLoaded">): MatrixFamily => ({ ...m, contentLoaded: false });
export const MATRIX_FAMILIES: readonly MatrixFamily[] = [
  F({ key: "saeb-classica", name: "SAEB — matriz clássica", codeScheme: "D + número (ex.: D1)", components: ["LP", "MAT"], grades: "5º, 9º", hasCyclePresence: false, kind: "descritores", source: "INEP" }),
  F({ key: "saeb-bncc", name: "SAEB — matriz alinhada à BNCC", codeScheme: "código INEP próprio", components: ["LP", "MAT"], grades: "2º, 5º, 9º", hasCyclePresence: false, kind: "habilidades", source: "INEP" }),
  F({ key: "bncc", name: "BNCC", codeScheme: "EF01LP01…", components: ["LP", "MAT", "outros"], grades: "1º–9º", hasCyclePresence: false, kind: "habilidades", source: "MEC" }),
  F({ key: "cnca-caed", name: "CNCA/CAEd 1º–5º", codeScheme: "código CAEd próprio + BNCC relacionada", components: ["LP leitura", "LP escrita", "LP fluência", "MAT"], grades: "1º–5º", hasCyclePresence: true, kind: "habilidades", source: "CAEd" }),
  F({ key: "provas-locais", name: "Descritores das provas locais", codeScheme: "definido pela rede", components: ["LP", "MAT", "TEC"], grades: "1º–9º", hasCyclePresence: false, kind: "descritores", source: "Rede municipal" }),
  F({ key: "rubrica-producao", name: "Rubrica de produção textual", codeScheme: "critério + nível", components: ["LP"], grades: "3º–9º, TEC", hasCyclePresence: false, kind: "rubrica", source: "Rede municipal" }),
  F({ key: "ei", name: "Educação Infantil (campos de experiência)", codeScheme: "EI01/02/03 + campo", components: ["campos de experiência"], grades: "EI", hasCyclePresence: false, kind: "campos-experiencia", source: "MEC" }),
];

export const CYCLES = ["I", "II", "III"] as const;

/** Linha de importação de matriz (texto original preservado). */
export type MatrixRow = { family: string; code: string; text: string; component: string; grade: string; bnccCodes: string[]; cycles: string[] };
export function validateMatrixRow(r: MatrixRow, sourceHash: string | null): string[] {
  const e: string[] = [];
  const f = MATRIX_FAMILIES.find((m) => m.key === r.family);
  if (!f) return ["familia-desconhecida"];
  if (!sourceHash || !/^[0-9a-f]{64}$/.test(sourceHash)) e.push("fonte-nao-verificada");
  if (!r.code.trim()) e.push("codigo-ausente");
  if (r.code !== r.code.trim()) e.push("codigo-com-espaco");
  if (!r.text.trim()) e.push("texto-ausente");
  if (!f.components.includes(r.component)) e.push("componente-fora-da-familia");
  if (f.hasCyclePresence) { if (!r.cycles.length) e.push("ciclos-ausentes"); if (r.cycles.some((c) => !(CYCLES as readonly string[]).includes(c))) e.push("ciclo-invalido"); }
  else if (r.cycles.length) e.push("ciclo-nao-se-aplica");
  if (r.bnccCodes.some((c) => !/^EF\d{2}[A-Z]{2}\d{2}$/.test(c))) e.push("bncc-invalido");
  return e;
}
export function duplicateCodes(rows: MatrixRow[]): string[] {
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(`${r.family}|${r.code}`, (seen.get(`${r.family}|${r.code}`) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
}

/** Relação entre itens de matrizes: sempre com natureza e confiança; nunca "equivalente" sem fonte. */
export type Relation = { from: string; to: string; nature: "relacionada" | "parcial" | "equivalente-declarada"; confidence: "fonte-oficial" | "editorial"; sourceRef: string | null };
export function validateRelation(r: Relation): string[] {
  const e: string[] = [];
  if (r.from === r.to) e.push("auto-relacao");
  if (r.nature === "equivalente-declarada" && (r.confidence !== "fonte-oficial" || !r.sourceRef)) e.push("equivalencia-sem-fonte");
  return e;
}

/** Cadeia questão SIA → habilidade → correção → domínio agregado. */
export type ItemSkill = { itemId: string; skillRef: string };
export type Response = { itemId: string; studentId: string; state: "certa" | "errada" | "em-branco" | "nao-lida" | "anulada" };
export type Limits = { minItemsPerSkill: number; minRespondents: number } | null; // sem regra homologada = null

export type SkillMastery = {
  skillRef: string; items: number; respondents: number; correct: number; valid: number;
  rate: number | null; status: "apurado" | "itens-insuficientes" | "respondentes-insuficientes" | "sem-regra" | "sem-respostas";
  excluded: number;
};

export function skillMastery(links: ItemSkill[], responses: Response[], limits: Limits): SkillMastery[] {
  const bySkill = new Map<string, Set<string>>();
  for (const l of links) { if (!bySkill.has(l.skillRef)) bySkill.set(l.skillRef, new Set()); bySkill.get(l.skillRef)!.add(l.itemId); }
  return [...bySkill].sort(([a], [b]) => a.localeCompare(b)).map(([skillRef, items]) => {
    const rs = responses.filter((r) => items.has(r.itemId));
    const validR = rs.filter((r) => r.state === "certa" || r.state === "errada" || r.state === "em-branco");
    const correct = validR.filter((r) => r.state === "certa").length;
    const respondents = new Set(validR.map((r) => r.studentId)).size;
    const base = { skillRef, items: items.size, respondents, correct, valid: validR.length, excluded: rs.length - validR.length };
    if (!validR.length) return { ...base, rate: null, status: "sem-respostas" as const };
    if (!limits) return { ...base, rate: null, status: "sem-regra" as const };
    if (items.size < limits.minItemsPerSkill) return { ...base, rate: null, status: "itens-insuficientes" as const };
    if (respondents < limits.minRespondents) return { ...base, rate: null, status: "respondentes-insuficientes" as const };
    return { ...base, rate: correct / validR.length, status: "apurado" as const };
  });
}

/** Lacunas: habilidade da matriz sem item ligado — informa cobertura, nunca baixo domínio. */
export function coverageGaps(matrixSkills: string[], links: ItemSkill[]): string[] {
  const linked = new Set(links.map((l) => l.skillRef));
  return matrixSkills.filter((s) => !linked.has(s));
}

/** Insumo para intervenção SIPE/OP: só habilidades apuradas abaixo de limiar homologado; sem limiar, nada. */
export function interventionCandidates(m: SkillMastery[], threshold: number | null) {
  if (threshold == null) return { ok: false as const, reason: "Sem limiar homologado: nenhuma habilidade é apontada para intervenção." };
  return { ok: true as const, skills: m.filter((s) => s.status === "apurado" && (s.rate as number) < threshold).map((s) => s.skillRef) };
}
