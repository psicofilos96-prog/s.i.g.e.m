/**
 * Centro de Operações — L04: vistorias (migration 0406).
 * Checklist = versão append-only aprovada por pessoa ≠ autor com decisão; só a última versão
 * aprovada programa vistoria. Prioridades admitidas vêm do checklist (nenhuma no código).
 * Programada/extraordinária (esta exige motivo); responsável = atuação vigente na data.
 * Registro só pela pessoa da atuação responsável; respostas ⊂ checklist; item sem resposta
 * fica "não verificado" (nunca conforme); evidências = juntadas do SIGEM Documentos.
 * VISTORIA NÃO É LAUDO: recomendação que exige laudo vira encaminhamento a profissional
 * habilitado, e nenhuma projeção afirma segurança estrutural, elétrica ou sanitária.
 */
export interface ChecklistItem { key: string; label: string; answers: string[]; nonConforming?: string[] }
export interface ChecklistVersion {
  id: string; checklistKey: string; version: number; items: ChecklistItem[]; priorities: string[];
  authorPerson: string; approval: { approverPerson: string; decisionRef: string } | null;
}
export interface Recommendation { text: string; priority?: string; responsible?: string; requiresTechnicalReport?: boolean; spaceId?: string }
export interface InspectionRecord {
  seq: number; kind: "realizada" | "nao-realizada" | "retificacao" | "cancelada"; performedOn: string | null;
  answers: Record<string, string>; recommendations: Recommendation[]; note: string | null; inspectorPerson: string;
}
export interface Inspection { id: string; kind: "programada" | "extraordinaria"; scheduledOn: string; checklistVersionId: string; responsibleEngagement: string; motive: string | null }

export const NOT_A_TECHNICAL_REPORT = "Vistoria é constatação visual registrada por pessoa da escola/rede; não substitui laudo técnico de profissional habilitado.";

export function checklistUsable(all: readonly ChecklistVersion[], id: string): ChecklistVersion | null {
  const c = all.find((x) => x.id === id);
  if (!c?.approval || c.approval.approverPerson === c.authorPerson || !c.approval.decisionRef.trim()) return null;
  return c.version === Math.max(...all.filter((x) => x.checklistKey === c.checklistKey).map((x) => x.version)) ? c : null;
}

export function validateChecklist(items: readonly ChecklistItem[]): string[] {
  const p: string[] = [];
  if (!items.length) p.push("Checklist sem itens.");
  const keys = new Set<string>();
  for (const it of items) {
    if (!/^[a-z0-9-]{1,60}$/.test(it.key)) p.push(`Chave inválida: ${it.key}`);
    if (keys.has(it.key)) p.push(`Chave repetida: ${it.key}`);
    keys.add(it.key);
    if (it.answers.length < 2) p.push(`Item ${it.key} precisa de ao menos duas respostas.`);
    for (const n of it.nonConforming ?? []) if (!it.answers.includes(n)) p.push(`Item ${it.key}: não conformidade fora das respostas.`);
  }
  return p;
}

export function validateRecord(c: ChecklistVersion, r: Omit<InspectionRecord, "seq" | "inspectorPerson">, today: string): string[] {
  const p: string[] = [];
  if ((r.kind === "realizada" || r.kind === "retificacao") && !r.performedOn) p.push("Data de realização obrigatória.");
  if (r.performedOn && r.performedOn > today) p.push("Realização no futuro.");
  if (r.kind !== "realizada" && (!r.note || r.note.trim().length < 10)) p.push("Justificativa obrigatória.");
  for (const [k, v] of Object.entries(r.answers)) {
    const it = c.items.find((i) => i.key === k);
    if (!it) p.push(`Item ${k} não pertence ao checklist.`);
    else if (!it.answers.includes(v)) p.push(`Resposta "${v}" não admitida em ${k}.`);
  }
  for (const rec of r.recommendations) {
    if (rec.text.trim().length < 10) p.push("Recomendação curta demais.");
    if (rec.priority && !c.priorities.includes(rec.priority)) p.push(`Prioridade "${rec.priority}" não configurada.`);
  }
  return p;
}

export type InspectionState = "programada" | "realizada" | "nao-realizada" | "cancelada" | "atrasada";
export interface InspectionView {
  state: InspectionState; current: InspectionRecord | null; rectifications: number;
  items: { key: string; label: string; answer: string | null; status: "conforme-registrado" | "nao-conforme" | "nao-verificado" }[];
  recommendations: (Recommendation & { route: "manutencao" | "laudo-tecnico" })[];
  notice: string;
}

/** Projeção: último registro vigente; atraso só se programada e data passou sem registro. */
export function projectInspection(i: Inspection, c: ChecklistVersion, records: readonly InspectionRecord[], today: string): InspectionView {
  const sorted = [...records].sort((a, b) => a.seq - b.seq);
  const last = sorted[sorted.length - 1] ?? null;
  const current = [...sorted].reverse().find((r) => r.kind === "realizada" || r.kind === "retificacao") ?? null;
  const state: InspectionState = !last ? (i.scheduledOn < today ? "atrasada" : "programada")
    : last.kind === "cancelada" ? "cancelada" : last.kind === "nao-realizada" ? "nao-realizada" : "realizada";
  const items = c.items.map((it) => {
    const a = current?.answers[it.key] ?? null;
    return { key: it.key, label: it.label, answer: a,
      status: a === null ? "nao-verificado" as const : (it.nonConforming ?? []).includes(a) ? "nao-conforme" as const : "conforme-registrado" as const };
  });
  return {
    state, current, rectifications: sorted.filter((r) => r.kind === "retificacao").length, items,
    recommendations: (current?.recommendations ?? []).map((r) => ({ ...r, route: r.requiresTechnicalReport ? "laudo-tecnico" as const : "manutencao" as const })),
    notice: NOT_A_TECHNICAL_REPORT,
  };
}

/** Texto proibido: vistoria nunca atesta segurança como se fosse laudo. */
const FORBIDDEN = /\b(laudo aprovado|estrutura segura|seguran[çc]a atestada|apto para uso|atesto)\b/i;
export const recommendationAttests = (text: string) => FORBIDDEN.test(text);

export const inspectionKey = (school: string, purposeRef: string) => `ops-insp|${school}|${purposeRef}`;
export const inspectionRecordKey = (inspection: string, expected: number, kind: InspectionRecord["kind"]) => `ops-insp-r|${inspection}|${expected}|${kind}`;
