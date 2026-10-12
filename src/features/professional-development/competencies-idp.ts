// L19 — competências e PDI (migration 0450). Curso só "contribui para" competência: conclusão nunca comprova domínio.
export const DOMAIN_NOTE = "Concluir um curso não comprova domínio da competência.";

export interface IdpGoal { key: string; text: string; competency_version_id?: string | null; target_on?: string | null }
export interface IdpActivity { key: string; goal_key: string; kind: "curso" | "leitura" | "pratica" | "mentoria" | "outro"; description: string; course_id?: string | null }
export type ActivityStatus = "planejada" | "em-andamento" | "concluida" | "abandonada";

const KEY = /^[a-z0-9-]{1,40}$/;
export function idpProblems(goals: IdpGoal[], activities: IdpActivity[], approvedCompetencies: Set<string>): string[] {
  const p: string[] = [];
  if (goals.length === 0) p.push("Ao menos uma meta");
  const gk = new Set<string>();
  for (const g of goals) {
    if (!KEY.test(g.key) || gk.has(g.key)) p.push(`Meta com chave inválida: ${g.key}`);
    if (g.text.trim().length < 10) p.push(`Meta ${g.key} sem descrição suficiente`);
    if (g.competency_version_id && !approvedCompetencies.has(g.competency_version_id)) p.push(`Meta ${g.key} cita competência não aprovada`);
    gk.add(g.key);
  }
  const ak = new Set<string>();
  for (const a of activities) {
    if (!KEY.test(a.key) || ak.has(a.key)) p.push(`Atividade com chave inválida: ${a.key}`);
    if (!gk.has(a.goal_key)) p.push(`Atividade ${a.key} sem meta`);
    if (a.kind === "curso" && !a.course_id) p.push(`Atividade ${a.key} de curso sem curso do catálogo`);
    ak.add(a.key);
  }
  return p;
}

/** Progresso do PDI = atividades concluídas pelo titular; nunca "competência dominada". */
export function idpProgress(activities: IdpActivity[], latest: Map<string, ActivityStatus>) {
  const active = activities.filter((a) => latest.get(a.key) !== "abandonada");
  return { done: active.filter((a) => latest.get(a.key) === "concluida").length, total: active.length };
}

export function canRead(x: { viewer: string; owner: string; shares: { grantee: string; validUntil: string; revoked: boolean }[]; today: string }): boolean {
  if (x.viewer === x.owner) return true;
  return x.shares.some((s) => s.grantee === x.viewer && !s.revoked && s.validUntil >= x.today);
}
