/**
 * OP por escola — LOTE 19 (agenda, documentos e relatórios).
 * Agenda = projeção dos itens já gravados pelos lotes OP (reuniões, formações, conselhos, projetos, intervenções,
 * tarefas…) sobre os dias do calendário oficial lidos (`institutional-calendar-days.ts`); nada é gravado aqui
 * e o calendário nunca é escrito. Sem calendário aplicável ⇒ dia "não resolvido", nunca letivo presumido.
 * GED = versão append-only de documento OP; assinatura só por `signatureLabel` (GED) com pessoa real.
 * Relatórios = `ReportDefinition` sobre linhas já lidas com a ACL de quem gera; executam só por `runReport`.
 */
import { signatureLabel, attachmentAllowed, type Signature } from "../document-studio/ged-core";
import { runReport, ReportError, type ReportDefinition, type CellValue } from "../reports/report-engine";

// ------------------------------------------------------------------ Agenda
export const AGENDA_KINDS = ["reuniao", "formacao", "acompanhamento", "conselho", "planejamento", "avaliacao", "projeto", "intervencao"] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];
export interface AgendaSourceItem { kind: AgendaKind; sourceRef: string; date: string; title: string; schoolId: string; visibleTo: "unidade" | "participantes"; participants: string[] }
export type OfficialDay = { date: string; effect: "letivo" | "nao-letivo" | "nao-resolvido"; label: string | null };
export type View = "dia" | "semana" | "mes" | "periodo";

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export function viewRange(view: View, anchor: string, period?: { from: string; to: string }): { from: string; to: string } {
  if (view === "dia") return { from: anchor, to: anchor };
  if (view === "semana") { const wd = (new Date(`${anchor}T00:00:00Z`).getUTCDay() + 6) % 7; const from = addDays(anchor, -wd); return { from, to: addDays(from, 6) }; }
  if (view === "mes") { const from = `${anchor.slice(0, 7)}-01`; const d = new Date(`${from}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return { from, to: d.toISOString().slice(0, 10) }; }
  if (!period) throw new Error("Período oficial não informado.");
  return period;
}

/** Agenda: cada dia do intervalo com o efeito oficial lido (ausente ⇒ não resolvido) e os itens que o leitor pode ver. */
export function buildAgenda(i: { view: View; anchor: string; period?: { from: string; to: string }; viewer: { schoolId: string; engagementId: string; isUnitOp: boolean };
  days: OfficialDay[] | null; items: AgendaSourceItem[] }) {
  const { from, to } = viewRange(i.view, i.anchor, i.period);
  const out: { date: string; effect: OfficialDay["effect"]; label: string | null; items: AgendaSourceItem[]; warning: string | null }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = i.days?.find((x) => x.date === d);
    const items = i.items.filter((x) => x.date === d && x.schoolId === i.viewer.schoolId && (AGENDA_KINDS as readonly string[]).includes(x.kind)
      && (i.viewer.isUnitOp && x.visibleTo === "unidade" || x.participants.includes(i.viewer.engagementId)));
    const effect = day?.effect ?? "nao-resolvido";
    out.push({ date: d, effect, label: day?.label ?? null, items,
      warning: items.length && effect === "nao-letivo" ? "Item em dia não letivo do calendário oficial: conferir." : items.length && effect === "nao-resolvido" ? "Calendário oficial não resolvido para este dia." : null });
  }
  return { from, to, calendarRead: i.days !== null, days: out };
}

// --------------------------------------------------------------------- GED
export const OP_DOC_KINDS = ["diretriz", "ata", "projeto", "material", "instrumento"] as const;
export interface OpDocVersion { logicalId: string; version: number; kind: (typeof OP_DOC_KINDS)[number]; schoolId: string | null; title: string; fileRef: string; sha256: string;
  authorPersonId: string; reason: string | null; signature: Signature | null; idempotencyKey: string }

export function recordDocVersion(v: OpDocVersion, existing: OpDocVersion[], ctx: { personNatural: boolean; personId: string; canWriteScope: boolean }):
  { ok: true; replay: boolean; version: OpDocVersion; signatureLabel: string | null } | { ok: false; reasons: string[] } {
  const rep = existing.find((x) => x.idempotencyKey === v.idempotencyKey);
  if (rep) return rep.logicalId === v.logicalId ? { ok: true, replay: true, version: rep, signatureLabel: rep.signature ? signatureLabel(rep.signature).label : null } : { ok: false, reasons: ["Chave idempotente reutilizada."] };
  const r: string[] = [];
  if (!ctx.personNatural) r.push("Executor técnico não é autor de documento.");
  if (!ctx.canWriteScope) r.push("Sem designação × capacidade para o escopo do documento.");
  if (v.authorPersonId !== ctx.personId) r.push("Versão só em nome de quem grava.");
  if (!(OP_DOC_KINDS as readonly string[]).includes(v.kind)) r.push("Tipo fora do catálogo.");
  if (!attachmentAllowed(v.fileRef)) r.push("Arquivo só em armazenamento privado.");
  if (!/^[0-9a-f]{64}$/.test(v.sha256)) r.push("Hash SHA-256 obrigatório.");
  const chain = existing.filter((x) => x.logicalId === v.logicalId).sort((a, b) => a.version - b.version);
  const head = chain[chain.length - 1];
  if (v.version !== (head?.version ?? 0) + 1) r.push("Base esperada divergente.");
  if (head && (head.kind !== v.kind || head.schoolId !== v.schoolId)) r.push("Tipo e escopo são imutáveis.");
  if (head && !v.reason?.trim()) r.push("Nova versão exige motivo.");
  let label: string | null = null;
  if (v.signature) {
    const s = signatureLabel(v.signature);
    if (!s.ok) r.push(s.label);
    else if (v.signature.personId !== ctx.personId) r.push("Assinatura só da própria pessoa que grava.");
    label = s.label;
  }
  return r.length ? { ok: false, reasons: r } : { ok: true, replay: false, version: v, signatureLabel: label };
}

// --------------------------------------------------------------- Relatórios
const T = (id: string, label: string, kind: "text" | "number" | "date" = "text", sensitive = false) => ({ id, label, kind, sensitive });
const P = [{ id: "escola", label: "Escola", type: "text" as const, required: true }, { id: "de", label: "De", type: "date" as const, required: true }, { id: "ate", label: "Até", type: "date" as const, required: true }];
const def = (id: string, title: string, source: string, columns: ReturnType<typeof T>[], dependency: string | null = null): ReportDefinition =>
  ({ id: `op-${id}`, version: 1, title, description: title, source, params: P, columns, formats: ["xlsx", "pdf"], reproducible: true, syncRowLimit: 1000, dependency });

/** Catálogo OP: fonte = núcleo/leitor canônico do lote; colunas com estudante são sensíveis (saem por padrão). */
export const OP_REPORTS: ReportDefinition[] = [
  def("planejamento", "Planejamento docente", "op-planning-flow", [T("professor", "Professor"), T("turma", "Turma"), T("estado", "Situação"), T("versao", "Versão", "number")]),
  def("execucao", "Execução curricular", "op-lesson-execution", [T("turma", "Turma"), T("prevista", "Previstas", "number"), T("registrada", "Registradas", "number"), T("conferir", "A conferir", "number")]),
  def("docente", "Acompanhamento docente", "op-teacher-followup", [T("tipo", "Tipo"), T("abertas", "Abertas", "number"), T("encerradas", "Encerradas", "number")]),
  def("aprendizagem", "Aprendizagem", "op-learning-diagnosis", [T("turma", "Turma"), T("escala", "Escala"), T("avaliados", "Avaliados", "number"), T("elegiveis", "Elegíveis", "number"), T("estudante", "Estudante", "text", true)]),
  def("intervencao", "Intervenções", "op-intervention-plan", [T("plano", "Plano"), T("versao", "Versão", "number"), T("situacao", "Situação")]),
  def("recuperacao", "Recuperação", "op-recovery", [T("habilidade", "Habilidade"), T("sinal", "Sinal"), T("estudante", "Estudante", "text", true)]),
  def("reuniao", "Reuniões", "op-meetings", [T("tipo", "Tipo"), T("data", "Data", "date"), T("presentes", "Presentes", "number"), T("nao_registrada", "Presença não registrada", "number")]),
  def("formacao", "Formações", "op-training", [T("tema", "Tema"), T("confirmados", "Confirmados", "number"), T("certificados", "Certificados validados", "number")]),
  def("projetos", "Projetos", "op-projects", [T("titulo", "Título"), T("escopo", "Escopo"), T("situacao", "Situação")]),
  def("diagnostico", "Diagnóstico da escola", "op-central", [T("bloco", "Bloco"), T("valor", "Valor", "number"), T("estado", "Estado da fonte")]),
  def("panorama-rede", "Panorama da rede", "op-panorama", [T("escola", "Escola"), T("estudantes", "Estudantes", "number"), T("professores", "Professores", "number")]),
];

/** Execução: só sobre linhas já lidas pela ACL do solicitante; central só panorama com supressão já aplicada; emissão exige assinante real. */
export function runOpReport(i: { reportId: string; params: Record<string, unknown>; rows: Record<string, CellValue>[] | null; viewer: "unidade" | "central";
  format: "xlsx" | "pdf"; signer: Signature | null; sourceReadAt: string | null; includeSensitive?: boolean; now?: Date }) {
  const d = OP_REPORTS.find((x) => x.id === i.reportId);
  if (!d) return { ok: false as const, reason: "Relatório não catalogado." };
  if (i.viewer === "central" && d.id !== "op-panorama-rede") return { ok: false as const, reason: "Coordenação central emite só o panorama agregado da rede." };
  if (i.viewer === "central" && i.includeSensitive) return { ok: false as const, reason: "Central nunca recebe coluna individual." };
  if (i.rows === null || !i.sourceReadAt) return { ok: false as const, reason: "Fonte não lida: relatório não é emitido (ausência não vira zero)." };
  if (!d.formats.includes(i.format)) return { ok: false as const, reason: "Formato não previsto." };
  if (!i.signer) return { ok: false as const, reason: "Emissão exige assinatura de pessoa real." };
  const sig = signatureLabel(i.signer); if (!sig.ok) return { ok: false as const, reason: sig.label };
  if (i.viewer === "central" && i.rows.some((r) => Object.values(r).some((v) => typeof v === "number" && v > 0 && v < 5))) return { ok: false as const, reason: "Panorama recebido sem supressão 1–4." };
  try {
    const result = runReport(d, { params: i.params, includeSensitive: !!i.includeSensitive }, i.rows, i.now);
    return { ok: true as const, result, meta: [`Fonte: ${d.source} (lida em ${i.sourceReadAt})`, sig.label], signature: sig.label };
  } catch (e) { return { ok: false as const, reason: e instanceof ReportError ? e.message : "Falha na geração." }; }
}
