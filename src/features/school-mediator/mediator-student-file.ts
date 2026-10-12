/**
 * PERFIL MEDIADOR — LOTE 05 Ficha de acompanhamento (núcleo puro).
 * Projeção mínima sobre fontes oficiais: designação (`inclusion_my_mediated_students`),
 * matrícula/enturmação canônica (episódios lidos pelo reader oficial), orientações
 * (`currentGuidance`) e cadeia da designação. Nunca prontuário/laudo: campos clínicos
 * não existem no tipo de saída e texto clínico é retido.
 */
import { currentGuidance, type InclusionRecordRow } from "./mediator-central";
import type { MediatedStudent } from "./mediator-panel";

export interface EnrollmentEpisode { classId: string; className: string | null; shift: string | null; from: string; to: string | null }
export interface InstitutionalContact { role: string; label: string; channel: "protocolo-nei" | "secretaria" | "direcao" | "orientacao"; href: string }
export interface DesignationVersion { version: number; kind: string; from: string; to: string | null; classId: string | null; reason: string | null; recordedAt: string }

type Src<T> = T | null;

/** Campos permitidos na ficha (allowlist); qualquer outro é descartado. */
export const FILE_FIELDS = ["name", "schoolId", "classId", "className", "shift", "designationFrom", "designationTo"] as const;

export interface StudentFile {
  identification: { name: string; schoolId: string; classId: string | null; className: string | null; shift: string | null; designationFrom: string; designationTo: string | null };
  enrollmentState: "vigente" | "sem-alocacao-na-data" | "ambigua" | "nao-disponivel";
  guidance: ReturnType<typeof currentGuidance> | null;
  resources: string[] | null; routines: string[] | null;
  contacts: InstitutionalContact[];
  timeline: { date: string; label: string; source: "matricula" | "designacao" | "orientacao" }[];
  limitations: string[];
}

const RESOURCE_TYPES = new Set(["recurso", "recurso-acessibilidade", "tecnologia-assistiva"]);
const ROUTINE_TYPES = new Set(["rotina", "orientacao-rotina"]);

export function buildStudentFile(p: {
  date: string; student: MediatedStudent; episodes: Src<EnrollmentEpisode[]>; records: Src<InclusionRecordRow[]>;
  designationChain: Src<DesignationVersion[]>; contacts: InstitutionalContact[];
}): StudentFile {
  const lim: string[] = [];
  const live = p.episodes?.filter((e) => e.from <= p.date && (e.to === null || p.date <= e.to)) ?? null;
  const enrollmentState: StudentFile["enrollmentState"] = live === null ? "nao-disponivel" : live.length === 0 ? "sem-alocacao-na-data" : live.length > 1 ? "ambigua" : "vigente";
  if (enrollmentState === "nao-disponivel") lim.push("Enturmação oficial não lida: turma e turno vêm só da designação.");
  if (enrollmentState === "ambigua") lim.push("Mais de uma alocação vigente na data: turno não definido.");
  if (enrollmentState === "sem-alocacao-na-data") lim.push("Sem alocação vigente na data na enturmação oficial.");
  const ep = enrollmentState === "vigente" ? live![0]! : null;
  if (ep && p.student.class_id && ep.classId !== p.student.class_id) lim.push("Turma da designação difere da enturmação oficial: prevalece a enturmação.");

  const guidance = p.records === null ? null : currentGuidance(p.records, p.student.student_id, p.date);
  if (guidance === null) lim.push("Orientações do NEI não lidas.");
  const pick = (types: Set<string>) => guidance === null ? null : guidance.filter((g) => types.has(g.type) && g.text).map((g) => g.text!);

  const timeline: StudentFile["timeline"] = [];
  for (const e of p.episodes ?? []) {
    timeline.push({ date: e.from, label: `Entrada na turma ${e.className ?? e.classId}`, source: "matricula" });
    if (e.to) timeline.push({ date: e.to, label: `Saída da turma ${e.className ?? e.classId}`, source: "matricula" });
  }
  for (const v of p.designationChain ?? []) timeline.push({ date: v.recordedAt.slice(0, 10), label: v.kind === "encerramento" ? `Designação encerrada (até ${v.to})` : v.kind === "retificacao" ? "Designação retificada" : "Designação registrada", source: "designacao" });
  if (p.designationChain === null) lim.push("Histórico da designação não lido.");
  for (const g of guidance ?? []) if (g.since) timeline.push({ date: g.since, label: g.withheld ? "Orientação do NEI (conteúdo restrito)" : "Orientação do NEI vigente", source: "orientacao" });
  timeline.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    identification: {
      name: p.student.student_name, schoolId: p.student.school_id,
      classId: ep?.classId ?? p.student.class_id, className: ep?.className ?? null, shift: ep?.shift ?? null,
      designationFrom: p.student.valid_from, designationTo: p.student.valid_to,
    },
    enrollmentState, guidance, resources: pick(RESOURCE_TYPES), routines: pick(ROUTINE_TYPES),
    contacts: p.contacts.filter((c) => c.href.startsWith("/")), timeline, limitations: lim,
  };
}

export const DEFAULT_CONTACTS: InstitutionalContact[] = [
  { role: "NEI", label: "Núcleo de Educação Inclusiva", channel: "protocolo-nei", href: "/inclusao/nei/protocolos" },
  { role: "Orientação", label: "Solicitar orientação de apoio", channel: "orientacao", href: "/inclusao/nei/apoio" },
];
