// SIGEM 2.0 — Direção, Lote 03: consulta gerencial de estudantes/turmas/vagas e SOLICITAÇÕES ao setor competente (núcleo puro).
// Só lê projeções dos readers canônicos (identidade, matrícula, alocação, posição B3.3, autorização de responsável);
// nunca grava fato da Secretaria; solicitação é pedido com decisão de quem tem a capacidade do writer canônico.

export interface StudentFacts {
  studentId: string; name: string; birthDate: string | null;
  enrollment: { schoolId: string; openedOn: string | null; endedOn: string | null } | null;
  allocation: { classId: string; from: string; to: string | null } | null;
  position: { schemaKey: string; value: string } | null; // posição curricular individual (B3.3), nunca a da turma
  guardians: { personId: string; sections: string[]; validTo: string | null; revokedOn: string | null }[];
  transfers: { on: string; kind: string }[];
  standing: string | null; // situação acadêmica oficial (register_academic_standings)
}

/** Ficha gerencial: escola da matrícula ≠ escola da Direção ⇒ nada; ausências explícitas; só responsáveis vigentes. */
export function studentView(f: StudentFacts, schoolId: string, on: string) {
  if (f.enrollment?.schoolId !== schoolId) return { ok: false as const, code: "direcao:fora-da-escola" };
  const nr = "não registrado";
  return { ok: true as const, view: {
    studentId: f.studentId, name: f.name,
    matricula: { inicio: f.enrollment.openedOn ?? "início não declarado", fim: f.enrollment.endedOn },
    turma: f.allocation && f.allocation.from <= on && (!f.allocation.to || on <= f.allocation.to) ? f.allocation.classId : "sem turma vigente",
    posicao: f.position ? `${f.position.schemaKey}:${f.position.value}` : nr,
    responsaveis: f.guardians.filter((g) => (g.validTo == null || on <= g.validTo) && (g.revokedOn == null || on < g.revokedOn)).map((g) => g.personId),
    transferencias: f.transfers, situacao: f.standing ?? nr } };
}

/** Distorção idade-ano: só com nascimento, posição individual, data de referência e idade esperada por regra homologada. */
export function ageGradeDistortion(f: StudentFacts, rule: { referenceDate: string; expectedAge: Record<string, number>; gapYears: number } | null) {
  if (!rule) return { state: "indeterminado" as const, reason: "regra de distorção não homologada" };
  if (!f.birthDate) return { state: "indeterminado" as const, reason: "nascimento não registrado" };
  if (!f.position) return { state: "indeterminado" as const, reason: "posição curricular individual não registrada" };
  const exp = rule.expectedAge[`${f.position.schemaKey}:${f.position.value}`];
  if (exp == null) return { state: "indeterminado" as const, reason: "posição sem idade esperada na regra" };
  const [ry, rm, rd] = rule.referenceDate.split("-").map(Number); const [by, bm, bd] = f.birthDate.split("-").map(Number);
  const age = ry! - by! - (rm! < bm! || (rm === bm && rd! < bd!) ? 1 : 0);
  return { state: age - exp >= rule.gapYears ? ("distorcao" as const) : ("adequado" as const), age };
}

/** Painel por dimensão: agrupa só valores declarados; ausente vira grupo "não registrado", nunca some. */
export function panelBy<T>(rows: T[], key: (r: T) => string | null) {
  const out: Record<string, number> = {};
  for (const r of rows) { const k = key(r) ?? "não registrado"; out[k] = (out[k] ?? 0) + 1; }
  return out;
}

/** Lotação/vaga: saldo só com capacidade registrada; demanda vem da fila real, nunca estimada. */
export function vacancy(c: { capacity: number | null; occupied: number | null; queued: number | null }) {
  if (c.capacity == null || c.occupied == null) return { saldo: null, note: "não calculável (capacidade ou ocupação ausente)", demanda: c.queued };
  return { saldo: c.capacity - c.occupied, note: null, demanda: c.queued };
}

// ── Solicitações ao setor competente ──
export type RequestKind = "abrir-turma" | "encerrar-turma" | "reorganizar" | "mudar-turno" | "redistribuir-estudantes" | "ajuste-docente";
export const COMPETENT: Record<RequestKind, { capability: string; writer: string }> = {
  "abrir-turma": { capability: "manter-cadastro-de-turmas", writer: "secretariat_create_class" },
  "encerrar-turma": { capability: "manter-cadastro-de-turmas", writer: "record_institutional_class_version" },
  reorganizar: { capability: "manter-cadastro-de-turmas", writer: "record_class_composition_version" },
  "mudar-turno": { capability: "manter-turno-da-turma", writer: "record_class_shift_version" },
  "redistribuir-estudantes": { capability: "enturmar-estudantes", writer: "secretariat_reassign_class" },
  "ajuste-docente": { capability: "atribuir-docente", writer: "teaching assignment writer" },
};

export interface ClassRequest { id: string; kind: RequestKind; schoolId: string; requestedBy: string; reason: string;
  events: { type: "deferido" | "indeferido" | "executado"; by: string; capabilities: string[]; reason?: string; writerRef?: string }[] }

export function openClassRequest(r: Omit<ClassRequest, "events">, requesterCanRequest: boolean) {
  if (!requesterCanRequest) return { ok: false as const, code: "direcao:sem-capacidade-de-solicitar" };
  if (!r.reason.trim()) return { ok: false as const, code: "direcao:motivo-obrigatorio" };
  return { ok: true as const, request: { ...r, events: [] } as ClassRequest };
}

/** Decisão só por quem tem a capacidade do setor; solicitante não decide o próprio pedido; "executado" exige referência ao writer. */
export function decideClassRequest(r: ClassRequest, ev: ClassRequest["events"][number]) {
  const need = COMPETENT[r.kind].capability;
  if (!ev.capabilities.includes(need)) return { ok: false as const, code: "direcao:setor-nao-competente" };
  if (ev.by === r.requestedBy) return { ok: false as const, code: "direcao:autodecisao" };
  if (ev.type === "indeferido" && !ev.reason?.trim()) return { ok: false as const, code: "direcao:motivo-obrigatorio" };
  if (ev.type === "executado" && (!ev.writerRef || !r.events.some((e) => e.type === "deferido"))) return { ok: false as const, code: "direcao:execucao-sem-ato" };
  if (r.events.some((e) => e.type === "indeferido" || e.type === "executado")) return { ok: false as const, code: "direcao:pedido-encerrado" };
  return { ok: true as const, request: { ...r, events: [...r.events, ev] } };
}
