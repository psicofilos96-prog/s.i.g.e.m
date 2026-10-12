/**
 * OP por escola — LOTE 16 (Conselho de Classe).
 * A OP só APOIA: o conselho é o módulo colegiado existente (`src/features/collegial/`) — configuração homologada,
 * sessão, pauta, deliberação por competência da regra (12I) e ata estruturada imutável. Aqui:
 *  1) preparação = dossiê congelado de fatos já lidos (turma, frequência, resultados, intervenções, documentos);
 *  2) proposta de pauta (sem deliberar, sem situação acadêmica);
 *  3) análises pedagógicas como manifestação (MinuteStatement), nunca decisão;
 *  4) encaminhamentos de ata ENCERRADA → Central de tarefas (dedupeKey estável).
 * Nada é homologado nem aprovado aqui; sem conselho previsto (configuração homologada), nada acontece.
 */
import { decideOpAccess, type OpDesignation } from "./op-designations";
import { conductIssues } from "../collegial/collegial-governance";
import { dedupeKey } from "../tasks/task-model";
import type { CollegialActor, CollegialBodyConfiguration, DeliberationDossier, DossierFactEntry, SessionAgendaItem, StructuredMinute } from "../collegial/collegial-types";

export type SourceRead<T> = { status: "lido"; readAt: string; value: T } | { status: "nao-lido" | "negado"; reason: string };
export interface PreparationSources {
  classRoster: SourceRead<{ studentId: string; studentName: string }[]>;
  attendance: SourceRead<{ studentId: string; rate: number | null; sourceId: string; version: number }[]>;
  results: SourceRead<{ studentId: string; label: string; value: string | null; scale: string; sourceId: string; version: number }[]>;
  interventions: SourceRead<{ studentId: string | null; planId: string; version: number; label: string }[]>;
  documents: SourceRead<{ id: string; label: string; studentId: string | null }[]>;
}

export interface AccessCtx {
  personNatural: boolean; personId: string; date: string; schoolId: string; classId: string;
  designations: OpDesignation[]; capabilities: { id: string; scope: "escola" | "rede"; schoolId: string | null }[];
}
const access = (c: AccessCtx, action: "consultar" | "registrar") =>
  decideOpAccess({ personNatural: c.personNatural, personId: c.personId, date: c.date, schoolId: c.schoolId, classId: c.classId, granularity: "individual", action, purpose: "conselho", designations: c.designations, capabilities: c.capabilities });

/** Conselho só "quando previsto": configuração homologada cujo escopo cobre a escola/turma. */
export function councilProvided(cfg: CollegialBodyConfiguration | null, schoolId: string, classId: string): string | null {
  if (!cfg) return "Nenhum colegiado configurado: o conselho não está previsto.";
  if (cfg.status !== "homologada") return "Configuração do conselho não homologada.";
  if (cfg.scope.unitIds && !cfg.scope.unitIds.includes(schoolId)) return "Conselho não previsto para esta escola.";
  if (cfg.scope.classIds && !cfg.scope.classIds.includes(classId)) return "Conselho não previsto para esta turma.";
  return null;
}

/** Preparação: dossiê congelado por estudante; fonte não lida/negada = fato indisponível (null), nunca zero. */
export function buildPreparation(c: AccessCtx, cfg: CollegialBodyConfiguration | null, s: PreparationSources, snapshotAt: string):
  { ok: true; dossiers: { studentId: string; studentName: string; dossier: DeliberationDossier }[]; limitations: string[] } | { ok: false; reasons: string[] } {
  const reasons = [councilProvided(cfg, c.schoolId, c.classId), (() => { const a = access(c, "consultar"); return a.ok ? null : a.reason; })()].filter(Boolean) as string[];
  if (s.classRoster.status !== "lido") reasons.push("Enturmação não lida: sem turma, não há preparação.");
  if (reasons.length) return { ok: false, reasons };
  const roster = (s.classRoster as { value: { studentId: string; studentName: string }[] }).value;
  const limitations: string[] = [];
  for (const [k, v] of Object.entries(s)) if (v.status !== "lido") limitations.push(`${k}: ${v.reason}`);
  const prov = (kind: string, id: string, version?: number) => (version === undefined ? { kind, id } : { kind, id, version });
  const dossiers = roster.map((st) => {
    const facts: DossierFactEntry[] = [];
    const sources: { kind: string; id: string; version?: number }[] = [];
    if (s.attendance.status === "lido") {
      const a = s.attendance.value.find((x) => x.studentId === st.studentId);
      facts.push({ factId: "frequencia", scopeKey: st.studentId, label: "Frequência", value: a?.rate ?? null, unit: "%",
        ...(a?.rate == null ? { unavailableReason: "Sem chamada que componha o denominador." } : {}), provenance: { source: a?.sourceId ?? "frequencia" } as never });
      if (a) sources.push(prov("frequencia", a.sourceId, a.version));
    } else facts.push({ factId: "frequencia", scopeKey: st.studentId, label: "Frequência", value: null, unavailableReason: s.attendance.reason, provenance: { source: "frequencia" } as never });
    if (s.results.status === "lido") for (const r of s.results.value.filter((x) => x.studentId === st.studentId)) {
      facts.push({ factId: `resultado:${r.sourceId}`, scopeKey: st.studentId, label: `${r.label} (${r.scale})`, value: r.value, provenance: { source: r.sourceId } as never });
      sources.push(prov("resultado", r.sourceId, r.version));
    }
    if (s.interventions.status === "lido") for (const i of s.interventions.value.filter((x) => x.studentId === st.studentId)) sources.push(prov("intervencao", i.planId, i.version));
    if (s.documents.status === "lido") for (const d of s.documents.value.filter((x) => x.studentId === st.studentId || x.studentId === null)) sources.push(prov("documento", d.id));
    return { studentId: st.studentId, studentName: st.studentName, dossier: { referenceSnapshotAt: snapshotAt, sources, facts, note: "Preparação da Orientação Pedagógica; não contém situação acadêmica." } };
  });
  return { ok: true, dossiers, limitations };
}

