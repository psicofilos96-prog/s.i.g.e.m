/**
 * Lote 05 (Expansão) — Central Municipal de Vagas: núcleo puro sobre `secretariat_class_vacancies_at`.
 * Ocupação vem da leitura canônica; capacidade só configurada (ausente ⇒ "não calculável");
 * fila só por critérios versionados declarados; oferta só com saldo validado; nada grava.
 */

export type ClassSlot = Readonly<{ classId: string; schoolId: string; capacity: number | null; occupied: number | null; reserved: number }>;

export function available(s: ClassSlot): number | null {
  if (s.capacity == null || s.occupied == null) return null;
  return Math.max(0, s.capacity - s.occupied - s.reserved);
}

export type RequestState = "solicitada" | "protocolada" | "em-analise" | "ofertada" | "aceita" | "efetivada" | "recusada" | "desistencia" | "expirada";
const NEXT: Record<RequestState, readonly RequestState[]> = {
  solicitada: ["protocolada", "desistencia"], protocolada: ["em-analise", "desistencia"],
  "em-analise": ["ofertada", "recusada", "desistencia"], ofertada: ["aceita", "recusada", "expirada", "desistencia"],
  aceita: ["efetivada", "desistencia"], efetivada: [], recusada: [], desistencia: [], expirada: ["em-analise"],
};
export const canMove = (from: RequestState, to: RequestState) => NEXT[from].includes(to);

/** Critério oficial versionado: lista ordenada de chaves; sem versão homologada não há ordenação. */
export type Criteria = Readonly<{ version: number; homologated: boolean; keys: readonly string[] }>;
export type WaitItem = Readonly<{ requestId: string; studentRef: string; protocolAt: string; flags: Readonly<Record<string, boolean>> }>;

export function orderWaitlist(items: readonly WaitItem[], c: Criteria | null) {
  if (!c || !c.homologated) return { ok: false as const, reason: "criterio-nao-homologado" };
  const sorted = [...items].sort((a, b) => {
    for (const k of c.keys) { const d = Number(!!b.flags[k]) - Number(!!a.flags[k]); if (d) return d; }
    return a.protocolAt.localeCompare(b.protocolAt) || a.requestId.localeCompare(b.requestId);
  });
  return { ok: true as const, criteriaVersion: c.version, order: sorted.map((i) => i.requestId) };
}

/** Oferta só com saldo validado e sem matrícula/oferta vigente do mesmo estudante. */
export function canOffer(slot: ClassSlot, studentRef: string, activeByStudent: ReadonlySet<string>) {
  if (activeByStudent.has(studentRef)) return { ok: false as const, reason: "matricula-ou-oferta-vigente" };
  const a = available(slot);
  if (a == null) return { ok: false as const, reason: "capacidade-nao-configurada" };
  if (a < 1) return { ok: false as const, reason: "sem-vaga" };
  return { ok: true as const };
}

/** Concorrência: N ofertas simultâneas para a mesma turma só cabem até o saldo; as demais são recusadas em ordem. */
export function allocateConcurrent(slot: ClassSlot, requestIds: readonly string[]) {
  const a = available(slot) ?? 0;
  return { granted: requestIds.slice(0, a), refused: requestIds.slice(a) };
}

/** Projeção de demanda: só com hipótese explícita; resultado é estimativa, nunca vaga. */
export function projectDemand(base: number | null, hypothesis: { label: string; growthPct: number } | null) {
  if (base == null || !hypothesis) return { kind: "nao-projetavel" as const };
  return { kind: "estimativa" as const, hypothesis: hypothesis.label, value: Math.round(base * (1 + hypothesis.growthPct / 100)) };
}
