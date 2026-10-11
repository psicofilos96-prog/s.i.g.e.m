// Secretaria Escolar — Lotes 8, 10, 11 e 12 (núcleo puro). L9 já vive em year-closing-wizard.ts.
// Nada grava, nada corrige: só decide, projeta e sinaliza sobre leituras canônicas.

// ---------- L8: regimes de oferta ----------
/** Regime vem de configuração homologada da oferta, nunca do nome da etapa. */
export interface OfferRegime { offerId: string; homologated: boolean; terminalStandings: boolean; periodicity: "anual" | "semestral" | null; matrixVersionId: string | null }

export function regimeChecks(r: OfferRegime | null, intent: { standing: string | null; periodId: string | null; periods: string[] }) {
  const problems: string[] = [];
  if (!r || !r.homologated) return ["regime da oferta não homologado"];
  // Educação Infantil e similares: sem situação terminal (sem promoção/reprovação)
  if (!r.terminalStandings && intent.standing) problems.push("oferta sem promoção/reprovação: situação terminal não se aplica");
  if (r.periodicity == null) problems.push("periodicidade não declarada");
  if (r.periodicity === "semestral" && (!intent.periodId || !intent.periods.includes(intent.periodId))) problems.push("período semestral não informado ou fora do calendário");
  if (!r.matrixVersionId) problems.push("matriz histórica não vinculada");
  return problems;
}

// ---------- L10: pré-validação Educacenso / GPE ----------
export interface ExternalLayout { system: "educacenso" | "gpe"; referenceYear: string; documentSha256: string | null; officialBlockers: string[] }
export type ExportState = { state: "bloqueado"; reasons: string[] } | { state: "conferencia"; note: string };

/** Só arquivo de conferência; transmissão externa nunca é simulada. */
export function preValidate(layout: ExternalLayout | null, year: string, inepPresent: boolean, ibgePresent: boolean): ExportState {
  const r: string[] = [];
  if (!layout) r.push("leiaute real não registrado");
  else {
    if (layout.referenceYear !== year) r.push("leiaute de outro ano de referência");
    if (!layout.documentSha256) r.push("documento oficial do leiaute ausente");
    r.push(...layout.officialBlockers);
  }
  if (!inepPresent) r.push("código INEP ausente");
  if (!ibgePresent) r.push("código IBGE do município ausente");
  if (layout?.system === "gpe") r.push("GPE sem contrato de integração");
  return r.length ? { state: "bloqueado", reasons: r } : { state: "conferencia", note: "arquivo para conferência; envio é ato externo da escola" };
}

// ---------- L11: guarda documental física e digital ----------
export interface CustodyEvent { seq: number; itemId: string; kind: "guarda" | "retirada" | "devolucao" | "transferencia-guarda"; location: string | null; principalId: string; human: boolean; reason: string | null; at: string }
export function custodyAppend(events: CustodyEvent[], ev: Omit<CustodyEvent, "seq">, expectedSeq: number) {
  const mine = events.filter((e) => e.itemId === ev.itemId);
  const head = mine.at(-1);
  if ((head?.seq ?? 0) !== expectedSeq) return { ok: false as const, code: "stale-base" };
  if (!ev.human) return { ok: false as const, code: "human-author-required" };
  if (ev.kind !== "devolucao" && ev.kind !== "retirada" && !ev.location?.trim()) return { ok: false as const, code: "location-required" };
  if (ev.kind === "retirada" && !ev.reason?.trim()) return { ok: false as const, code: "reason-required" };
  if (ev.kind === "devolucao" && head?.kind !== "retirada") return { ok: false as const, code: "not-withdrawn" };
  if (ev.kind === "retirada" && head?.kind === "retirada") return { ok: false as const, code: "already-withdrawn" };
  return { ok: true as const, value: [...events, { ...ev, seq: expectedSeq + 1 }] };
}
/** Localização atual = último local de guarda; retirado mostra quem retirou. */
export function currentLocation(events: CustodyEvent[], itemId: string) {
  const mine = events.filter((e) => e.itemId === itemId);
  const last = mine.at(-1);
  if (!last) return { location: null, withdrawnBy: null, reason: "sem registro de guarda" };
  const place = [...mine].reverse().find((e) => e.location)?.location ?? null;
  return { location: place, withdrawnBy: last.kind === "retirada" ? last.principalId : null, reason: null };
}

// ---------- L12: Auditor de Regularidade Escolar ----------
export interface RegularityInput {
  studentId: string; schoolId: string;
  enrollmentActive: boolean; enrollmentStart: string | null; allocated: boolean | null;
  positionDeclared: boolean | null; identityDocs: boolean | null; guardianActive: boolean | null;
  exitWithoutDestination: boolean | null; standingBeforeClosing: boolean | null;
}
export interface Finding { studentId: string; code: string; label: string; source: string; fixedBy: string; autoFix: false }
const F = (s: string, code: string, label: string, source: string, fixedBy: string): Finding => ({ studentId: s, code, label, source, fixedBy, autoFix: false });

/** Só sinaliza: valor null é "não verificável" (não achado); nenhum achado corrige nada. */
export function regularityAudit(rows: RegularityInput[], schoolId: string) {
  const findings: Finding[] = [];
  const unverifiable: { studentId: string; check: string }[] = [];
  const chk = (r: RegularityInput, v: boolean | null, bad: boolean, ...f: [string, string, string, string]) => {
    if (v === null) unverifiable.push({ studentId: r.studentId, check: f[0] });
    else if (v === bad) findings.push(F(r.studentId, ...f));
  };
  for (const r of rows.filter((x) => x.schoolId === schoolId && x.enrollmentActive)) {
    if (!r.enrollmentStart) findings.push(F(r.studentId, "inicio-ausente", "matrícula sem início declarado", "matrícula", "secretariat_declare_enrollment_start"));
    chk(r, r.allocated, false, "sem-enturmacao", "matrícula ativa sem enturmação", "alocação", "secretariat_allocate_to_class");
    chk(r, r.positionDeclared, false, "posicao-ausente", "sem etapa/ano individual", "posição curricular", "record_allocation_curricular_position");
    chk(r, r.identityDocs, false, "documento-identidade", "documento de identidade pendente", "cadastro", "ficha do estudante");
    chk(r, r.guardianActive, false, "sem-responsavel", "sem responsável vigente", "responsáveis", "ficha do estudante");
    chk(r, r.exitWithoutDestination, true, "saida-sem-destino", "saída sem destino declarado", "movimentação", "secretariat_record_exit");
    chk(r, r.standingBeforeClosing, true, "situacao-antes-fechamento", "situação registrada antes do fechamento", "fechamento", "rito de retificação");
  }
  return { findings, unverifiable };
}

/** Indicador com fonte e fórmula; denominador zero ou fonte não lida = sem valor. */
export function indicator(key: string, formula: string, source: string, num: number | null, den: number | null) {
  return { key, formula, source, value: num == null || den == null || den === 0 ? null : num / den, reason: den === 0 ? "denominador zero" : num == null || den == null ? "fonte não lida" : null };
}
