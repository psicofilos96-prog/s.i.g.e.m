import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sessionContextKey, useSessionAuthority } from "@/features/authority/session-authority";
import { withListTimeout, pageRange, LIST_PAGE_SIZE } from "@/lib/server-page";
import { parseBoundary, z } from "@/lib/runtime-shape";

export const engagementSchema = z.object({
  id: z.string(), person_id: z.string(), engagement_kind_id: z.string(),
  scope_level: z.string().nullable(), school_id: z.string().nullable(),
  valid_from: z.string(), valid_until: z.string().nullable(), originating_act_ref: z.string().nullable(),
});
const accountSchema = z.object({
  user_id: z.string(), person_id: z.string(), login: z.string().nullable(), password_change_required: z.boolean(),
});

/** Only the requested page plus one look-ahead row; canonical readers and RLS remain authoritative. */
export async function readAdminList(kind: "accounts" | "engagements", page: number, signal: AbortSignal) {
  return withListTimeout(signal, async (s) => {
    const { from, to } = pageRange(page);
    if (kind === "accounts") {
      const r = await supabase.rpc("admin_account_overview").not("person_id", "is", null)
        .order("login").order("user_id").range(from, to + 1).abortSignal(s);
      if (r.error) throw r.error;
      const rows = parseBoundary(z.array(accountSchema), r.data, "admin-account-page");
      return { engagements: [] as z.infer<typeof engagementSchema>[], accounts: rows.slice(0, LIST_PAGE_SIZE).map((a) => ({ userId: a.user_id, personId: a.person_id, login: a.login, passwordChangeRequired: a.password_change_required })), hasNext: rows.length > LIST_PAGE_SIZE };
    }
    const r = await supabase.from("institutional_engagements")
      .select("id, person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until, originating_act_ref")
      .order("id").range(from, to + 1).abortSignal(s);
    if (r.error) throw r.error;
    const rows = parseBoundary(z.array(engagementSchema), r.data, "admin-engagement-page");
    return { accounts: [] as { userId: string; personId: string; login: string | null; passwordChangeRequired: boolean }[], engagements: rows.slice(0, LIST_PAGE_SIZE), hasNext: rows.length > LIST_PAGE_SIZE };
  });
}

export function useAdminList(kind: "accounts" | "engagements", page: number) {
  const authority = useSessionAuthority();
  const capability = kind === "accounts" ? "manter-contas-institucionais" : "manter-atuacoes-institucionais";
  return useQuery({
    queryKey: ["admin-list", sessionContextKey(authority), kind, page],
    enabled: authority.status === "signed-in" && authority.capabilities.some((c) => c.capabilityId === capability),
    retry: false, staleTime: 60_000,
    queryFn: ({ signal }) => readAdminList(kind, page, signal),
  });
}