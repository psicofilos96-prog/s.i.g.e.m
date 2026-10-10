/**
 * Regras extraídas dos MODELOS DE DIÁRIO DA REDE (planilhas enviadas pelo proprietário em 2026-10-10).
 * Cada regra cita arquivo/aba/célula de origem; nada aqui é inventado. Os perfis complementam
 * `stage-engine.ts`: a regra documentada no modelo da rede vale como parâmetro do perfil
 * (decisão do proprietário: documento da rede é fonte suficiente), sempre versionado.
 */
import type { StageProfile } from "./stage-engine";

export type SourceRef = { file: string; sheet: string; cell: string };
export type EnrollmentStatus = "Ativo" | "Transferido" | "Evadido" | "Cancelado" | "Falecido" | string;

const SIGLA: Record<string, { short: string; long: string }> = {
  Transferido: { short: "T", long: "TRANSFERIDO" },
  Evadido: { short: "E", long: "EVADIDO" },
  Cancelado: { short: "MC", long: "MATRÍCULA CANCELADA" },
  Falecido: { short: "F", long: "FALECIDO" },
};
/** Sigla do modelo para matrícula encerrada (fonte: FINAL!G8 / FINAL!N8). Null = sem sigla. */
export const statusSigla = (s: EnrollmentStatus) => SIGLA[s] ?? null;

export const REFS = {
  periodGradeFII: { file: "1 - Língua Portuguesa - 600.xlsx", sheet: "1º PL", cell: "Q12" },
  finalAverage: { file: "1 - Língua Portuguesa - 600.xlsx", sheet: "FINAL", cell: "G8" },
  componentResult: { file: "1 - Língua Portuguesa - 600.xlsx", sheet: "FINAL", cell: "N8" },
  attendancePct: { file: "1 - Língua Portuguesa - 600.xlsx", sheet: "1º PL", cell: "H12" },
  ejaResult: { file: "Diário - Fase II 1º sem - 1º semestre.xlsx", sheet: "Folha Final", cell: "AA5" },
  periodGradeFI: { file: "Diário - 100.xlsx", sheet: "PAP 1º PL", cell: "G9" },
} satisfies Record<string, SourceRef>;

export const PASS_MARK = 50;
export const EJA_MIN_ATTENDANCE = 0.75;

type Num = number | null;
const present = (xs: readonly Num[]) => xs.filter((x): x is number => typeof x === "number");

/** Fundamental II, nota do período: MAX(TOTAL, RecParalela + Instrumentos + Participação). AV1/AV2 30, Inst 30, Part 10, Rec 60. */
export function periodGradeFII(i: { av1: Num; av2: Num; instruments: Num; participation: Num; parallelRecovery: Num }): Num {
  const all = [i.av1, i.av2, i.instruments, i.participation];
  if (all.every((x) => x === null) && i.parallelRecovery === null) return null; // ausência nunca vira zero
  const total = present(all).reduce((a, b) => a + b, 0);
  const rec = i.parallelRecovery === null ? null : i.parallelRecovery + (i.instruments ?? 0) + (i.participation ?? 0);
  return rec === null ? total : Math.max(total, rec);
}

/** Fundamental I (PAP), nota do período = soma dos instrumentos lançados. */
export function periodGradeFI(instruments: readonly Num[]): Num {
  const p = present(instruments);
  return p.length ? p.reduce((a, b) => a + b, 0) : null;
}

/** Média final = ROUND(MÉDIA das notas de período); só com todas as notas presentes. */
export function finalAverage(periodGrades: readonly Num[]): Num {
  if (!periodGrades.length || periodGrades.some((g) => g === null)) return null;
  const p = present(periodGrades);
  return Math.round(p.reduce((a, b) => a + b, 0) / p.length);
}

/** % frequência do modelo: ROUND((AD−faltas)/AD, 2); 100% com falta vira 0,99. */
export function attendancePct(lessonsGiven: Num, absences: Num): Num {
  if (!lessonsGiven || absences === null) return null;
  const r = Math.round(((lessonsGiven - absences) / lessonsGiven) * 100) / 100;
  return absences > 0 && r === 1 ? 0.99 : r;
}

export type Result = "APROVADO" | "REPROVADO" | "PENDENTE" | string;

/** Resultado por componente (Fund. II): MAX(média, rec. final) ≥ 50. */
export function componentResult(status: EnrollmentStatus, average: Num, finalRecovery: Num): Result {
  const s = statusSigla(status); if (s) return s.long;
  const best = present([average, finalRecovery]);
  if (average === null) return "PENDENTE";
  return Math.max(...best) >= PASS_MARK ? "APROVADO" : "REPROVADO";
}

/** EJA: todos os componentes MAX(média, rec) ≥ 50 E frequência ≥ 75%. */
export function ejaResult(status: EnrollmentStatus, comps: readonly { average: Num; finalRecovery: Num }[], attendance: Num): Result {
  const s = statusSigla(status); if (s) return s.long;
  if (!comps.length || attendance === null || comps.some((c) => c.average === null)) return "PENDENTE";
  const ok = comps.every((c) => Math.max(...present([c.average, c.finalRecovery])) >= PASS_MARK);
  return ok && attendance >= EJA_MIN_ATTENDANCE ? "APROVADO" : "REPROVADO";
}

const doc = (ref: SourceRef) => ({ state: "homologado" as const, ref: `modelo-rede:${ref.file}#${ref.sheet}!${ref.cell}` });
/** Perfis v2: mesma forma dos perfis-base, com regra documentada no modelo da rede. EI segue sem nota. */
export const NETWORK_MODEL_PROFILES: readonly StageProfile[] = [
  { id: "fundamental-anos-iniciais", version: 2, label: "Fundamental I", forms: ["frequencia-diaria", "nota-por-componente"], periods: { kind: "calendario-oficial", periodKind: "periodo" }, approvalRule: doc(REFS.componentResult), gradeScale: doc(REFS.periodGradeFI) },
  { id: "fundamental-anos-finais", version: 2, label: "Fundamental II", forms: ["frequencia-por-componente", "nota-por-componente"], periods: { kind: "calendario-oficial", periodKind: "periodo" }, approvalRule: doc(REFS.componentResult), gradeScale: doc(REFS.periodGradeFII) },
  { id: "eja", version: 2, label: "EJA", forms: ["frequencia-por-componente", "nota-por-componente"], periods: { kind: "calendario-oficial", periodKind: "semestre" }, approvalRule: doc(REFS.ejaResult), gradeScale: doc(REFS.periodGradeFII) },
];
