import { supabase } from "@/integrations/supabase/client";
import type { Assignment, Block, ClassInput } from "./staffing-model";

type R = { data: unknown; error: unknown };
const rows = (r: R) => (r.error ? null : ((r.data ?? []) as Record<string, unknown>[]));
const rpc = (fn: string, a: Record<string, unknown>) => supabase.rpc(fn as never, a as never) as unknown as Promise<R>;
const CONCURRENCY = 6;

/** Lê grade e regência por turma com UM knownAt para o lote inteiro. */
export async function loadStaffingInputs(schoolId: string, validOn: string, knownAt: string): Promise<ClassInput[] | null> {
  const cls = await supabase.from("institutional_classes").select("id").eq("school_id", schoolId);
  if (cls.error) return null;
  const ids = (cls.data ?? []).map((x) => x.id as string);
  const out: ClassInput[] = []; let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < ids.length) { const id = ids[i++]!;
    const o = { _class_id: id, _on: validOn, _known_at: knownAt };
    const [sch, asg, rec] = await Promise.all([rpc("class_schedule_at", o), rpc("teaching_assignments_at", o), rpc("class_at", { _class_id: id, _valid_on: validOn, _known_at: knownAt })]);
    const s = rows(sch), a = rows(asg);
    const blocks: Block[] | null = s == null ? null : s.filter((x) => x["block_key"]).map((x) => ({
      blockKey: String(x["block_key"]), componentId: (x["component_id"] as string) ?? null, minutes: Number(x["block_minutes"] ?? 0),
      engagementIds: (x["engagement_ids"] as string[] | null) ?? [], usable: x["block_state"] === "utilizavel" && x["schedule_state"] === "utilizavel" }));
    const assignments: Assignment[] | null = a == null ? null : a.map((x) => ({ assignmentId: String(x["assignment_id"]), componentId: (x["component_id"] as string) ?? null,
      engagementId: String(x["engagement_id"]), personId: (x["person_id"] as string) ?? null, vigente: x["assignment_state"] === "vigente" }));
    out.push({ classId: id, label: (rows(rec)?.[0]?.["name"] as string) ?? null, blocks, assignments });
  } }));
  return out;
}

import type { ClassCurriculum, MatrixItem, ScheduleRow } from "./teacher-need";

/** X: matriz aplicável por turma (class_curricular_matrices_at) + itens; null = leitura falhou. */
export async function loadCurricula(schoolId: string, classIds: readonly string[], validOn: string, knownAt: string): Promise<ClassCurriculum[]> {
  return Promise.all(classIds.map(async (id): Promise<ClassCurriculum> => {
    const m = rows(await rpc("class_curricular_matrices_at", { _school: schoolId, _class_id: id, _on: validOn, _known_at: knownAt }));
    if (m == null) return null;
    const ms = m.filter((x) => x["result_kind"] !== "access-denied" && x["matrix_id"]);
    const versions = ms.map((x) => String(x["matrix_version_id"]));
    const items: MatrixItem[] = [];
    for (const x of ms) {
      const it = rows(await rpc("curricular_matrix_items_at", { _matrix: x["matrix_id"], _on: validOn, _known_at: knownAt }));
      if (it == null) return { classId: id, matrixVersionIds: versions, items: null };
      it.forEach((r) => items.push({ matrixVersionId: String(r["matrix_version_id"] ?? x["matrix_version_id"]), itemKey: String(r["item_key"]),
        componentId: (r["component_id"] as string) ?? null, quantity: r["quantity"] == null ? null : Number(r["quantity"]), unitValueId: (r["unit_value_id"] as string) ?? null }));
    }
    return { classId: id, matrixVersionIds: versions, items };
  }));
}

/** X: blocos atribuídos por vínculo (titular ou substituição válida) via school_teaching_schedule_at; null = negado/ilegível. */
export async function loadScheduleRows(schoolId: string, validOn: string, knownAt: string): Promise<ScheduleRow[] | null> {
  const r = rows(await rpc("school_teaching_schedule_at", { _school_id: schoolId, _on: validOn, _known_at: knownAt }));
  if (r == null || r.some((x) => x["result_kind"] === "access-denied")) return null;
  return r.filter((x) => x["result_kind"] === "block").map((x) => ({ personId: String(x["person_id"]), engagementId: String(x["engagement_id"]), classId: String(x["class_id"]),
    componentKey: (x["item_key"] as string) ?? null, blockId: String(x["block_id"]), minutes: Number(x["block_minutes"] ?? 0), conflict: ((x["conflict_with_block_ids"] as unknown[]) ?? []).length > 0 }));
}
