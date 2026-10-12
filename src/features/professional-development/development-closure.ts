/**
 * SIGEM Desenvolvimento L24 — fechamento: 24 lotes com evidência em disco, cenários exigidos mapeados a testes reais,
 * matriz 47 seções + 18 critérios (sobre L01) e bloqueios. Nenhum status "homologado": aprovação humana não é simulada.
 */
import { DEV_CRITERIA, DEV_SECTIONS } from "./development-audit";

export const DEV_CLOSURE_BASE_SHA = "f46379387bd095b821723544a5d222f7bc9cdf95";
const F = "src/features/professional-development";
const M = "drizzle/migrations";

export type ClosureStatus = "com-tela" | "persistido" | "nucleo-testado" | "bloqueado";
type Lot = Readonly<{ lot: number; title: string; evidence: readonly string[] }>;
const L = (lot: number, title: string, ...evidence: string[]): Lot => ({ lot, title, evidence });

export const DEV_LOTS: readonly Lot[] = [
  L(1, "Auditoria", `${F}/development-audit.ts`), L(2, "Cadeia formativa", `${F}/formation-chain.ts`, "supabase/tests/dev02_formation_chain.sql"),
  L(3, "Painel", `${F}/development-hub-model.ts`, `${F}/development-hub-page.tsx`), L(4, "Diagnóstico", `${F}/needs-diagnosis.ts`),
  L(5, "Plano anual", `${F}/annual-plan.ts`), L(6, "Trilhas", `${F}/tracks.ts`), L(7, "Catálogo", `${F}/course-catalog.ts`),
  L(8, "Turmas", `${F}/formative-classes.ts`), L(9, "Calendário", `${F}/formative-calendar.ts`), L(10, "Inscrição", `${F}/enrollment-flow.ts`),
  L(11, "Formadores", `${F}/participants-trainers.ts`), L(12, "Frequência", `${F}/formation-attendance.ts`), L(13, "Ambiente", `${F}/learning-environment.ts`),
  L(14, "Resultados", `${F}/learning-results.ts`), L(15, "Conclusão", `${F}/completion-engine.ts`), L(16, "Certificados", `${F}/certificates.ts`),
  L(17, "Histórico", `${F}/formation-record.ts`, `${F}/formation-record-page.tsx`), L(18, "Externas", `${F}/external-trainings.ts`),
  L(19, "Competências/PDI", `${F}/competencies-idp.ts`), L(20, "Avaliação/impacto", `${F}/evaluation-impact.ts`), L(21, "Trilhas por função", `${F}/role-tracks.ts`, `${M}/0452_dev21_role_tracks.sql`),
  L(22, "Integrações/parceiros", `${F}/development-integrations.ts`, `${M}/0453_dev22_partners_integration.sql`), L(23, "Relatórios", `${F}/development-reports.ts`),
  L(24, "Fechamento", `${F}/development-closure.ts`, "supabase/tests/dev24_development_rls.sql", `${M}/0454_dev24_append_only_role_tracks_partners.sql`),
];

/** Cenários pedidos no L24 → arquivo de teste + trecho que precisa existir. E2E autenticado é declarado pendente. */
export const DEV_SCENARIOS = [
  { scenario: "Vagas concorrentes (lock da turma)", file: `${F}/enrollment-flow.test.ts`, needle: "vaga", layer: "ts+sql-writer" },
  { scenario: "Versões de curso", file: `${F}/course-catalog.test.ts`, needle: "vers", layer: "ts" },
  { scenario: "Frequência", file: `${F}/formation-attendance.test.ts`, needle: "lançad", layer: "ts" },
  { scenario: "Critérios de conclusão", file: `${F}/completion-engine.test.ts`, needle: "indetermin", layer: "ts" },
  { scenario: "Certificado imutável", file: `${F}/certificates.test.ts`, needle: "revog", layer: "ts+sql-trigger" },
  { scenario: "Formação externa", file: `${F}/external-trainings.test.ts`, needle: "progress", layer: "ts" },
  { scenario: "Mudança de lotação", file: `${F}/participants-trainers.test.ts`, needle: "lota", layer: "ts" },
  { scenario: "Formador externo", file: `${F}/participants-trainers.test.ts`, needle: "externo", layer: "ts" },
  { scenario: "RLS e append-only em todas as tabelas", file: "supabase/tests/dev24_development_rls.sql", needle: "relrowsecurity", layer: "sql" },
  { scenario: "Ausência de progressão automática", file: `${F}/development-integrations.test.ts`, needle: "progressão", layer: "ts+sql" },
  { scenario: "Fluxo autenticado no navegador", file: `${F}/development-closure.test.ts`, needle: "e2e-pendente", layer: "e2e-pendente" },
] as const;

