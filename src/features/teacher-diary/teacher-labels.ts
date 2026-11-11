import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { readDiaryWithDeadline } from "./diary-read";
import { useSessionAuthority } from "@/features/authority/session-authority";

export function useTeacherLabels(classIds: string[], on: string) {
  const authority = useSessionAuthority();
  const ids = [...new Set(classIds)].sort();
  return useQuery({
    queryKey: ["teacher-labels", authority.status === "signed-in" ? authority.user.id : null, authority.status === "signed-in" ? authority.sessionRevision : null, ids, on],
    enabled: authority.status === "signed-in" && !!authority.person && ids.length > 0,
    retry: false,
    staleTime: 60_000,
    queryFn: () => readDiaryWithDeadline(async () => {
      const knownAt = new Date().toISOString();
      const [classes, labels] = await Promise.all([
        Promise.all(ids.map(async (id) => {
          const response = await supabase.rpc("class_at", { _class_id: id, _on: on, _known_at: knownAt });
          if (response.error) throw response.error;
          const rows = parseBoundary(z.array(z.object({ name: z.string() })), response.data, "teacher-class-label");
          return [id, rows.length === 1 ? rows[0]?.name ?? "Turma sem nome disponível" : "Turma sem nome disponível"] as const;
        })),
        supabase.from("attribute_value_definitions").select("value_id,label,version").eq("scheme_id", "elemento-de-matriz-curricular").eq("status", "homologada").order("version"),
      ]);
      if (labels.error) throw labels.error;
      const values = parseBoundary(z.array(z.object({ value_id: z.string(), label: z.string().nullable(), version: z.number() })), labels.data, "teacher-element-labels");
      return { classes: new Map(classes), elements: new Map(values.flatMap((r) => r.label ? [[r.value_id, r.label] as const] : [])) };
    }),
  });
}