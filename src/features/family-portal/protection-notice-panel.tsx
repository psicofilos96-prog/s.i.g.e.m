import { useQuery } from "@tanstack/react-query";
import { StatePanel } from "@/components/sigem/patterns";
import { callRpc } from "@/lib/rpc-call";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { useSessionAuthority } from "@/features/authority/session-authority";
export const protectionNoticeSchema = z.boolean();
export function ProtectionNoticePanel({ studentId }: { studentId: string }) {
  const authority = useSessionAuthority();
  const uid = authority.status === "signed-in" ? authority.user.id : null;
  const q = useQuery({ queryKey: ["family-protection-notice", uid, studentId], enabled: !!uid, gcTime: 0, queryFn: async () => parseBoundary(protectionNoticeSchema, await callRpc("family_protection_notice", { _student: studentId }), "family_protection_notice"), retry: false, refetchOnWindowFocus: false });
  if (q.isError) return <p role="alert" className="text-sm text-destructive">Não foi possível consultar os avisos de retirada. Procure a Secretaria.</p>;
  if (!q.data) return null;
  return <StatePanel tone="warning" title="Orientação sobre retirada" description="Há uma orientação da escola sobre a retirada deste educando. Entre em contato com a Secretaria antes de organizar a retirada." />;
}
