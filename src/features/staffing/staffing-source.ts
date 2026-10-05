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
      engagementIds: (x["engagement_ids"] as string[] | null) ?? [], usable: x["block_state"] === "utilizavel" || x["block_state"] === "usable" || x["block_state"] === "valido" }));
    const assignments: Assignment[] | null = a == null ? null : a.map((x) => ({ assignmentId: String(x["assignment_id"]), componentId: (x["component_id"] as string) ?? null,
      engagementId: String(x["engagement_id"]), personId: (x["person_id"] as string) ?? null, vigente: x["assignment_state"] === "vigente" }));
    out.push({ classId: id, label: (rows(rec)?.[0]?.["name"] as string) ?? null, blocks, assignments });
  } }));
  return out;
}