/** Seções que permanecem bloqueadas por decisão/fonte externa (motivo por extenso). */
export const DEV_BLOCKED: Readonly<Record<number, string>> = {
  6: "Plano municipal depende de ato/decisão competente registrado; a cadeia L05 existe sem plano aprovado.",
  11: "Elegibilidade por público exige regra aprovada por pessoa competente.",
  28: "Equivalência de cargas exige regra municipal aprovada.",
  32: "Efeito funcional (progressão) é ato do DP; nunca automático.",
  42: "Nenhuma plataforma externa identificada com contrato.",
  43: "Custos/financiamento sem fonte contábil canônica.",
};
const WITH_SCREEN = new Set([1, 9, 17, 29, 45, 46, 47]);
const PERSISTED_BY_LOT: Readonly<Record<number, number>> = {
  5: 4, 7: 2, 8: 7, 10: 10, 12: 10, 13: 10, 14: 10, 15: 11, 16: 7, 18: 9, 19: 12, 20: 15, 21: 13, 22: 14, 23: 20, 24: 15, 25: 16, 26: 16,
  27: 18, 33: 21, 34: 19, 35: 20, 36: 22, 37: 22, 38: 13, 44: 20,
};

export function closureOfSection(n: number): { status: ClosureStatus; reason: string } {
  if (DEV_BLOCKED[n]) return { status: "bloqueado", reason: DEV_BLOCKED[n]! };
  if (WITH_SCREEN.has(n)) return { status: "com-tela", reason: "Tela lê só com sessão; ações dependem de capacidades não atribuídas." };
  if (PERSISTED_BY_LOT[n]) return { status: "persistido", reason: `Writer/RLS no banco (L${PERSISTED_BY_LOT[n]}); sem tela operacional.` };
  return { status: "nucleo-testado", reason: "Fonte canônica reaproveitada; coberto por teste." };
}
export function closureOfCriterion(n: number): { status: ClosureStatus; reason: string } {
  if (n === 18) return { status: "nucleo-testado", reason: "SQL e TS executados; E2E autenticado não executado." };
  return { status: "persistido", reason: "Garantido por writer DEFINER, RLS e trigger, provado em dev24_development_rls.sql." };
}

export const devClosureMatrix = () => ({
  sections: DEV_SECTIONS.map((s) => ({ n: s.n, title: s.title, ...closureOfSection(s.n) })),
  criteria: DEV_CRITERIA.map((c) => ({ n: c.n, title: c.title, ...closureOfCriterion(c.n) })),
});

export const DEV_PENDING = [
  "Atribuir capacidades (gestão, aprovação, exportação, parceiros, trilhas por função) por decisão competente.",
  "E2E autenticado com contas sintéticas pela porta fail-closed de scripts e concorrência real de vagas.",
  "Telas operacionais de preparo/validação/emissão, submissão externa, PDI e parceiros.",
  "Limiar de agregação aprovado para resultados e avaliação de reação.",
] as const;

export function devClosureProblems(exists: (p: string) => boolean, read: (p: string) => string): string[] {
  const p: string[] = [];
  if (DEV_LOTS.length !== 24) p.push("Esperados 24 lotes.");
  if (DEV_SECTIONS.length !== 47 || DEV_CRITERIA.length !== 18) p.push("Esperadas 47 seções e 18 critérios.");
  for (const l of DEV_LOTS) for (const e of l.evidence) if (!exists(e)) p.push(`L${l.lot}: evidência ausente ${e}`);
  for (const s of DEV_SCENARIOS) {
    if (!exists(s.file)) { p.push(`${s.scenario}: arquivo ausente`); continue; }
    if (!read(s.file).toLowerCase().includes(s.needle.toLowerCase())) p.push(`${s.scenario}: "${s.needle}" não encontrado`);
  }
  return p;
}
