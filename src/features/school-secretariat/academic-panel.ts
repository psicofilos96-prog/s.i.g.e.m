// Lote 02 Secretaria por unidade: painel, busca autorizada, ficha única e linha do tempo.
// Projeção pura sobre linhas já lidas pelos readers canônicos com a sessão (RLS);
// nada grava, nada mescla, ausência nunca vira zero.

export type BlockState = "AVAILABLE" | "ZERO" | "UNKNOWN" | "UNAVAILABLE";
export interface Origin { source: string; knownAt: string | null }
export interface Block { key: string; label: string; state: BlockState; value: number | null; reason: string | null; origin: Origin; drill: string[] }

export interface SourceRead<T> { status: "read" | "denied" | "not-read"; rows: T[]; knownAt: string | null; source: string }

export interface PanelScope { schoolId: string; year: string; period: string | null }

export interface Row { id: string; schoolId: string; year: string; period?: string | null }

function block<T extends Row>(key: string, label: string, scope: PanelScope, src: SourceRead<T>, pred: (r: T) => boolean = () => true): Block {
  const origin = { source: src.source, knownAt: src.knownAt };
  if (src.status === "denied") return { key, label, state: "UNAVAILABLE", value: null, reason: "sem permissão para esta fonte", origin, drill: [] };
  if (src.status === "not-read") return { key, label, state: "UNKNOWN", value: null, reason: "fonte não lida", origin, drill: [] };
  const rows = src.rows.filter((r) => r.schoolId === scope.schoolId && r.year === scope.year && (scope.period == null || r.period == null || r.period === scope.period) && pred(r));
  return { key, label, state: rows.length ? "AVAILABLE" : "ZERO", value: rows.length, reason: null, origin, drill: rows.map((r) => r.id) };
}

export interface EnrollmentRow extends Row { active: boolean; allocated: boolean | null }
export interface PanelSources {
  enrollments: SourceRead<EnrollmentRow>;
  classes: SourceRead<Row>;
  pendencies: SourceRead<Row>;
  transfers: SourceRead<Row>;
  documents: SourceRead<Row>;
  requests: SourceRead<Row>;
  closing: SourceRead<Row & { closed: boolean }>;
  inconsistencies: SourceRead<Row>;
}

export function buildSecretariatPanel(scope: PanelScope, s: PanelSources): Block[] {
  return [
    block("matriculas-ativas", "Matrículas ativas", scope, s.enrollments, (r) => r.active),
    block("turmas", "Turmas", scope, s.classes),
    // enturmação desconhecida (null) não conta como "sem enturmação"
    block("sem-enturmacao", "Sem enturmação", scope, s.enrollments, (r) => r.active && r.allocated === false),
    block("pendencias", "Pendências", scope, s.pendencies),
    block("transferencias", "Transferências", scope, s.transfers),
    block("documentos", "Documentos emitidos", scope, s.documents),
    block("solicitacoes", "Solicitações", scope, s.requests),
    block("fechamento-pendente", "Fechamentos pendentes", scope, s.closing, (r) => !r.closed),
    block("inconsistencias", "Inconsistências", scope, s.inconsistencies),
  ];
}

// ---------- Busca universal autorizada ----------
export interface SearchHit { kind: "estudante" | "turma" | "documento" | "protocolo"; id: string; schoolId: string; label: string; officialId?: string | null }
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Filtra só linhas já autorizadas pelo banco; identificador oficial só por igualdade exata. */
export function secretariatSearch(hits: SearchHit[], schoolId: string, query: string): SearchHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  return hits.filter((h) => h.schoolId === schoolId && ((h.officialId != null && h.officialId === query.trim()) || words.every((w) => norm(h.label).includes(w))));
}

// ---------- Ficha única ----------
export interface IdentityVersion { validFrom: string; recordedAt: string; civilName: string; socialName: string | null; reason: string | null }
export interface Guardian { personId: string; name: string; relation: string; from: string; to: string | null }
export interface Link { kind: "matricula" | "participacao" | "alocacao"; id: string; schoolId: string; from: string | null; to: string | null; label: string }
export interface DocumentRec { id: string; kind: string; issuedAt: string; code: string }

export interface StudentRecord { studentId: string; displayName: string; civilName: string; socialName: string | null; identityHistory: IdentityVersion[]; guardians: Guardian[]; links: Link[]; documents: DocumentRec[] }

/** Nome social prevalece na exibição quando declarado; nome civil e histórico são preservados. */
export function buildStudentRecord(studentId: string, identity: IdentityVersion[], guardians: Guardian[], links: Link[], documents: DocumentRec[], at: string): StudentRecord | null {
  const hist = [...identity].sort((a, b) => a.validFrom.localeCompare(b.validFrom) || a.recordedAt.localeCompare(b.recordedAt));
  const current = [...hist].reverse().find((v) => v.validFrom <= at);
  if (!current) return null;
  return {
    studentId,
    displayName: current.socialName ?? current.civilName,
    civilName: current.civilName,
    socialName: current.socialName,
    identityHistory: hist,
    guardians: guardians.filter((g) => g.from <= at && (g.to == null || g.to >= at)),
    links,
    documents: [...documents].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)),
  };
}

// ---------- Linha do tempo ----------
export interface TimelineEvent { date: string | null; kind: string; label: string; ref: string }
export function studentTimeline(r: StudentRecord): TimelineEvent[] {
  const ev: TimelineEvent[] = [
    ...r.identityHistory.map((v) => ({ date: v.validFrom, kind: "identidade", label: v.reason ?? "versão cadastral", ref: v.recordedAt })),
    ...r.links.flatMap((l) => [
      { date: l.from, kind: l.kind, label: `${l.label} — início${l.from ? "" : " não declarado"}`, ref: l.id },
      ...(l.to ? [{ date: l.to, kind: l.kind, label: `${l.label} — término`, ref: l.id }] : []),
    ]),
    ...r.documents.map((d) => ({ date: d.issuedAt, kind: "documento", label: d.kind, ref: d.code })),
  ];
  // sem data vai ao fim, nunca recebe data presumida
  return ev.sort((a, b) => (a.date == null ? 1 : b.date == null ? -1 : a.date.localeCompare(b.date)));
}

// ---------- Suspeita de duplicidade ----------
export interface DupCandidate { studentId: string; name: string; birthDate: string | null; motherName: string | null }
export interface DupSuspicion { a: string; b: string; reasons: string[]; action: "revisao" }
export function duplicateSuspicions(list: DupCandidate[]): DupSuspicion[] {
  const out: DupSuspicion[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const x = list[i]!, y = list[j]!;
    if (norm(x.name) !== norm(y.name)) continue;
    const reasons = ["mesmo nome"];
    if (x.birthDate && x.birthDate === y.birthDate) reasons.push("mesma data de nascimento");
    if (x.motherName && y.motherName && norm(x.motherName) === norm(y.motherName)) reasons.push("mesma filiação");
    if (reasons.length >= 2) out.push({ a: x.studentId, b: y.studentId, reasons, action: "revisao" });
  }
  return out; // nunca mescla: só encaminha à revisão de identidade
}
