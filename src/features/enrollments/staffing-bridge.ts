/**
 * Rede — L20 Demanda validada de novas turmas → Gestão de Pessoas.
 * Só propostas L04 DEFERIDAS (decisão com ato, decisor ≠ proponente) entram. Para cada turma planejada,
 * a necessidade docente é a carga da matriz homologada por posição (pacotes componente×turma×aulas, como
 * L10 — nunca número de professores por divisão de jornada). Apoio (não docente) só por critério
 * homologado L16 passado como função; sem critério ⇒ null. Saída é projeção: `writes: []`, nenhum vínculo,
 * lotação ou atribuição é criado; o próximo passo é proposta no fluxo L11 por pessoa competente.
 */
export interface DeferredPlan { proposalId: string; kind: "abertura" | "ampliacao"; decided: boolean; decisionActRef: string | null; decidedBy: string | null; proposedBy: string; schoolId: string; plannedClasses: readonly { planKey: string; positionKey: string; shift: string; expectedStudents: number | null }[] }
export interface MatrixItem { positionKey: string; componentId: string; weeklyLessons: number | null; requiredQualification: string | null; matrixVersionId: string; homologated: boolean }
export type SupportCriterion = (input: { schoolId: string; newClasses: number; newStudents: number | null }) => { area: string; reference: number | null; criterionVersion: string }[] | null;

export interface Package { proposalId: string; planKey: string; componentId: string; weeklyLessons: number | null; requiredQualification: string | null; matrixVersionId: string | null; status: "descoberto" | "indeterminado"; reason?: string }

export function bridge(plans: readonly DeferredPlan[], matrix: readonly MatrixItem[], support: SupportCriterion | null) {
  const accepted = plans.filter((p) => p.decided && p.decisionActRef && p.decidedBy && p.decidedBy !== p.proposedBy);
  const rejected = plans.filter((p) => !accepted.includes(p)).map((p) => ({ proposalId: p.proposalId, reason: "Proposta não deferida com ato por decisor distinto." }));
  const packages: Package[] = [];
  for (const p of accepted) for (const c of p.plannedClasses) {
    const items = matrix.filter((m) => m.positionKey === c.positionKey && m.homologated);
    const versions = new Set(items.map((i) => i.matrixVersionId));
    if (items.length === 0 || versions.size > 1) {
      packages.push({ proposalId: p.proposalId, planKey: c.planKey, componentId: "*", weeklyLessons: null, requiredQualification: null, matrixVersionId: null, status: "indeterminado", reason: items.length ? "Matriz ambígua." : "Sem matriz homologada para a posição." });
      continue;
    }
    for (const i of items) packages.push({ proposalId: p.proposalId, planKey: c.planKey, componentId: i.componentId, weeklyLessons: i.weeklyLessons, requiredQualification: i.requiredQualification, matrixVersionId: i.matrixVersionId, status: i.weeklyLessons === null ? "indeterminado" : "descoberto", ...(i.weeklyLessons === null ? { reason: "Carga não declarada na matriz." } : {}) });
  }
  const anyIndet = packages.some((x) => x.status === "indeterminado");
  const totalLessons = anyIndet ? null : packages.reduce((a, x) => a + (x.weeklyLessons ?? 0), 0);
  const bySchool = new Map<string, { classes: number; students: number | null }>();
  for (const p of accepted) for (const c of p.plannedClasses) {
    const s = bySchool.get(p.schoolId) ?? { classes: 0, students: 0 };
    s.classes++; s.students = s.students === null || c.expectedStudents === null ? null : s.students + c.expectedStudents;
    bySchool.set(p.schoolId, s);
  }
  const supportNeeds = [...bySchool].map(([schoolId, s]) => ({ schoolId, needs: support ? support({ schoolId, newClasses: s.classes, newStudents: s.students }) : null }));
  return { packages, totalWeeklyLessons: totalLessons, supportNeeds, rejected, writes: [] as const, createsLinks: false as const, createsAssignments: false as const, nextStep: "proposta de atribuição (L11) por pessoa competente", nature: "projecao-de-planejamento" as const };
}
