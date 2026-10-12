/**
 * OP por escola — LOTE 02 (perfis e permissões).
 * Designação = ledger append-only: orientador→escola→período (opcionalmente turmas),
 * coordenação central→escopo (rede ou lista de escolas)→período; substituição dentro do período do titular.
 * Espelho de tela: a garantia continua no banco (writer DEFINER + school_followup_grant_on + RLS).
 */
export type OpRole = "orientador-da-unidade" | "coordenacao-central-op";
export interface OpDesignationEvent {
  id: string; logicalId: string; seq: number; kind: "designar" | "encerrar" | "substituir";
  role: OpRole; personId: string; engagementId: string;
  schoolIds: string[] | "rede"; classIds: string[] | null; from: string; to: string | null;
  substituteOf: string | null; reason: string | null; actorPersonId: string;
}
export interface OpDesignation {
  logicalId: string; role: OpRole; personId: string; schoolIds: string[] | "rede"; classIds: string[] | null;
  from: string; to: string | null; substituteOf: string | null; history: OpDesignationEvent[];
}

/** Projeção: cadeia por logicalId com seq contínuo; cadeia inválida é recusada inteira. */
export function projectOpDesignations(events: OpDesignationEvent[]): { list: OpDesignation[]; rejected: string[] } {
  const by = new Map<string, OpDesignationEvent[]>();
  for (const e of events) by.set(e.logicalId, [...(by.get(e.logicalId) ?? []), e]);
  const list: OpDesignation[] = []; const rejected: string[] = [];
  for (const [lid, ch] of by) {
    const s = [...ch].sort((a, b) => a.seq - b.seq);
    const ok = s.every((e, i) => e.seq === i + 1) && s[0]!.kind !== "encerrar"
      && s.every((e) => e.actorPersonId !== e.personId) // ninguém se autodesigna
      && s.slice(1).every((e) => e.kind === "encerrar" && e.to !== null && e.to >= s[0]!.from && !!e.reason?.trim());
    if (!ok) { rejected.push(lid); continue; }
    const head = s[0]!; const end = s.length > 1 ? s[s.length - 1]!.to : head.to;
    list.push({ logicalId: lid, role: head.role, personId: head.personId, schoolIds: head.schoolIds, classIds: head.classIds,
      from: head.from, to: end, substituteOf: head.substituteOf, history: s });
  }
  // substituição precisa caber no período do titular e na mesma escola/papel
  return {
    list: list.filter((d) => {
      if (!d.substituteOf) return true;
      const h = list.find((x) => x.logicalId === d.substituteOf);
      const fits = !!h && h.role === d.role && JSON.stringify(h.schoolIds) === JSON.stringify(d.schoolIds)
        && d.from >= h.from && (h.to === null || (d.to !== null && d.to <= h.to));
      if (!fits) rejected.push(d.logicalId);
      return fits;
    }),
    rejected,
  };
}

const live = (d: OpDesignation, date: string) => d.from <= date && (d.to === null || date <= d.to);
const covers = (d: OpDesignation, school: string) => d.schoolIds === "rede" || d.schoolIds.includes(school);

export type Granularity = "individual" | "agregado";
export interface OpAccessRequest {
  personNatural: boolean; personId: string; date: string; schoolId: string; classId: string | null;
  granularity: Granularity; action: "consultar" | "registrar"; purpose: string | null;
  designations: OpDesignation[];
  /** capacidades efetivas lidas do banco (effective_capabilities); nunca derivadas do cargo */
  capabilities: { id: string; scope: "escola" | "rede"; schoolId: string | null }[];
}
export const CENTRAL_INDIVIDUAL_CAP = "consultar-acompanhamento-pedagogico";
export const PURPOSES = ["acompanhamento", "intervencao", "conselho", "formacao"] as const;

export function decideOpAccess(r: OpAccessRequest): { ok: boolean; via: OpRole | null; reason: string } {
  const no = (reason: string) => ({ ok: false, via: null, reason });
  if (!r.personNatural) return no("Executor técnico não pratica ato pedagógico.");
  if (!r.purpose || !(PURPOSES as readonly string[]).includes(r.purpose)) return no("Finalidade não declarada.");
  const mine = r.designations.filter((d) => d.personId === r.personId && live(d, r.date) && covers(d, r.schoolId));
  const unit = mine.find((d) => d.role === "orientador-da-unidade" && (d.classIds === null || (r.classId !== null && d.classIds.includes(r.classId)) || r.classId === null && r.granularity === "agregado"));
  if (unit) {
    const cap = r.action === "registrar" ? "registrar-acompanhamento-pedagogico" : "consultar-acompanhamento-pedagogico";
    if (!r.capabilities.some((c) => c.id === cap && c.scope === "escola" && c.schoolId === r.schoolId)) return no("Designação sem capacidade homologada na escola.");
    return { ok: true, via: "orientador-da-unidade", reason: "" };
  }
  const central = mine.find((d) => d.role === "coordenacao-central-op");
  if (central) {
    if (r.action === "registrar") return no("Coordenação central não registra pela unidade.");
    if (r.granularity === "agregado") return { ok: true, via: "coordenacao-central-op", reason: "" };
    if (!r.capabilities.some((c) => c.id === CENTRAL_INDIVIDUAL_CAP && c.scope === "rede")) return no("Dado individual exige competência de rede homologada.");
    if (r.purpose === "formacao") return no("Formação não justifica dado individual.");
    return { ok: true, via: "coordenacao-central-op", reason: "" };
  }
  return no("Sem designação vigente para esta escola, turma e data.");
}

/** Agregado da central: só contagens, com supressão de 1–4 (nunca permite reidentificar). */
export function aggregateForCentral(counts: Record<string, number | null>): Record<string, number | "suprimido" | "não disponível"> {
  const out: Record<string, number | "suprimido" | "não disponível"> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = v === null ? "não disponível" : v > 0 && v < 5 ? "suprimido" : v;
  return out;
}
