// AK — Estação da Direção: projeção pura sobre readers canônicos. Nada é gravado; nenhum score.
export type BlockState = "AVAILABLE" | "ZERO" | "UNKNOWN" | "UNAVAILABLE" | "BLOCKED";
export type Probe<T> = { ok: true; data: T } | { ok: false; error: string };

export type Block = Readonly<{
  id: string; title: string; state: BlockState; value: number | null; detail: string; reason: string | null;
  source: string; link: string; supportsKnownAt: boolean;
}>;
export type Pending = Readonly<{ id: string; kind: "fato-ausente" | "ambiguidade" | "conferencia" | "bloqueio-normativo" | "fonte-indisponivel"; text: string; link: string; source: string }>;

export const STATE_LABEL: Record<BlockState, string> = {
  AVAILABLE: "Disponível", ZERO: "Zero registrado", UNKNOWN: "Desconhecido", UNAVAILABLE: "Não disponível para você", BLOCKED: "Bloqueado",
};

/** Recusa de autorização é "não disponível" (sem revelar existência); demais falhas são "desconhecido". */
export function classifyError(msg: string): "UNAVAILABLE" | "UNKNOWN" {
  return /not-authorized|access-denied|capability|permission denied|42501|session-required/i.test(msg) ? "UNAVAILABLE" : "UNKNOWN";
}
const failed = (b: Omit<Block, "state" | "value" | "detail" | "reason">, error: string): Block => {
  const st = classifyError(error);
  return { ...b, state: st, value: null, detail: st === "UNAVAILABLE" ? "Sua atuação não alcança esta fonte nesta escola." : "A fonte não pôde ser lida agora.", reason: st === "UNKNOWN" ? "Falha de leitura; nada foi presumido." : "Sem capability vigente para esta leitura." };
};
/** Reader que sinaliza recusa por linha (result_kind) em vez de erro. */
function rowDenied(rows: readonly { result_kind?: string | null }[]): string | null {
  const k = rows[0]?.result_kind;
  return k === "access-denied" ? "access-denied" : k === "invalid" ? "invalid-arguments" : null;
}
const count = (b: Omit<Block, "state" | "value" | "detail" | "reason">, n: number, what: string, zeroMeans: "zero" | "unknown"): Block =>
  n > 0 ? { ...b, state: "AVAILABLE", value: n, detail: `${n} ${what}.`, reason: null }
    : zeroMeans === "zero" ? { ...b, state: "ZERO", value: 0, detail: `Nenhum registro de ${what} na fonte.`, reason: "Contagem de registros existentes; não afirma que o fato não ocorreu." }
    : { ...b, state: "UNKNOWN", value: null, detail: `Nenhuma informação de ${what}.`, reason: "Ausência de registro não prova zero." };

export type Overview = { year: { label: string | null; state: string | null; starts_on: string | null; ends_on: string | null }; enrollments: { total: number; active: number; not_started: number; start_unknown: number; ended: number }; allocations: { active_episodes: number; classes_with_students: number; enrollments_without_class: number }; movements: Record<string, number> };
export type Inputs = {
  school: string; year: string; on: string; knownAt: string | null; window: { from: string; to: string };
  overview: Probe<Overview>;
  classes: Probe<{ id: string; name: string }[]>;
  schedules: Probe<Record<string, boolean>>; // class_id → possui grade utilizável na data
  diary: Probe<{ result_kind: string; attendance_version: number | null; marked_count: number | null; eligible_count: number | null }[]>;
  plans: Probe<{ result_kind: string }[]>;
  attendanceClosings: Probe<number>; assessmentClosings: Probe<number>;
  followups: Probe<number>; documents: Probe<number>;
  communications: Probe<{ state: string }[]>;
  aee: Probe<{ valid_to: string | null; valid_from: string; event_kind: string }[]>;
  meals: Probe<number>;
  staff?: Probe<number>; infrastructure?: Probe<number>; declaredMaps?: Probe<number>;
};

