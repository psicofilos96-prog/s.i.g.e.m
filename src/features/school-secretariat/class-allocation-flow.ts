// Lote 04 Secretaria por unidade: consulta de turmas e prévia de enturmação (núcleo puro).
// Gravação real só pelos writers canônicos: secretariat_allocate_to_class,
// secretariat_reassign_class, secretariat_end_class_episode e record_allocation_curricular_position (B3.3).
// Nada sobrescreve alocação anterior: troca = término da antiga + nova alocação.

export interface ClassView { classId: string; schoolId: string; year: string; name: string; shift: string | null; capacity: number | null; occupancy: number | null; teachers: string[] | null }
export interface ClassSummary extends ClassView { vacancies: number | null; vacancyReason: string | null }

/** Vagas só com capacidade registrada e ocupação canônica lida; nunca presume. */
export function summarizeClasses(list: ClassView[], schoolId: string, year: string): ClassSummary[] {
  return list.filter((c) => c.schoolId === schoolId && c.year === year).map((c) => {
    if (c.capacity == null) return { ...c, vacancies: null, vacancyReason: "capacidade não registrada" };
    if (c.occupancy == null) return { ...c, vacancies: null, vacancyReason: "ocupação não lida" };
    return { ...c, vacancies: c.capacity - c.occupancy, vacancyReason: null };
  });
}

// Pedido de abertura/alteração: Secretaria só solicita sem a capacidade; decide quem a tem.
export type ClassRequestKind = "abertura" | "alteracao-turno" | "alteracao-capacidade" | "encerramento";
export const REQUEST_CAPABILITY: Record<ClassRequestKind, string> = {
  abertura: "manter-cadastro-de-turmas",
  "alteracao-turno": "manter-cadastro-de-turmas",
  "alteracao-capacidade": "manter-cadastro-de-turmas",
  encerramento: "manter-cadastro-de-turmas",
};
export function classRequestRoute(kind: ClassRequestKind, caps: Set<string>): "executar-no-writer" | "solicitar" {
  return caps.has(REQUEST_CAPABILITY[kind]) ? "executar-no-writer" : "solicitar";
}

// ---------- Enturmação ----------
export interface Allocation { allocationId: string; enrollmentId: string; classId: string; from: string; to: string | null }
export interface AllocationRequest { key: string; enrollmentId: string; classId: string; from: string | null; to: string | null }
export interface Context {
  enrollments: Map<string, { schoolId: string; year: string; active: boolean; opened: string | null }>;
  classes: Map<string, { schoolId: string; year: string; capacity: number | null; occupancy: number | null; validFrom: string; validTo: string | null }>;
  existing: Allocation[];
  coexistenceAllowed: boolean; // política declarada (ex.: AEE), nunca presumida
}
export type PreviewStatus = "pronto" | "recusado" | "duplicado";
export interface PreviewItem { key: string; status: PreviewStatus; reasons: string[]; endsPrevious: { allocationId: string; endOn: string } | null }

const overlaps = (aF: string, aT: string | null, bF: string, bT: string | null) => aF <= (bT ?? "9999-12-31") && bF <= (aT ?? "9999-12-31");
const dayBefore = (d: string) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

export function previewAllocation(reqs: AllocationRequest[], ctx: Context, mode: "nova" | "troca"): PreviewItem[] {
  const seen = new Set<string>();
  const extra = new Map<string, number>();
  return reqs.map((r) => {
    if (seen.has(r.enrollmentId)) return { key: r.key, status: "duplicado", reasons: ["matrícula repetida na prévia"], endsPrevious: null };
    seen.add(r.enrollmentId);
    const reasons: string[] = [];
    const e = ctx.enrollments.get(r.enrollmentId);
    const c = ctx.classes.get(r.classId);
    if (!e) reasons.push("matrícula não encontrada");
    else if (!e.active) reasons.push("matrícula não vigente");
    if (!c) reasons.push("turma não encontrada");
    if (e && c && (e.schoolId !== c.schoolId || e.year !== c.year)) reasons.push("turma de outra escola ou ano");
    if (!r.from) reasons.push("data de início não declarada");
    if (r.from && r.to && r.to < r.from) reasons.push("término antes do início");
    if (r.from && e?.opened && r.from < e.opened) reasons.push("início antes da matrícula");
    if (r.from && c && (r.from < c.validFrom || (c.validTo && r.from > c.validTo))) reasons.push("turma fora de vigência na data");
    if (c) {
      if (c.capacity == null || c.occupancy == null) reasons.push(c.capacity == null ? "capacidade não registrada" : "ocupação não lida");
      else {
        const used = c.occupancy + (extra.get(r.classId) ?? 0);
        if (used >= c.capacity) reasons.push("turma sem vaga");
      }
    }
    let endsPrevious: PreviewItem["endsPrevious"] = null;
    if (r.from) {
      const live = ctx.existing.filter((a) => a.enrollmentId === r.enrollmentId && overlaps(a.from, a.to, r.from!, r.to));
      if (live.some((a) => a.classId === r.classId)) reasons.push("já alocado nesta turma no período");
      const others = live.filter((a) => a.classId !== r.classId);
      if (mode === "troca") {
        if (others.length !== 1) reasons.push(others.length ? "mais de uma alocação vigente: escolha explícita" : "sem alocação vigente para trocar");
        else if (others[0]!.from >= r.from) reasons.push("troca anterior ao início da alocação vigente");
        else endsPrevious = { allocationId: others[0]!.allocationId, endOn: dayBefore(r.from) };
      } else if (others.length && !ctx.coexistenceAllowed) reasons.push("sobreposição com outra alocação");
    }
    if (reasons.length) return { key: r.key, status: "recusado", reasons, endsPrevious: null };
    extra.set(r.classId, (extra.get(r.classId) ?? 0) + 1);
    return { key: r.key, status: "pronto", reasons: [], endsPrevious };
  });
}

/** Histórico por matrícula: alocações nunca sobrescritas, ordenadas por início. */
export function allocationHistory(all: Allocation[], enrollmentId: string): Allocation[] {
  return all.filter((a) => a.enrollmentId === enrollmentId).sort((a, b) => a.from.localeCompare(b.from));
}
