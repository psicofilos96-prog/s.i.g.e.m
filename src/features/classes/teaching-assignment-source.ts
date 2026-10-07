/**
 * B4.8 — Fonte canônica da atribuição docente (somente leitura).
 * Única porta TS para `teaching_assignments_at(classId, validOn, knownAt)`. O elo é
 * turma ↔ elemento de matriz aplicável (versão + item) ↔ atuação. Nunca infere professor
 * por horário, nome, disciplina textual ou lotação. Writer existe no banco, mas fechado:
 * nenhuma política concede `manter-atribuicao-docente`.
 */
import { supabase } from "@/integrations/supabase/client";

export const TEACHING_ASSIGNMENT_CAPABILITY = "manter-atribuicao-docente";

export type AssignmentState = "vigente" | "matriz-nao-aplicavel-na-data" | "atuacao-nao-vigente" | "elemento-inexistente";
const STATES: readonly AssignmentState[] = ["vigente", "matriz-nao-aplicavel-na-data", "atuacao-nao-vigente", "elemento-inexistente"];

export type RawAssignmentRow = {
  assignment_id: string; version_id: string; version: number; change_kind: string;
  effective_from: string; effective_until: string | null; engagement_id: string; person_id: string | null;
  matrix_id: string; matrix_version_id: string; item_key: string;
  component_id: string | null; component_label_snapshot: string | null; element_value_id: string | null;
  role_value_id: string | null; source_ref: string | null; change_reason: string | null; recorded_at: string;
  assignment_state: string; co_assigned_engagement_ids: string[] | null;
};

export type TeachingAssignment = {
  assignmentId: string; versionId: string; version: number; changeKind: string;
  from: string; until: string | null; engagementId: string; personId: string | null;
  matrixId: string; matrixVersionId: string; itemKey: string; elementLabel: string | null; roleValueId: string | null;
  sourceRef: string | null; state: AssignmentState; coAssignedCount: number;
};

export class AssignmentShapeError extends Error {}

export function mapAssignmentRows(rows: RawAssignmentRow[]): TeachingAssignment[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    if (!STATES.includes(r.assignment_state as AssignmentState)) throw new AssignmentShapeError(`estado desconhecido: ${r.assignment_state}`);
    if (seen.has(r.assignment_id)) throw new AssignmentShapeError("mais de uma versão efetiva para a mesma atribuição");
    seen.add(r.assignment_id);
    return {
      assignmentId: r.assignment_id, versionId: r.version_id, version: r.version, changeKind: r.change_kind,
      from: r.effective_from, until: r.effective_until, engagementId: r.engagement_id, personId: r.person_id,
      matrixId: r.matrix_id, matrixVersionId: r.matrix_version_id, itemKey: r.item_key,
      // Rótulo só se declarado no item da matriz; identificador nunca é traduzido.
      elementLabel: r.component_label_snapshot,
      roleValueId: r.role_value_id, sourceRef: r.source_ref,
      state: r.assignment_state as AssignmentState, coAssignedCount: r.co_assigned_engagement_ids?.length ?? 0,
    };
  });
}

export async function readTeachingAssignments(classId: string, validOn: string, knownAt: string): Promise<TeachingAssignment[]> {
  if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(validOn) || Number.isNaN(Date.parse(knownAt))) throw new Error("assignment:time-required");
  const { data, error } = await supabase.rpc("teaching_assignments_at" as never, { _class_id: classId, _on: validOn, _known_at: knownAt } as never);
  if (error) throw error;
  return mapAssignmentRows((data ?? []) as RawAssignmentRow[]);
}

export const ASSIGNMENT_STATE_TEXT: Record<AssignmentState, string> = {
  vigente: "Vigente",
  "matriz-nao-aplicavel-na-data": "A matriz não se aplica à turma nesta data",
  "atuacao-nao-vigente": "A atuação do profissional não está vigente nesta data",
  "elemento-inexistente": "O elemento não existe na versão da matriz",
};

export function humanAssignmentError(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (m.includes("capability:")) return "Nenhuma atuação sua tem competência para atribuir docentes; essa competência ainda não foi definida.";
  if (m.includes("stale-head")) return "A atribuição mudou desde que você abriu a tela. Recarregue antes de continuar.";
  if (m.includes("overlap")) return "Esta atuação já está atribuída a este elemento em período que se sobrepõe.";
  if (m.includes("matrix-not-applicable")) return "A matriz escolhida não se aplica à turma em todo o período informado.";
  if (m.includes("element-not-in-matrix")) return "O elemento escolhido não pertence a essa versão da matriz.";
  if (m.includes("engagement")) return "A atuação escolhida não é da escola da turma ou não está vigente em todo o período.";
  if (m.includes("reason-required")) return "Informe o motivo da correção ou substituição.";
  return "Não foi possível consultar as atribuições docentes.";
}