export function buildPanel(i: Inputs): { blocks: Block[]; pending: Pending[] } {
  const blocks: Block[] = []; const pending: Pending[] = [];
  const B = (id: string, title: string, source: string, link: string, supportsKnownAt: boolean) => ({ id, title, source, link, supportsKnownAt });

  // Ano e matrículas (secretariat_overview_at)
  const yb = B("ano", "Ano letivo", "academic_year_operational_state_at", "/secretaria", false);
  if (!i.overview.ok) {
    for (const [id, t] of [["ano", "Ano letivo"], ["matriculas", "Matrículas"], ["alocacoes", "Turmas e alocações"], ["movimentacoes", "Movimentações"]] as const)
      blocks.push(failed(B(id, t, "secretariat_overview_at", "/secretaria", false), i.overview.error));
    pending.push({ id: "fonte-secretaria", kind: "fonte-indisponivel", text: "Matrículas e alocações não puderam ser lidas.", link: "/secretaria", source: "secretariat_overview_at" });
  } else {
    const o = i.overview.data;
    if (!o.year.state) {
      blocks.push({ ...yb, state: "BLOCKED", value: null, detail: `${o.year.label ?? "Ano"}: sem estado operacional registrado.`, reason: "O ano só é aberto por ato humano registrado; nada é aberto automaticamente." });
      pending.push({ id: "ano-sem-estado", kind: "bloqueio-normativo", text: "Ano letivo sem estado operacional registrado.", link: "/secretaria", source: "academic_year_operational_state_at" });
    } else blocks.push({ ...yb, state: "AVAILABLE", value: null, detail: `${o.year.label ?? "Ano"}: ${o.year.state}.`, reason: null });
    const e = o.enrollments; const mb = B("matriculas", "Matrículas ativas na data", "secretariat_overview_at", "/secretaria", false);
    if (e.start_unknown > 0) {
      blocks.push({ ...mb, state: "UNKNOWN", value: null, detail: `${e.total} matrículas no ano; ${e.start_unknown} sem início efetivo declarado.`, reason: "Sem início efetivo não é possível afirmar se a matrícula estava ativa na data." });
      pending.push({ id: "matricula-sem-inicio", kind: "fato-ausente", text: `${e.start_unknown} matrículas sem início efetivo declarado.`, link: "/secretaria", source: "secretariat_overview_at" });
    } else blocks.push(e.total === 0 ? count(mb, 0, "matrículas no ano", "zero") : { ...mb, state: e.active > 0 ? "AVAILABLE" : "ZERO", value: e.active, detail: `${e.active} ativas; ${e.not_started} a iniciar; ${e.ended} encerradas.`, reason: null });
    const a = o.allocations;
    blocks.push(count(B("alocacoes", "Turmas com estudantes", "secretariat_overview_at", "/secretaria", false), a.classes_with_students, "turmas com estudantes alocados", "zero"));
    if (a.enrollments_without_class > 0) pending.push({ id: "sem-turma", kind: "fato-ausente", text: `${a.enrollments_without_class} matrículas vigentes sem turma.`, link: "/secretaria", source: "secretariat_overview_at" });
    const mv = Object.values(o.movements).reduce((s, n) => s + n, 0);
    blocks.push(count(B("movimentacoes", "Movimentações no ano", "secretariat_overview_at", "/secretaria", false), mv, "movimentações registradas", "zero"));
  }

  // Grade/oferta
  const gb = B("grade", "Turmas com grade utilizável", "class_schedule_at", "/horarios", true);
  if (!i.classes.ok) blocks.push(failed(gb, i.classes.error));
  else if (!i.schedules.ok) blocks.push(failed(gb, i.schedules.error));
  else {
    const without = i.classes.data.filter((c) => !i.schedules.ok || !(i.schedules.data[c.id] ?? false));
    blocks.push(i.classes.data.length === 0 ? count(gb, 0, "turmas cadastradas no ano", "zero")
      : { ...gb, state: "AVAILABLE", value: i.classes.data.length - without.length, detail: `${i.classes.data.length - without.length} de ${i.classes.data.length} turmas com grade na data.`, reason: null });
    for (const c of without.slice(0, 20)) pending.push({ id: `grade-${c.id}`, kind: "fato-ausente", text: `Turma ${c.name} sem grade utilizável na data.`, link: "/horarios", source: "class_schedule_at" });
  }

  // Diário
  const db = B("diario", `Aulas registradas (${i.window.from} a ${i.window.to})`, "diary_school_overview_at", "/acompanhamento-diarios", false);
  if (!i.diary.ok) blocks.push(failed(db, i.diary.error));
  else { const d = rowDenied(i.diary.data); if (d) blocks.push(failed(db, d)); else {
    const lessons = i.diary.data.filter((r) => r.result_kind === "lesson");
    blocks.push(count(db, lessons.length, "aulas registradas no período", "zero"));
    const noAtt = lessons.filter((l) => l.attendance_version == null).length;
    if (noAtt > 0) pending.push({ id: "aula-sem-frequencia", kind: "fato-ausente", text: `${noAtt} aulas registradas sem frequência.`, link: "/acompanhamento-diarios", source: "diary_school_overview_at" });
  } }

  // Planejamento
  const pb = B("planejamento", "Planos compartilhados", "teaching_plans_overview_at", "/acompanhamento-planejamento", false);
  if (!i.plans.ok) blocks.push(failed(pb, i.plans.error));
  else { const d = rowDenied(i.plans.data); blocks.push(d ? failed(pb, d) : count(pb, i.plans.data.filter((r) => r.result_kind === "plan").length, "planos compartilhados vigentes", "zero")); }

  const simple = (p: Probe<number>, b: ReturnType<typeof B>, what: string, zero: "zero" | "unknown") => blocks.push(p.ok ? count(b, p.data, what, zero) : failed(b, p.error));
  simple(i.attendanceClosings, B("fechamento-frequencia", "Fechamentos de frequência", "attendance_closing_versions", "/diario", false), "fechamentos de frequência", "zero");
  simple(i.assessmentClosings, B("fechamento-avaliacao", "Fechamentos de período", "period_closing_versions", "/diario", false), "fechamentos de período", "zero");
  simple(i.followups, B("acompanhamento", "Registros de acompanhamento", "school_pedagogical_records_at", "/direcao", true), "registros de acompanhamento", "zero");
  const docB = B("documentos", "Documentos emitidos", "student_document_emissions", "/documentos-escolares", false);
  if (!i.documents.ok && i.documents.error === "source:no-school-reader")
    blocks.push({ ...docB, state: "BLOCKED", value: null, detail: "Emissões são consultadas por estudante, no módulo de documentos.", reason: "Não existe leitura canônica de emissões por escola; o painel não cria uma." });
  else simple(i.documents, docB, "documentos emitidos", "zero");

  const cb = B("comunicacao", "Comunicados publicados", "school_communications_at", "/comunicacao-escolar", false);
  if (!i.communications.ok) blocks.push(failed(cb, i.communications.error));
  else {
    blocks.push(count(cb, i.communications.data.filter((c) => c.state === "publicado" || c.state === "retificacao-em-rascunho").length, "comunicados publicados", "zero"));
    const draft = i.communications.data.filter((c) => c.state === "retificacao-em-rascunho").length;
    if (draft > 0) pending.push({ id: "comunicado-correcao", kind: "conferencia", text: `${draft} correções de comunicado aguardando publicação.`, link: "/comunicacao-escolar", source: "school_communications_at" });
  }

  const ab = B("aee", "Atendimentos AEE vigentes", "aee_services_at", "/inclusao", true);
  if (!i.aee.ok) blocks.push(failed(ab, i.aee.error));
  else blocks.push(count(ab, i.aee.data.filter((s) => s.event_kind !== "encerramento" && s.valid_from <= i.on && (!s.valid_to || s.valid_to >= i.on)).length, "atendimentos AEE vigentes", "zero"));

  // Alimentação: ausência de informação de serviço nunca é zero refeição.
  simple(i.meals, B("alimentacao", `Serviços de alimentação informados (${i.window.from} a ${i.window.to})`, "meal_services_at", "/alimentacao-escolar", true), "serviços informados", "unknown");

  // Lote D: pessoal, infraestrutura e mapas declarados — leitura RLS da sessão; registro ausente nunca é zero.
  if (i.staff) simple(i.staff, B("pessoal", "Registros administrativos de pessoal 2026", "staff_administrative_records", "/profissionais", false), "registros de pessoal", "unknown");
  if (i.infrastructure) simple(i.infrastructure, B("infraestrutura", "Observações de infraestrutura (Censo)", "school_infrastructure_observations", "/unidades", false), "observações de infraestrutura", "unknown");
  if (i.declaredMaps) simple(i.declaredMaps, B("mapa-declarado", "Mapas mensais declarados pela escola", "school_declared_monthly_maps", "/mapa-censo-2026", false), "competências declaradas", "unknown");

  for (const b of blocks) if (b.state === "UNKNOWN" && b.reason?.startsWith("Falha")) pending.push({ id: `falha-${b.id}`, kind: "fonte-indisponivel", text: `${b.title}: fonte não lida.`, link: b.link, source: b.source });
  return { blocks, pending };
}

