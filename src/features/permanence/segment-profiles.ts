// L17 — Particularidades de Educação Infantil, Fundamental e EJA semestral.
// Nada é fixo no código: cada segmento usa um PERFIL configurado e aprovado
// (escopo aberto etapa/modalidade, como as regras L03). Sem perfil aplicável,
// o sistema não aplica regra "padrão" de outro segmento — fica indeterminado.

export interface SegmentProfile {
  id: string; version: number; stage: string | null; modality: string | null;
  regime: "anual" | "semestral";               // declarado, nunca inferido
  contactTarget: "responsavel" | "proprio-estudante"; // EJA adulta fala com o próprio estudante
  attendanceUse: "sinal-de-acompanhamento" | "nao-usar"; // ex.: EI pode não usar frequência como sinal
  allowsOutOfSchoolSignal: boolean;            // crianças sem matrícula (L06)
  authorPerson: string; approvedBy: string | null; decisionRef: string | null;
}
export interface StudentContext { stage: string | null; modality: string | null; adult: boolean | null }

const approved = (p: SegmentProfile) => !!p.approvedBy && p.approvedBy !== p.authorPerson && !!p.decisionRef;
const matches = (p: SegmentProfile, c: StudentContext) =>
  (p.stage === null || p.stage === c.stage) && (p.modality === null || p.modality === c.modality);
const specificity = (p: SegmentProfile) => (p.stage ? 1 : 0) + (p.modality ? 1 : 0);

export type Resolution = { kind: "ok"; profile: SegmentProfile } | { kind: "indeterminado"; reason: "contexto-ausente" | "sem-perfil" | "perfis-concorrentes" };

/** Só a última versão de cada perfil, aprovada; o mais específico vence; empate = concorrência (bloqueia). */
export function resolveProfile(all: readonly SegmentProfile[], c: StudentContext): Resolution {
  if (!c.stage && !c.modality) return { kind: "indeterminado", reason: "contexto-ausente" };
  const heads = new Map<string, SegmentProfile>();
  for (const p of all) if ((heads.get(p.id)?.version ?? 0) < p.version) heads.set(p.id, p);
  const cand = [...heads.values()].filter((p) => approved(p) && matches(p, c));
  if (!cand.length) return { kind: "indeterminado", reason: "sem-perfil" };
  const top = Math.max(...cand.map(specificity));
  const best = cand.filter((p) => specificity(p) === top);
  return best.length === 1 ? { kind: "ok", profile: best[0] } : { kind: "indeterminado", reason: "perfis-concorrentes" };
}

/** Destinatário de contato: EJA adulta = o próprio estudante; menor nunca sem responsável. */
export function contactTargetFor(r: Resolution, c: StudentContext): "responsavel" | "proprio-estudante" | null {
  if (r.kind !== "ok") return null;
  if (r.profile.contactTarget === "proprio-estudante") return c.adult === true ? "proprio-estudante" : null;
  return "responsavel";
}

/** Janela de contato/visita para adultos: só horários DECLARADOS pelo próprio estudante (trabalho); sem declaração, nada é presumido. */
export interface AvailabilitySlot { weekday: number; from: string; to: string }
export function fitsDeclaredAvailability(slots: readonly AvailabilitySlot[] | null, at: { weekday: number; time: string }): boolean | null {
  if (slots === null) return null;
  return slots.some((s) => s.weekday === at.weekday && at.time >= s.from && at.time < s.to);
}

/** Frequência só vira sinal se o perfil disser; janela semestral exige período do calendário aplicável. */
export function attendanceSignalAllowed(r: Resolution, periodWindow: { from: string; to: string } | null): { allowed: boolean; reason: string | null } {
  if (r.kind !== "ok") return { allowed: false, reason: r.reason };
  if (r.profile.attendanceUse === "nao-usar") return { allowed: false, reason: "perfil-nao-usa-frequencia" };
  if (r.profile.regime === "semestral" && !periodWindow) return { allowed: false, reason: "semestre-sem-calendario" };
  return { allowed: true, reason: null };
}

export const outOfSchoolSignalAllowed = (r: Resolution) => r.kind === "ok" && r.profile.allowsOutOfSchoolSignal;
