import { z } from "@/lib/runtime-shape";
import { FAMILY_SECTIONS } from "./family-portal";

const section = z.enum(FAMILY_SECTIONS);
export const familyStudentsSchema = z.array(z.object({
  student_id: z.string().min(1), display_name: z.string().nullable(), sections: z.array(section), valid_until: z.string().nullable(),
})).nullable().transform((v) => v ?? []);
export const familySummarySchema = z.object({
  sections: z.array(section),
  enrollments: z.array(z.object({ school: z.string(), opened_on: z.string().nullable(), ended_on: z.string().nullable(),
    classes: z.array(z.object({ class: z.string(), from: z.string(), until: z.string().nullable() })) })).nullable(),
  documents: z.array(z.object({ kind: z.string(), emission: z.string(), emitted_at: z.string(), number: z.string().nullable(), verification_code: z.string() })).nullable(),
});