/** Linhas do relatório de gestão: mesma projeção exibida, sem recálculo. */
export function managementRows(blocks: readonly Block[]) {
  return blocks.map((b) => ({ block: b.title, state: STATE_LABEL[b.state], value: b.value, detail: b.detail, reason: b.reason, source: b.source, knownAt: b.supportsKnownAt ? "sim" : "não (estado atual da fonte)" }));
}

export function shiftDays(iso: string, d: number) { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); }

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/**
 * N7.2.4 — Dossiê da Direção (PDF A4): a MESMA projeção da tela (blocos + pendências), sem recálculo.
 * Declara que não é documento oficial; pendência vazia nunca afirma que a escola está em ordem.
 */
export function dossierPrintHtml(tableHtml: string, pending: readonly Pending[]): string {
  const list = pending.length === 0
    ? `<p>Nenhuma pendência derivável das fontes alcançadas. Isso não afirma que a escola está em ordem.</p>`
    : `<ol>${pending.map((p) => `<li>${escHtml(p.text)} <small>(${escHtml(p.source)})</small></li>`).join("")}</ol>`;
  const section = `<h2 style="font-size:14px">Pendências (${pending.length})</h2>${list}<p><small>Projeção dinâmica dos registros oficiais alcançados por quem gerou — não é documento oficial, não classifica nem decide.</small></p>`;
  return tableHtml.replace("</body></html>", `${section}</body></html>`);
}
