import { z, parseBoundary } from "@/lib/runtime-shape";
const date = z.string().nullable();
const sources = z.array(z.object({
  school_id: z.string(),
  enrollments: z.array(z.object({ id: z.string(), student_id: z.string(), opened_on: date, ended_on: date })),
  participations: z.array(z.object({ id: z.string(), version: z.number(), valid_from: z.string(), valid_until: date, annulled: z.boolean() })),
  allocations: z.array(z.object({ id: z.string(), student_id: z.string(), class_id: z.string(), valid_from: z.string(), ended_on: date })),
  movements: z.array(z.object({ id: z.string(), version: z.number(), movement_type_id: z.string(), effective_on: date, school_scope_ids: z.array(z.string()) })),
}));
export const parseNetworkSources = (raw: unknown) => parseBoundary(sources, raw, "network-projection-sources");
