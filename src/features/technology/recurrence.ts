// Tecnologia L09 — incidentes operacionais e problemas recorrentes (migration 0483). Incidente = chamado com natureza
// vigente 'incidente' (L02). Chave de recorrência = escola + categoria vigente (L04) + objeto vinculado vigente
// (bem/ambiente); sem objeto, a chave é só escola+categoria. Janela e mínimo vêm da regra aprovada; sem regra,
// nenhum sinal. Recorrência é candidata a problema (PRB) — abrir o problema é ato humano, nunca automático.
export interface IncidentFact { id: string; schoolId: string; createdAt: string; nature: "incidente" | "requisicao" | null; categoryKey: string | null; objectRefs: string[] }
export interface RecurrenceRule { id: string; version: number; windowDays: number; minIncidents: number; personId: string; approvedBy: string | null }

export function currentRule(vs: readonly RecurrenceRule[]): RecurrenceRule | null {
  const last = [...vs].sort((a, b) => b.version - a.version)[0];
  return last && last.approvedBy && last.approvedBy !== last.personId ? last : null;
}

export type Analysis = { status: "sem-regra" } | {
  status: "ok"; ruleVersion: number; incidents: number; uncategorized: number;
  groups: { key: string; schoolId: string; categoryKey: string; objectRef: string | null; count: number; first: string; last: string; ticketIds: string[]; linkedProblem: boolean }[];
};

export function recurrenceAnalysis(i: { facts: readonly IncidentFact[]; rules: readonly RecurrenceRule[]; linkedTicketIds: ReadonlySet<string>; now: string }): Analysis {
  const rule = currentRule(i.rules);
  if (!rule) return { status: "sem-regra" };
  const from = Date.parse(i.now) - rule.windowDays * 86_400_000;
  const inc = i.facts.filter((f) => f.nature === "incidente" && Date.parse(f.createdAt) >= from && Date.parse(f.createdAt) <= Date.parse(i.now));
  const groups = new Map<string, IncidentFact[]>();
  for (const f of inc) {
    if (!f.categoryKey) continue;
    const objs = f.objectRefs.length ? f.objectRefs : [null];
    for (const o of objs) {
      const k = `${f.schoolId}|${f.categoryKey}|${o ?? "-"}`;
      groups.set(k, [...(groups.get(k) ?? []), f]);
    }
  }
  return {
    status: "ok", ruleVersion: rule.version, incidents: inc.length, uncategorized: inc.filter((f) => !f.categoryKey).length,
    groups: [...groups].filter(([, fs]) => fs.length >= rule.minIncidents).map(([key, fs]) => {
      const [schoolId, categoryKey, o] = key.split("|") as [string, string, string];
      const dates = fs.map((f) => f.createdAt).sort();
      return { key, schoolId, categoryKey, objectRef: o === "-" ? null : o, count: fs.length, first: dates[0]!, last: dates.at(-1)!,
        ticketIds: fs.map((f) => f.id).sort(), linkedProblem: fs.every((f) => i.linkedTicketIds.has(f.id)) };
    }).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
  };
}

/** Candidatas a problema: grupos recorrentes com algum incidente ainda sem vínculo a PRB. */
export const problemCandidates = (a: Analysis) => (a.status === "ok" ? a.groups.filter((g) => !g.linkedProblem) : []);
