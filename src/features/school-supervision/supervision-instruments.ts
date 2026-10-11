// Supervisão Escolar — Lote 04: instrumentos versionados (núcleo puro).
// Instrumento = cadeia append-only de versões; publicada é congelada; resposta guarda a versão usada.
// Templates são ESQUELETOS em rascunho: nenhuma pergunta afirma exigência legal; norma só por
// referência documental informada por pessoa, e o instrumento só é publicado por competência.

export type AnswerType = "sim-nao" | "escala" | "texto" | "numero" | "data" | "multipla";
export interface Scale { min: number; max: number; labels: Record<number, string> }
export interface Question {
  key: string; text: string; type: AnswerType; required: boolean;
  scale?: Scale; options?: string[];
  evidenceRequired: boolean; attachmentsAllowed: boolean;
  normRef: { title: string; article: string | null; documentSha256: string | null } | null; // nunca inventada
  recommendation: string | null; defaultDueDays: number | null;
}
export interface Section { key: string; title: string; questions: Question[] }
export interface InstrumentVersion { instrumentId: string; version: number; title: string; sections: Section[]; state: "rascunho" | "publicada" | "retirada"; authorPrincipalId: string; publishedBy: string | null; at: string; reason: string | null }
export type Res<T> = { ok: true; value: T } | { ok: false; code: string };

export function validateStructure(sections: Section[]): string[] {
  const p: string[] = [];
  const keys = new Set<string>();
  if (!sections.length) p.push("sem seções");
  for (const s of sections) {
    if (!s.questions.length) p.push(`seção ${s.key} sem perguntas`);
    for (const q of s.questions) {
      if (keys.has(q.key)) p.push(`pergunta duplicada: ${q.key}`);
      keys.add(q.key);
      if (!q.text.trim()) p.push(`pergunta ${q.key} sem enunciado`);
      if (q.type === "escala" && (!q.scale || q.scale.min >= q.scale.max)) p.push(`escala inválida em ${q.key}`);
      if (q.type === "multipla" && (q.options?.length ?? 0) < 2) p.push(`opções insuficientes em ${q.key}`);
      if (q.normRef && !q.normRef.title.trim()) p.push(`norma sem título em ${q.key}`);
      if (q.defaultDueDays != null && q.defaultDueDays <= 0) p.push(`prazo inválido em ${q.key}`);
    }
  }
  return p;
}

/** Nova versão sempre sobre a cabeça; publicada nunca é editada. */
export function saveVersion(chain: InstrumentVersion[], next: Omit<InstrumentVersion, "version" | "state" | "publishedBy">, expectedVersion: number, human: boolean): Res<InstrumentVersion[]> {
  if (!human) return { ok: false, code: "human-author-required" };
  const head = chain.at(-1);
  if ((head?.version ?? 0) !== expectedVersion) return { ok: false, code: "stale-base" };
  if (head && head.state === "rascunho") return { ok: false, code: "draft-exists-edit-it" };
  if (head && !next.reason?.trim()) return { ok: false, code: "reason-required" };
  return { ok: true, value: [...chain, { ...next, version: expectedVersion + 1, state: "rascunho", publishedBy: null }] };
}
export function editDraft(chain: InstrumentVersion[], sections: Section[], principalId: string): Res<InstrumentVersion[]> {
  const head = chain.at(-1);
  if (!head || head.state !== "rascunho") return { ok: false, code: "published-is-frozen" };
  if (head.authorPrincipalId !== principalId) return { ok: false, code: "only-author-edits-draft" };
  return { ok: true, value: [...chain.slice(0, -1), { ...head, sections }] };
}
export function publish(chain: InstrumentVersion[], by: { principalId: string; human: boolean; hasCapability: boolean }, expectedVersion: number): Res<InstrumentVersion[]> {
  const head = chain.at(-1);
  if (!head || head.version !== expectedVersion) return { ok: false, code: "stale-base" };
  if (!by.human) return { ok: false, code: "human-author-required" };
  if (!by.hasCapability) return { ok: false, code: "no-competence" };
  if (head.state !== "rascunho") return { ok: false, code: "not-draft" };
  if (head.authorPrincipalId === by.principalId) return { ok: false, code: "publisher-must-differ" };
  const probs = validateStructure(head.sections);
  if (probs.length) return { ok: false, code: `invalid:${probs[0]}` };
  return { ok: true, value: chain.map((v) => (v.version === head.version ? { ...v, state: "publicada" as const, publishedBy: by.principalId } : v.state === "publicada" ? { ...v, state: "retirada" as const } : v)) };
}

