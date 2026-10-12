// Centro de Operações L18 — veículos próprios (bem do patrimônio L09) e contratados (contrato juntado), migrations 0425/0426.
// "Apto" é projeção dos eventos; documentos exigidos e validade da vistoria só vêm de configuração (ausente ⇒ indeterminado).

export type VehicleEvent =
  | { kind: "capacidade"; seq: number; seats: number; accessibleSeats: number }
  | { kind: "documento"; seq: number; docKey: string; validUntil: string }
  | { kind: "vistoria"; seq: number; result: "aprovado" | "reprovado"; onDate: string }
  | { kind: "manutencao"; seq: number; onDate: string; serviceOrderId: string | null }
  | { kind: "disponibilidade"; seq: number; available: boolean; onDate: string };

export type FleetConfig = { requiredDocs: string[] | null; inspectionValidityDays: number | null };
export type Fitness = { status: "apto" | "inapto" | "indeterminado"; reasons: string[]; seats: number | null; accessibleSeats: number | null };

function addDays(d: string, n: number) { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }

export function vehicleFitness(events: VehicleEvent[], cfg: FleetConfig, on: string): Fitness {
  const ev = [...events].sort((a, b) => a.seq - b.seq);
  const last = <K extends VehicleEvent["kind"]>(k: K) => ev.filter((e) => e.kind === k).at(-1) as Extract<VehicleEvent, { kind: K }> | undefined;
  const hard: string[] = [], unknown: string[] = [];
  const cap = last("capacidade");
  if (!cap) unknown.push("capacidade-nao-informada");
  if (cfg.requiredDocs === null) unknown.push("documentos-exigidos-nao-configurados");
  else for (const k of cfg.requiredDocs) {
    const d = ev.filter((e): e is Extract<VehicleEvent, { kind: "documento" }> => e.kind === "documento" && e.docKey === k).at(-1);
    if (!d) hard.push(`documento-ausente:${k}`); else if (d.validUntil < on) hard.push(`documento-vencido:${k}`);
  }
  const insp = last("vistoria");
  if (!insp) hard.push("sem-vistoria");
  else if (insp.result === "reprovado") hard.push("vistoria-reprovada");
  else if (cfg.inspectionValidityDays === null) unknown.push("validade-da-vistoria-nao-configurada");
  else if (addDays(insp.onDate, cfg.inspectionValidityDays) < on) hard.push("vistoria-vencida");
  const av = last("disponibilidade");
  if (!av) unknown.push("disponibilidade-nao-informada"); else if (!av.available) hard.push("indisponivel");
  const status = hard.length ? "inapto" : unknown.length ? "indeterminado" : "apto";
  return { status, reasons: [...hard, ...unknown], seats: cap?.seats ?? null, accessibleSeats: cap?.accessibleSeats ?? null };
}

/** Capacidade útil para L17: só de veículo apto; caso contrário null (nunca a lotação nominal). */
export function usableCapacity(f: Fitness): number | null { return f.status === "apto" ? f.seats : null; }
