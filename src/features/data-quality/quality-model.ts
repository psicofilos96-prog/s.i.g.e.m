/**
 * Central de Qualidade e Consistência dos Dados — motor separado das regras de negócio.
 * Detecções são projeções puras sobre o que os readers canônicos devolveram; nada é corrigido aqui.
 * Entrada `null` = fonte não lida ⇒ a regra fica "não verificável", nunca gera achado (sem falso positivo).
 */

export type Severity = "informativa" | "atencao" | "bloqueante";
export type ReviewState = "aberto" | "revisado" | "dispensado" | "resolvido";
export type Sector = "secretaria" | "pedagogico" | "rede" | "documentos" | "importacao";
export type Evidence = Readonly<Record<string, string | number | boolean | null>>;

export type QualityRule = Readonly<{
  id: string; version: number; label: string; sector: Sector; explain: string;
  /** Tela do writer canônico onde o fato é corrigido. */
  fix: (e: Evidence) => string;
}>;

export type Finding = Readonly<{
  ruleId: string; ruleVersion: number; entityKind: string; entityId: string;
  schoolId: string | null; evidence: Evidence; detectedAt: string; fingerprint: string;
}>;

const s = (v: unknown) => String(v ?? "");

export const QUALITY_RULES: readonly QualityRule[] = [
  { id: "matricula-concorrente", version: 1, label: "Matrículas concorrentes incompatíveis", sector: "secretaria",
    explain: "O mesmo estudante tem duas matrículas de ciclo vigentes na mesma data.", fix: () => "/matriculas" },
  { id: "alocacao-sem-participacao", version: 1, label: "Alocação sem participação vigente", sector: "secretaria",
    explain: "A alocação em turma existe, mas não há participação vigente que a sustente.", fix: () => "/enturmacoes" },
  { id: "posicao-sem-correspondencia", version: 1, label: "Posição sem correspondência exigida", sector: "pedagogico",
    explain: "O perfil homologado exige correspondência para esta posição e nenhuma foi resolvida.", fix: () => "/matrizes-curriculares/correspondencia" },
  { id: "turma-sem-matriz", version: 1, label: "Turma sem matriz aplicável", sector: "pedagogico",
    explain: "A turma registrada não tem exatamente uma matriz aplicável na data.", fix: () => "/matrizes-curriculares/correspondencia" },
  { id: "grade-sem-jornada", version: 1, label: "Grade sem jornada", sector: "pedagogico",
    explain: "Existe grade vigente, mas a jornada da qual ela depende não está vigente.", fix: (e) => `/horarios/turmas/${s(e["classId"])}` },
  { id: "regencia-sem-componente", version: 1, label: "Regência sem componente aplicável", sector: "pedagogico",
    explain: "A regência aponta para um item que não pertence à matriz aplicável da turma.", fix: (e) => `/turmas/${s(e["classId"])}` },
  { id: "calendario-ausente", version: 1, label: "Calendário aplicável ausente ou múltiplo", sector: "rede",
    explain: "A escola tem turmas registradas e não há exatamente um calendário aplicável.", fix: () => "/calendario-escolar" },
  { id: "atuacao-expirada-em-fato-novo", version: 1, label: "Atuação encerrada usada por fato novo", sector: "rede",
    explain: "Um fato passou a valer depois do fim da atuação que o sustenta.", fix: () => "/administracao" },
  { id: "documento-de-fato-retificado", version: 1, label: "Documento emitido sobre fato retificado", sector: "documentos",
    explain: "O fato de origem ganhou versão posterior à emissão. O documento continua válido como foi emitido; avalie retificá-lo.", fix: () => "/documentos-escolares" },
  { id: "importacao-com-divergencia", version: 1, label: "Importação com divergência não resolvida", sector: "importacao",
    explain: "O lote tem linhas em conflito e não foi aplicado nem descartado.", fix: () => "/importacoes" },
];
export const ruleById = (id: string) => QUALITY_RULES.find((r) => r.id === id);

/** Severidade só existe quando configurada; ausente = "não configurada". */
export type SeverityConfig = Readonly<Record<string, Severity>>;
export const SEVERITY_UNCONFIGURED: SeverityConfig = Object.freeze({});
export const severityOf = (cfg: SeverityConfig, ruleId: string): Severity | null => cfg[ruleId] ?? null;