// ---------- Respostas ----------
export interface AnswerValue { questionKey: string; value: string | number | boolean | null; evidence: string[]; note: string | null }
export interface Response { id: string; visitId: string; instrumentId: string; version: number; frozenSections: Section[]; answers: AnswerValue[] }

/** Resposta congela a estrutura da versão usada; edições futuras do instrumento não a alcançam. */
export function startResponse(id: string, visitId: string, v: InstrumentVersion): Res<Response> {
  if (v.state !== "publicada") return { ok: false, code: "instrument-not-published" };
  return { ok: true, value: { id, visitId, instrumentId: v.instrumentId, version: v.version, frozenSections: structuredClone(v.sections), answers: [] } };
}

export function answerProblems(r: Response): string[] {
  const p: string[] = [];
  for (const q of r.frozenSections.flatMap((s) => s.questions)) {
    const a = r.answers.find((x) => x.questionKey === q.key);
    if (!a || a.value == null) { if (q.required) p.push(`${q.key}: sem resposta`); continue; }
    if (q.type === "escala" && q.scale && (typeof a.value !== "number" || a.value < q.scale.min || a.value > q.scale.max)) p.push(`${q.key}: fora da escala`);
    if (q.type === "multipla" && !q.options?.includes(String(a.value))) p.push(`${q.key}: opção inexistente`);
    if (q.evidenceRequired && !a.evidence.length) p.push(`${q.key}: evidência exigida`);
    if (!q.attachmentsAllowed && a.evidence.some((e) => e.includes("/"))) p.push(`${q.key}: anexo não permitido`);
  }
  return p;
}

/** Providências sugeridas: só das perguntas com recomendação declarada e resposta "não"; prazo só se declarado. */
export function suggestedProvisions(r: Response, answeredOn: string) {
  return r.frozenSections.flatMap((s) => s.questions).filter((q) => q.recommendation && r.answers.find((a) => a.questionKey === q.key)?.value === false).map((q) => {
    let due: string | null = null;
    if (q.defaultDueDays) { const d = new Date(answeredOn + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + q.defaultDueDays); due = d.toISOString().slice(0, 10); }
    return { questionKey: q.key, text: q.recommendation!, due, normRef: q.normRef, suggestion: true };
  });
}

// ---------- Templates (esqueletos em rascunho, sem exigência legal) ----------
const q = (key: string, text: string): Question => ({ key, text, type: "sim-nao", required: false, evidenceRequired: false, attachmentsAllowed: true, normRef: null, recommendation: null, defaultDueDays: null });
export const TEMPLATE_SKELETONS: Record<string, Section> = {
  escrituracao: { key: "escrituracao", title: "Escrituração escolar", questions: [q("escrit-livros", "Livros de registro conferidos nesta visita?")] },
  calendario: { key: "calendario", title: "Calendário escolar", questions: [q("cal-aplicavel", "Calendário aplicável disponível na escola?")] },
  turmas: { key: "turmas", title: "Turmas", questions: [q("turmas-conferidas", "Composição das turmas conferida com o sistema?")] },
  funcionamento: { key: "funcionamento", title: "Funcionamento", questions: [q("func-horario", "Horário de funcionamento observado?")] },
  ppp: { key: "ppp", title: "Projeto Político-Pedagógico", questions: [q("ppp-disponivel", "PPP disponível para consulta?")] },
  infraestrutura: { key: "infraestrutura", title: "Infraestrutura", questions: [q("infra-observacao", "Houve observação de infraestrutura a registrar?")] },
  inclusao: { key: "inclusao", title: "Inclusão", questions: [q("incl-atendimento", "Atendimento de inclusão observado (sem dado clínico)?")] },
  "providencias-anteriores": { key: "providencias-anteriores", title: "Providências anteriores", questions: [q("prov-verificadas", "Providências da visita anterior verificadas?")] },
};
/** Template vira rascunho do autor; todas as perguntas ficam opcionais e sem norma até alguém declarar. */
export function draftFromTemplates(keys: string[], instrumentId: string, title: string, authorPrincipalId: string, at: string): InstrumentVersion {
  return { instrumentId, version: 1, title, sections: keys.map((k) => structuredClone(TEMPLATE_SKELETONS[k]!)).filter(Boolean), state: "rascunho", authorPrincipalId, publishedBy: null, at, reason: null };
}
