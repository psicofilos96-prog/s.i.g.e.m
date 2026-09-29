/**
 * Persistência real do parecer descritivo (Lovable Cloud).
 * A cadeia é lida do banco e adaptada ao mesmo `DescriptiveReportRepository`,
 * para que `conferReport` continue sendo a única regra de conferência.
 * Oficializar chama UMA função transacional que revalida capacidade, base
 * vigente e alteração; nada é gravado parcialmente.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  DescriptiveReportRepository,
  DescriptiveReportVersion,
  ReportConference,
  ReportFailure,
  ReportKey,
} from "./infant-descriptive-report";

export const OFFICIALIZE_REPORT_CAPABILITY = "oficializar-parecer-descritivo";

type Row = {
  id: string;
  logical_report_id: string;
  version_number: number;
  supersedes_version_id: string | null;
  student_id: string;
  class_id: string;
  period_id: string;
  report_text: string;
  objective_ids: string[];
  correction_reason: string | null;
  author_person_id: string;
  authorizing_engagement_id: string;
  officialized_at: string;
};

function toVersion(r: Row): DescriptiveReportVersion {
  return {
    id: r.id,
    logicalReportId: r.logical_report_id,
    versionNumber: r.version_number,
    ...(r.supersedes_version_id ? { supersedesVersionId: r.supersedes_version_id } : {}),
    studentId: r.student_id,
    classId: r.class_id,
    periodId: r.period_id,
    text: r.report_text,
    objectiveIds: r.objective_ids,
    author: { personId: r.author_person_id, engagementId: r.authorizing_engagement_id, demonstrative: false },
    officializedAt: r.officialized_at,
    ...(r.correction_reason ? { correctionReason: r.correction_reason } : {}),
  };
}

export async function fetchReportChain(key: ReportKey): Promise<DescriptiveReportVersion[]> {
  const { data, error } = await supabase
    .from("descriptive_report_versions")
    .select("*")
    .eq("student_id", key.studentId)
    .eq("class_id", key.classId)
    .eq("period_id", key.periodId)
    .order("version_number");
  if (error) throw error;
  return (data as Row[]).map(toVersion);
}

/** Instantâneo somente leitura para a regra de conferência. */
export function snapshotRepository(chain: readonly DescriptiveReportVersion[]): DescriptiveReportRepository {
  return {
    chain: () => chain,
    append: () => {
      throw new Error("Instantâneo somente leitura: oficialização é transacional no Cloud.");
    },
    subscribe: () => () => {},
    reset: () => {},
  };
}

const MESSAGES: Record<string, string> = {
  "not-authenticated": "Entre no SIGEM para oficializar.",
  "capability-missing": "Sua atuação vigente não concede, pela política homologada, a oficialização deste parecer. Nada foi gravado.",
  "concurrent-change": "O parecer vigente mudou depois da conferência. Nada foi gravado; confira novamente.",
  "correction-reason-required": "Informe o motivo da nova versão.",
  "no-change": "Nada mudou em relação à versão vigente.",
  "empty-text": "Escreva o texto do parecer antes de oficializar.",
};

export async function officializeReportInCloud(
  conference: ReportConference,
): Promise<{ ok: true; id: string } | ReportFailure> {
  const { data, error } = await supabase.rpc("officialize_descriptive_report", {
    _student: conference.key.studentId,
    _class: conference.key.classId,
    _period: conference.key.periodId,
    _base_version_id: conference.baseVersionId as string,
    _text: conference.draft.text,
    _objective_ids: [...conference.draft.objectiveIds],
    _reason: conference.draft.correctionReason ?? "",
  });
  if (error) {
    const code = Object.keys(MESSAGES).find((c) => error.message.includes(c)) ??
      (error.message.includes("objective-not-in-matrix") ? "objective-not-in-matrix" : "unknown");
    return { ok: false, code, message: MESSAGES[code] ?? "Não foi possível oficializar; nada foi gravado." };
  }
  return { ok: true, id: data as string };
}