/** Proposta de pauta: a OP sugere itens institucionais; encaminhamento por regra e deliberação não nascem aqui. */
export function proposeAgenda(c: AccessCtx, cfg: CollegialBodyConfiguration | null, items: { id: string; title: string; studentId?: string; dossier?: DeliberationDossier }[]):
  { ok: true; agenda: SessionAgendaItem[] } | { ok: false; reasons: string[] } {
  const r = [councilProvided(cfg, c.schoolId, c.classId), (() => { const a = access(c, "registrar"); return a.ok ? null : a.reason; })()].filter(Boolean) as string[];
  if (items.some((i) => /(aprova|reprova|reten[çc]|promo[çc]|homolog)/i.test(i.title))) r.push("Pauta proposta pela OP não antecipa deliberação nem situação acadêmica.");
  if (r.length) return { ok: false, reasons: r };
  return { ok: true, agenda: items.map((i, n) => ({ id: i.id, order: n + 1, title: i.title, subject: i.studentId ? { kind: "estudante", studentId: i.studentId } : { kind: "turma" },
    origin: { kind: "pauta-institucional", note: "Proposta da Orientação Pedagógica" as string }, ...(i.dossier ? { dossier: i.dossier } : {}) })) };
}

/** Análise pedagógica = manifestação na ata em elaboração; nunca deliberação, voto ou outcome. */
export function analysisStatement(c: AccessCtx, authorName: string, text: string, at: string, id: string) {
  const a = access(c, "registrar");
  if (!a.ok) return { ok: false as const, reason: a.reason };
  if (/(cid[\s-]?\d|laudo|diagn[óo]stic)/i.test(text)) return { ok: false as const, reason: "Análise não transcreve dado clínico." };
  if (/(delibera|decide|aprovad|reprovad|retid|promovid|homologad)/i.test(text)) return { ok: false as const, reason: "Manifestação da OP não delibera; a decisão é da autoridade competente." };
  return { ok: true as const, statement: { id, at, authorName, authorRoleId: "orientacao-pedagogica", text } };
}

/** A OP só conduz se a configuração homologada lhe atribuir as capacidades de condução — nada é presumido. */
export function opMayConduct(cfg: CollegialBodyConfiguration, actor: CollegialActor): string[] { return conductIssues(cfg, actor); }

/** Encaminhamentos: só de ata ENCERRADA e vigente (última versão), com responsável; prazo só se declarado. */
export interface CouncilReferral { id: string; minuteId: string; text: string; responsibleEngagementId: string | null; dueOn: string | null }
export function councilReferralTasks(minutes: StructuredMinute[], referrals: CouncilReferral[], schoolId: string) {
  const bySession = new Map<string, StructuredMinute>();
  for (const m of minutes) { const cur = bySession.get(m.sessionId); if (!cur || m.version > cur.version) bySession.set(m.sessionId, m); }
  const current = new Set([...bySession.values()].filter((m) => !!m.closedAt).map((m) => m.id));
  const tasks = []; const pending: string[] = [];
  for (const f of referrals) {
    if (!current.has(f.minuteId)) { pending.push(`"${f.text}": ata não vigente ou não encerrada.`); continue; }
    if (!f.responsibleEngagementId) { pending.push(`"${f.text}": sem responsável.`); continue; }
    const sourceRef = `${f.minuteId}:${f.id}`;
    tasks.push({ schoolId, title: f.text, dueOn: f.dueOn, assigneeEngagement: f.responsibleEngagementId, sourceKind: "op-conselho", sourceRef,
      dedupeKey: dedupeKey(schoolId, "op-conselho", sourceRef, f.text, "v1") });
  }
  return { tasks, pending };
}
