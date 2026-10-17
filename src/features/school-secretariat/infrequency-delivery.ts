import { parseBoundary, z } from "@/lib/runtime-shape";
import type { InfrequencyRow } from "./infrequency-notice";

export const issuedNoticeSchema = z.object({
  notice_id: z.string().uuid(),
  delivery_status: z.enum(["configuration-missing", "delivery-denied", "available-in-app", "no-authorized-recipient"]),
  deliveries: z.number().int().nonnegative(),
  present: z.number().int().nonnegative(), absent: z.number().int().nonnegative(),
  threshold: z.number(), period_from: z.string(), period_to: z.string(), recorded_on: z.string(),
}).superRefine((r, ctx) => {
  if ((r.delivery_status === "available-in-app") !== (r.deliveries > 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inconsistent delivery count" });
  if (r.present + r.absent === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "No attendance source" });
});
export type IssuedNotice = z.infer<typeof issuedNoticeSchema>;
export const readIssuedNotice = (raw: unknown) => parseBoundary(issuedNoticeSchema, raw, "secretariat_issue_infrequency_notice");
/** PDF uses immutable issued counts, not stale screen data. */
export function issuedNoticeRow(student: Pick<InfrequencyRow, "student_id" | "student_name">, issued: IssuedNotice): InfrequencyRow {
  return { ...student, present: issued.present, absent: issued.absent, threshold: issued.threshold,
    rate: Math.round(1000 * issued.present / (issued.present + issued.absent)) / 10, last_notice: issued.recorded_on };
}
export const DELIVERY_MESSAGES: Record<IssuedNotice["delivery_status"], string> = {
  "configuration-missing": "Aviso registrado. A comunicação digital ainda não tem modelo e destinatários configurados; entregue o PDF ao responsável.",
  "delivery-denied": "Aviso registrado. Sua conta não pode enviar a comunicação digital; entregue o PDF ao responsável.",
  "no-authorized-recipient": "Aviso registrado. Não há destinatário autorizado para receber a comunicação digital; entregue o PDF ao responsável.",
  "available-in-app": "Aviso registrado e disponível nos avisos dos destinatários autorizados. Isso não confirma leitura nem recebimento do PDF.",
};
