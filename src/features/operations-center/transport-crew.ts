// Centro de Operações L19 — motoristas e monitores (migration 0427). Pessoa = atuação institucional vigente; designação
// cita ato juntado (nunca gerado aqui); requisitos por função são versão aprovada; escala é recusada sem tudo vigente.

export type CrewRole = "motorista" | "monitor";
export type Designation = { id: string; role: CrewRole; personId: string; engagementActive: (on: string) => boolean; validFrom: string; validUntil: string | null; revokedOn: string | null };
export type Credential = { key: string; validUntil: string };
export type Requirement = { role: CrewRole; version: number; requiredKeys: string[]; approved: boolean };

export function currentRequirement(reqs: Requirement[], role: CrewRole): Requirement | null {
  const latest = reqs.filter((r) => r.role === role).sort((a, b) => b.version - a.version)[0];
  return latest?.approved ? latest : null;
}

export function crewFitness(d: Designation, creds: Credential[], reqs: Requirement[], on: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (d.validFrom > on || (d.validUntil && d.validUntil < on) || (d.revokedOn && d.revokedOn <= on)) reasons.push("designacao-nao-vigente");
  if (!d.engagementActive(on)) reasons.push("atuacao-nao-vigente");
  const req = currentRequirement(reqs, d.role);
  if (!req) reasons.push("requisitos-nao-aprovados");
  else for (const k of req.requiredKeys) if (!creds.some((c) => c.key === k && c.validUntil >= on)) reasons.push(`habilitacao-ausente-ou-vencida:${k}`);
  return { ok: reasons.length === 0, reasons };
}

/** Duas escalas da mesma pessoa no mesmo dia e turno são conflito (espelha `opsshift:person-double-booked`). */
export function doubleBookings(shifts: { personId: string; onDate: string; shift: string; routeVersionId: string }[]) {
  const seen = new Map<string, string>(); const out: string[] = [];
  for (const s of shifts) { const k = `${s.personId}|${s.onDate}|${s.shift}`; if (seen.has(k) && seen.get(k) !== s.routeVersionId) out.push(k); else seen.set(k, s.routeVersionId); }
  return out;
}

export const CREW_FABRICATES_ACTS = false;
