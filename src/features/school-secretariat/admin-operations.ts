// SIGEM 2.0 — Lote 3/4: operações administrativas da Secretaria (núcleo puro).
// Reaproveita: busca ativa/infrequência (A&A `aa_infrequency_at`, `aa_outreach_*`), DP (`functional-life.ts`),
// numeração/tramitação de ofícios (`ged-core.ts`), notificações (`emit_notification_event`). Nada aqui grava.

// ---------- Diário de Corredor: visão administrativa derivada do Diário oficial ----------
export interface LessonAttendance { studentId: string; date: string; mark: "presente" | "ausente" | null; official: boolean }
export interface Justification { studentId: string; from: string; to: string; homologatedType: boolean }
export interface CorridorRow { studentId: string; lessons: number; absences: number; justified: number; unmarked: number; rate: number | null }

/** Só registros oficiais (chamada concluída); sem marcação nunca é falta; justificativa só de tipo homologado. */
export function corridorView(rows: LessonAttendance[], just: Justification[]): CorridorRow[] {
  const by = new Map<string, CorridorRow>();
  for (const r of rows) {
    if (!r.official) continue;
    const c = by.get(r.studentId) ?? { studentId: r.studentId, lessons: 0, absences: 0, justified: 0, unmarked: 0, rate: null };
    if (r.mark == null) c.unmarked++;
    else {
      c.lessons++;
      if (r.mark === "ausente") {
        const j = just.some((x) => x.studentId === r.studentId && x.homologatedType && x.from <= r.date && r.date <= x.to);
        if (j) c.justified++; else c.absences++;
      }
    }
    by.set(r.studentId, c);
  }
  for (const c of by.values()) c.rate = c.lessons > 0 ? (c.lessons - c.absences - c.justified) / c.lessons : null;
  return [...by.values()];
}

/** Faltosos só por limiar homologado; sem regra ⇒ null (lista não exibida). */
export function frequentAbsentees(view: CorridorRow[], rule: { minRate: number; homologated: boolean } | null): CorridorRow[] | null {
  if (!rule?.homologated) return null;
  return view.filter((c) => c.rate != null && c.rate < rule.minRate);
}

/** Bolsa Família: exportação só com leiaute oficial validado registrado (título + SHA-256). */
export function bolsaFamiliaExport(layout: { title: string; sha256: string; validated: boolean } | null): { ok: true } | { ok: false; code: string } {
  if (!layout) return { ok: false, code: "bf:layout-absent" };
  if (!layout.validated || !/^[0-9a-f]{64}$/.test(layout.sha256)) return { ok: false, code: "bf:layout-not-validated" };
  return { ok: true };
}

// ---------- Quadro de servidores: situação temporal ----------
export interface StaffRecord { personId: string | null; sourceSheet: string; referenceMonth: string; lotacao: string }
/** Planilha histórica (ago/set 2026) nunca vira situação atual: só lotação registrada com vigência na data. */
export function staffSituation(records: StaffRecord[], lotacoes: { personId: string; schoolId: string; from: string; to: string | null }[], on: string, schoolId: string) {
  const current = lotacoes.filter((l) => l.schoolId === schoolId && l.from <= on && (l.to == null || on <= l.to)).map((l) => l.personId);
  const historicalOnly = records.filter((r) => !r.personId || !current.includes(r.personId)).length;
  return { current: [...new Set(current)], historicalOnlyRows: historicalOnly, note: "planilha histórica = referência, não situação atual" };
}

/** Substituição: substituto pessoa distinta, intervalo dentro do afastamento registrado. */
export function validateSubstitution(leave: { personId: string; from: string; to: string } | null, sub: { personId: string; from: string; to: string }) {
  if (!leave) return { ok: false as const, code: "sub:leave-not-registered" };
  if (sub.personId === leave.personId) return { ok: false as const, code: "sub:same-person" };
  if (sub.from < leave.from || sub.to > leave.to || sub.from > sub.to) return { ok: false as const, code: "sub:outside-leave" };
  return { ok: true as const };
}

// ---------- Kits e materiais com recibo ----------
export interface KitDelivery { kitId: string; studentId: string; receivedBy: { personId: string; authorized: boolean } | null; at: string }
/** Recibo só com recebedor autorizado (responsável vigente ou o próprio estudante declarado); repetição é recusada. */
export function recordKitDelivery(prev: KitDelivery[], d: KitDelivery, stock: number | null) {
  if (stock == null) return { ok: false as const, code: "kit:stock-unknown" };
  if (stock <= 0) return { ok: false as const, code: "kit:out-of-stock" };
  if (!d.receivedBy?.authorized) return { ok: false as const, code: "kit:receiver-not-authorized" };
  if (prev.some((p) => p.kitId === d.kitId && p.studentId === d.studentId)) return { ok: false as const, code: "kit:already-delivered" };
  return { ok: true as const, value: [...prev, d], remaining: stock - 1 };
}

// ---------- Arquivo escolar digital ----------
export interface ArchiveItem { id: string; schoolId: string; taxonomy: string; reviewState: "pendente" | "revisado"; reviewer: string | null; uploader: string }
/** Taxonomia só da lista homologada; revisor ≠ quem enviou; leitura gera trilha, outra escola não lê. */
export function reviewArchiveItem(item: ArchiveItem, taxonomy: string[], reviewer: string) {
  if (!taxonomy.includes(item.taxonomy)) return { ok: false as const, code: "arq:taxonomy-unknown" };
  if (reviewer === item.uploader) return { ok: false as const, code: "arq:self-review" };
  return { ok: true as const, value: { ...item, reviewState: "revisado" as const, reviewer } };
}
export function accessArchive(item: ArchiveItem, viewer: { principalId: string; schoolIds: string[] }, at: string) {
  if (!viewer.schoolIds.includes(item.schoolId)) return { ok: false as const, code: "arq:not-in-scope" };
  return { ok: true as const, trail: { itemId: item.id, principalId: viewer.principalId, at } };
}