export type ClassInput = Readonly<{
  classId: string; record: boolean | null; matrix: "resolvida" | "ambigua" | "ausente" | null;
  journey: boolean | null; schedule: boolean | null;
}>;
export type QualityInputs = Readonly<{
  schoolId: string; validOn: string;
  classes: readonly ClassInput[] | null;
  calendars: number | null;
  enrollments: readonly { enrollmentId: string; studentId: string; validFrom: string; validUntil: string | null }[] | null;
  allocations: readonly { allocationId: string; studentId: string; participationActive: boolean | null }[] | null;
  positions: readonly { allocationId: string; positionKey: string; correspondenceRequired: boolean | null; correspondenceResolved: boolean | null }[] | null;
  assignments: readonly { assignmentId: string; classId: string; componentApplicable: boolean | null }[] | null;
  engagementFacts: readonly { factKind: string; factId: string; engagementId: string; factValidFrom: string; engagementValidUntil: string | null }[] | null;
  documents: readonly { emissionId: string; sourceKind: string; sourceId: string; versionAtEmission: number; currentVersion: number | null }[] | null;
  imports: readonly { batchId: string; conflictRows: number; closed: boolean }[] | null;
}>;

export const fingerprintOf = (ruleId: string, ruleVersion: number, entityKind: string, entityId: string) =>
  `${ruleId}:v${ruleVersion}:${entityKind}:${entityId}`.toLowerCase().replace(/[^a-z0-9:._/-]/g, "-");

const overlaps = (a: { validFrom: string; validUntil: string | null }, b: { validFrom: string; validUntil: string | null }) =>
  a.validFrom <= (b.validUntil ?? "9999-12-31") && b.validFrom <= (a.validUntil ?? "9999-12-31");

export type Detection = Readonly<{ findings: Finding[]; unverifiable: string[] }>;

export function detect(i: QualityInputs, detectedAt: string): Detection {
  const out: Finding[] = []; const unverifiable = new Set<string>();
  const add = (ruleId: string, entityKind: string, entityId: string, evidence: Evidence) => {
    const r = ruleById(ruleId)!;
    out.push({ ruleId, ruleVersion: r.version, entityKind, entityId, schoolId: i.schoolId, evidence, detectedAt,
      fingerprint: fingerprintOf(ruleId, r.version, entityKind, entityId) });
  };
  const need = <T,>(ruleIds: string[], v: T | null): v is T => { if (v == null) ruleIds.forEach((r) => unverifiable.add(r)); return v != null; };

  if (need(["turma-sem-matriz", "grade-sem-jornada"], i.classes)) for (const c of i.classes) {
    if (c.record !== true) continue; // turma não registrada na data não exige nada
    if (c.matrix == null) unverifiable.add("turma-sem-matriz");
    else if (c.matrix !== "resolvida") add("turma-sem-matriz", "turma", c.classId, { classId: c.classId, matriz: c.matrix });
    if (c.schedule == null || (c.schedule && c.journey == null)) unverifiable.add("grade-sem-jornada");
    else if (c.schedule && c.journey === false) add("grade-sem-jornada", "turma", c.classId, { classId: c.classId });
  }
  if (i.classes == null || i.calendars == null) unverifiable.add("calendario-ausente");
  else if (i.classes.some((c) => c.record === true) && i.calendars !== 1)
    add("calendario-ausente", "escola", i.schoolId, { calendariosAplicaveis: i.calendars, data: i.validOn });

  if (need(["matricula-concorrente"], i.enrollments)) {
    const byStudent = new Map<string, typeof i.enrollments[number][]>();
    for (const e of i.enrollments) byStudent.set(e.studentId, [...(byStudent.get(e.studentId) ?? []), e]);
    for (const [, es] of byStudent) {
      const ids = new Set(es.map((e) => e.enrollmentId));
      const list = [...ids].map((id) => es.find((e) => e.enrollmentId === id)!).sort((a, b) => a.enrollmentId.localeCompare(b.enrollmentId));
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++)
        if (overlaps(list[a]!, list[b]!)) add("matricula-concorrente", "par-de-matriculas", `${list[a]!.enrollmentId}+${list[b]!.enrollmentId}`,
          { matriculaA: list[a]!.enrollmentId, matriculaB: list[b]!.enrollmentId });
    }
  }
  if (need(["alocacao-sem-participacao"], i.allocations)) for (const a of i.allocations) {
    if (a.participationActive == null) unverifiable.add("alocacao-sem-participacao");
    else if (!a.participationActive) add("alocacao-sem-participacao", "alocacao", a.allocationId, { alocacao: a.allocationId });
  }
  if (need(["posicao-sem-correspondencia"], i.positions)) for (const p of i.positions) {
    if (p.correspondenceRequired !== true) continue; // só quando a norma homologada exige
    if (p.correspondenceResolved == null) unverifiable.add("posicao-sem-correspondencia");
    else if (!p.correspondenceResolved) add("posicao-sem-correspondencia", "alocacao", p.allocationId, { alocacao: p.allocationId, posicao: p.positionKey });
  }
  if (need(["regencia-sem-componente"], i.assignments)) for (const a of i.assignments) {
    if (a.componentApplicable == null) unverifiable.add("regencia-sem-componente");
    else if (!a.componentApplicable) add("regencia-sem-componente", "regencia", a.assignmentId, { classId: a.classId, regencia: a.assignmentId });
  }
  if (need(["atuacao-expirada-em-fato-novo"], i.engagementFacts)) for (const f of i.engagementFacts)
    if (f.engagementValidUntil != null && f.factValidFrom > f.engagementValidUntil)
      add("atuacao-expirada-em-fato-novo", f.factKind, f.factId, { atuacao: f.engagementId, fimDaAtuacao: f.engagementValidUntil, inicioDoFato: f.factValidFrom });
  if (need(["documento-de-fato-retificado"], i.documents)) for (const d of i.documents) {
    if (d.currentVersion == null) unverifiable.add("documento-de-fato-retificado");
    else if (d.currentVersion > d.versionAtEmission)
      add("documento-de-fato-retificado", "emissao", d.emissionId, { origem: `${d.sourceKind}:${d.sourceId}`, versaoNaEmissao: d.versionAtEmission, versaoAtual: d.currentVersion });
  }
  if (need(["importacao-com-divergencia"], i.imports)) for (const b of i.imports)
    if (!b.closed && b.conflictRows > 0) add("importacao-com-divergencia", "lote", b.batchId, { lote: b.batchId, linhasEmConflito: b.conflictRows });

  // Deduplicação: mesma regra+entidade gera um único achado.
  const seen = new Map<string, Finding>(); for (const f of out) if (!seen.has(f.fingerprint)) seen.set(f.fingerprint, f);
  return { findings: [...seen.values()], unverifiable: [...unverifiable].filter((r) => ![...seen.values()].some((f) => f.ruleId === r) || true) };
}

