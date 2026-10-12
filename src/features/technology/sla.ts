// Tecnologia L06 — prioridade e prazos (migration 0480). Matriz, prazos e alertas vêm só da política versionada e
// aprovada por pessoa ≠ autor; prioridade é gravada pelo banco a partir da matriz. Prazo e alerta são PROJEÇÃO na
// leitura, em horas corridas (horário útil não é presumido); sem avaliação ou política, nada é concluído.
import type { OpsEvent } from "@/features/operations-center/shared-requests";

export interface SlaPolicy { id: string; version: number; impacts: string[]; urgencies: string[]; matrix: Record<string, string>;
  deadlines: Record<string, { response_hours: number; resolution_hours: number }>; alertPercents: number[]; pauseOnWait: boolean;
  personId: string; approvedBy: string | null }
export interface Assessment { seq: number; policyVersionId: string; impact: string; urgency: string; priority: string; at: string }

export function policyProblem(p: Omit<SlaPolicy, "id" | "version" | "personId" | "approvedBy">): string | null {
  if (new Set(p.impacts).size !== p.impacts.length || new Set(p.urgencies).size !== p.urgencies.length) return "valores-duplicados";
  for (const i of p.impacts) for (const u of p.urgencies) {
    const pr = p.matrix[`${i}|${u}`];
    if (!pr) return `celula-sem-prioridade:${i}|${u}`;
    if (!p.deadlines[pr]) return `prioridade-sem-prazo:${pr}`;
  }
  for (const [k, d] of Object.entries(p.deadlines)) if (!(d.response_hours > 0 && d.response_hours <= d.resolution_hours)) return `prazo-invalido:${k}`;
  return p.alertPercents.every((a) => a > 0 && a < 100) ? null : "alerta-invalido";
}

/** Política vigente = última versão, só se aprovada por outra pessoa. */
export function currentPolicy(vs: readonly SlaPolicy[]): SlaPolicy | null {
  const last = [...vs].sort((a, b) => b.version - a.version)[0];
  return last && last.approvedBy && last.approvedBy !== last.personId ? last : null;
}

const H = 3_600_000;
/** Horas corridas decorridas desde `start` até `until`, descontando intervalos em espera se a política mandar. */
function elapsedHours(start: string, until: number, events: readonly OpsEvent[], pause: boolean) {
  let total = until - Date.parse(start); if (!pause) return total / H;
  let waitFrom: number | null = null;
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    const t = Math.min(Date.parse(e.at), until);
    if (e.kind === "espera" && waitFrom === null) waitFrom = t;
    else if (waitFrom !== null && ["inicio", "atribuicao", "cancelamento", "conclusao"].includes(e.kind)) { total -= t - waitFrom; waitFrom = null; }
  }
  if (waitFrom !== null) total -= until - waitFrom;
  return total / H;
}

export type Clock = { status: "sem-avaliacao" | "politica-indisponivel" } | {
  status: "ok"; priority: string;
  response: { limitHours: number; elapsedHours: number; met: boolean; alert: "nenhum" | `limiar-${number}` | "vencido" };
  resolution: { limitHours: number; elapsedHours: number; met: boolean; alert: "nenhum" | `limiar-${number}` | "vencido" };
};

export function ticketClock(i: { createdAt: string; events: readonly OpsEvent[]; assessments: readonly Assessment[]; policies: readonly SlaPolicy[]; now: string }): Clock {
  const a = [...i.assessments].sort((x, y) => y.seq - x.seq)[0];
  if (!a) return { status: "sem-avaliacao" };
  const pol = i.policies.find((p) => p.id === a.policyVersionId);
  const d = pol?.deadlines[a.priority];
  if (!pol || !d) return { status: "politica-indisponivel" };
  const now = Date.parse(i.now);
  const firstStart = i.events.filter((e) => e.kind === "inicio").sort((x, y) => x.seq - y.seq)[0];
  const last = [...i.events].filter((e) => ["conclusao", "reabertura", "cancelamento"].includes(e.kind)).sort((x, y) => y.seq - x.seq)[0];
  const done = last && last.kind !== "reabertura" ? last : null;
  const phase = (limit: number, endAt: number | null) => {
    const el = elapsedHours(i.createdAt, endAt ?? now, i.events, pol.pauseOnWait);
    const pct = (el / limit) * 100;
    const hit = [...pol.alertPercents].sort((x, y) => y - x).find((p) => pct >= p);
    const alert = el > limit ? "vencido" as const : endAt !== null ? "nenhum" as const : hit ? (`limiar-${hit}` as const) : "nenhum" as const;
    return { limitHours: limit, elapsedHours: Math.round(el * 100) / 100, met: endAt !== null && el <= limit, alert };
  };
  return { status: "ok", priority: a.priority,
    response: phase(d.response_hours, firstStart ? Date.parse(firstStart.at) : null),
    resolution: phase(d.resolution_hours, done ? Date.parse(done.at) : null) };
}
