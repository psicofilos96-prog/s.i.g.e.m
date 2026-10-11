/**
 * Alimentação Lote 10 — alimentação especial e segurança sanitária (modelo puro).
 * Restrição continua em dietary_restrictions (record_dietary_restriction, capability
 * consultar-restricao-alimentar); necessidade especial = espécie `necessidade-alimentar-especial`;
 * controles operacionais = `modelo-operacional` homologado + record_meal_operational_record.
 * Plano individual só por nutricionista com registro; cozinha vê só o mínimo; nada clínico sai daqui.
 * Nenhum diagnóstico, laudo ou certificação sanitária é emitido.
 */
export interface DietPlan {
  id: string; studentId: string; restrictedItems: string[];
  substitutions: { from: string; to: string }[];
  validFrom: string; validTo: string | null; reviewBy: string | null;
  authorId: string; authorRegistry: string | null;
  clinical: { condition?: string; reportRef?: string } | null; // nunca sai para cozinha
}

export function planProblems(p: DietPlan): string[] {
  const e: string[] = [];
  if (!p.authorRegistry) e.push("plano alimentar só por nutricionista com registro profissional");
  if (!p.restrictedItems.length) e.push("plano sem restrição declarada");
  if (p.validTo && p.validTo < p.validFrom) e.push("vigência inválida");
  if (!p.reviewBy) e.push("data de revisão obrigatória");
  for (const s of p.substitutions) if (p.restrictedItems.includes(s.to)) e.push(`substituto ${s.to} também é restrito`);
  return e;
}

export const planActive = (p: DietPlan, on: string) => p.validFrom <= on && (p.validTo == null || on <= p.validTo);
export const reviewOverdue = (p: DietPlan, on: string) => p.reviewBy != null && p.reviewBy < on;

/** Visão da cozinha: só primeiro nome/turma (fornecidos pela lista da escola), itens e substituições. */
export function kitchenView(plans: DietPlan[], on: string, names: Map<string, string>) {
  return plans.filter((p) => planActive(p, on)).map((p) => ({
    who: names.get(p.studentId) ?? "estudante (nome não disponível)",
    avoid: p.restrictedItems, use: p.substitutions,
    review: reviewOverdue(p, on) ? "revisão vencida — consultar nutricionista" : null,
  }));
}

/** Alerta de ingrediente: preparação do dia × itens restritos dos planos vigentes. */
export function ingredientAlerts(plans: DietPlan[], on: string, prep: { id: string; items: string[] }) {
  return plans.filter((p) => planActive(p, on)).flatMap((p) => p.restrictedItems.filter((i) => prep.items.includes(i)).map((item) => ({
    planId: p.id, item, preparationId: prep.id,
    substitute: p.substitutions.find((s) => s.from === item)?.to ?? null,
    action: p.substitutions.some((s) => s.from === item) ? "aplicar substituição autorizada" : "sem substituição autorizada — consultar nutricionista",
  })));
}

/** Acesso ao detalhe clínico: capability própria + finalidade; todo acesso vira evento de auditoria. */
export function clinicalAccess(p: DietPlan, a: { userId: string; hasCapability: boolean; purpose: string }, at: string) {
  const event = { planId: p.id, userId: a.userId, purpose: a.purpose, at, granted: false };
  if (!a.hasCapability || !a.purpose.trim()) return { granted: false as const, event };
  return { granted: true as const, clinical: p.clinical, event: { ...event, granted: true } };
}

// ---------- Checklists sanitários ----------
export type Area = "higiene" | "conservacao" | "temperatura" | "transporte" | "pragas" | "limpeza";
export interface CheckItem { id: string; area: Area; text: string; critical: boolean; numeric?: { min: number | null; max: number | null } }
export interface ChecklistVersion { id: string; version: number; homologated: boolean; items: CheckItem[] }
export interface Answer { itemId: string; ok: boolean | null; value: number | null; note: string }

const LAUDO = /\b(laudo|certific|atesto|aprovad[oa] sanitari|diagn[oó]stic)/i;

export function evaluate(cl: ChecklistVersion, answers: Answer[], who: { id: string; isPerson: boolean }) {
  if (!cl.homologated) return { error: "checklist não homologado" } as const;
  if (!who.isPerson) return { error: "registro exige pessoa natural" } as const;
  if (answers.some((a) => LAUDO.test(a.note))) return { error: "registro não emite laudo, certificação ou diagnóstico" } as const;
  const rows = cl.items.map((it) => {
    const a = answers.find((x) => x.itemId === it.id);
    if (!a || (a.ok == null && a.value == null)) return { it, state: "nao-respondido" as const };
    let fail = a.ok === false;
    if (it.numeric && a.value != null) fail = fail || (it.numeric.min != null && a.value < it.numeric.min) || (it.numeric.max != null && a.value > it.numeric.max);
    return { it, state: fail ? ("nao-conforme" as const) : ("conforme" as const), value: a.value };
  });
  const critical = rows.filter((r) => r.state === "nao-conforme" && r.it.critical);
  return {
    checklist: `${cl.id}@v${cl.version}`, rows,
    pending: rows.filter((r) => r.state === "nao-respondido").map((r) => r.it.id),
    // Ocorrência crítica vira encaminhamento (demand-center) ao setor competente; nunca conclusão sanitária.
    referrals: critical.map((r) => ({ itemId: r.it.id, area: r.it.area, text: r.it.text, to: "setor competente (vigilância/nutrição)", idempotencyKey: `${cl.id}:${cl.version}:${r.it.id}` })),
    conclusion: "registro de verificação — não é laudo nem certificação sanitária" as const,
  };
}
