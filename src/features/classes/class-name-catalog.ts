import { supabase } from "@/integrations/supabase/client";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { readPages } from "@/lib/list-paging";

export const classNameOptionSchema = z.object({
  entry_id: z.string().uuid(), code: z.string().min(1), name: z.string().min(1),
  modality_label: z.string(), series_labels: z.array(z.string()),
  ordinal_label: z.string(), catalog_version: z.number().int().positive(),
});
export type ClassNameOption = z.infer<typeof classNameOptionSchema>;

export async function readClassNameOptions(year: string, signal?: AbortSignal): Promise<ClassNameOption[]> {
  const page = await readPages<unknown>((from, to) => {
    let q = supabase.rpc("class_name_catalog_for_year", { _year: year }).order("entry_id").range(from, to);
    if (signal) q = q.abortSignal(signal);
    return q;
  }, 10000);
  if (page.error) throw new Error(page.error.message);
  if (page.truncated) throw new Error("class-name-catalog:truncated");
  return parseBoundary(z.array(classNameOptionSchema), page.data, "class-name-options");
}

export function chooseClassName(options: readonly ClassNameOption[], id: string) {
  const option = options.find((x) => x.entry_id === id);
  if (!option) return null;
  return { name: option.name, code: option.code };
}