/** Evidência canônica (chaves ordenadas) para vincular a revisão ao que foi visto. */
export const canonicalEvidence = (e: Evidence) => JSON.stringify(Object.keys(e).sort().map((k) => [k, e[k]]));
export async function evidenceHash(e: Evidence): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalEvidence(e)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type ReviewEvent = Readonly<{
  id: string; fingerprint: string; evidenceSha256: string; ruleId: string; ruleVersion: number;
  schoolId: string | null; state: "revisado" | "dispensado" | "reaberto"; reason: string; supersedesId: string | null; recordedAt: string;
}>;

/** Cabeça da cadeia de revisões de um achado (última sem sucessora). */
export function reviewHead(events: readonly ReviewEvent[], fingerprint: string): ReviewEvent | null {
  const mine = events.filter((e) => e.fingerprint === fingerprint);
  const superseded = new Set(mine.map((e) => e.supersedesId).filter(Boolean));
  const heads = mine.filter((e) => !superseded.has(e.id));
  return heads.length === 1 ? heads[0]! : heads.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null;
}

export type InboxItem = Readonly<{ finding: Finding | null; fingerprint: string; ruleId: string; schoolId: string | null; state: ReviewState; head: ReviewEvent | null; evidenceChanged: boolean }>;

/**
 * Estado é derivado, nunca gravado: detectado sem revisão ⇒ aberto; revisão vale só para a MESMA evidência
 * (evidência nova reabre); não detectado mais com histórico ⇒ resolvido (o fato foi corrigido na fonte).
 */
export function inbox(findings: readonly Finding[], hashes: ReadonlyMap<string, string>, events: readonly ReviewEvent[]): InboxItem[] {
  const items: InboxItem[] = [];
  for (const f of findings) {
    const head = reviewHead(events, f.fingerprint);
    const changed = !!head && head.evidenceSha256 !== hashes.get(f.fingerprint);
    const state: ReviewState = !head || changed || head.state === "reaberto" ? "aberto" : head.state;
    items.push({ finding: f, fingerprint: f.fingerprint, ruleId: f.ruleId, schoolId: f.schoolId, state, head, evidenceChanged: changed });
  }
  const live = new Set(findings.map((f) => f.fingerprint));
  for (const fp of new Set(events.map((e) => e.fingerprint))) if (!live.has(fp)) {
    const head = reviewHead(events, fp)!;
    items.push({ finding: null, fingerprint: fp, ruleId: head.ruleId, schoolId: head.schoolId, state: "resolvido", head, evidenceChanged: false });
  }
  return items;
}

export type InboxFilter = Readonly<{ sector?: Sector | null; states?: readonly ReviewState[]; ruleId?: string | null }>;
export const filterInbox = (items: readonly InboxItem[], f: InboxFilter) => items.filter((i) =>
  (!f.sector || ruleById(i.ruleId)?.sector === f.sector) && (!f.states?.length || f.states.includes(i.state)) && (!f.ruleId || i.ruleId === f.ruleId));
