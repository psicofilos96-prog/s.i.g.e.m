import { parseBoundary, z } from "@/lib/runtime-shape";
import { attachmentUrl, planAttachments } from "./planning-source";

export const ATTACHMENT_READ_TIMEOUT_MS = 15_000;
const attachmentRows = z.array(z.object({
  id: z.string().min(1), label: z.string(), object_path: z.string().min(1),
  revoked: z.boolean(), supersedes_id: z.string().nullable(),
}));
export async function readAttachmentWithDeadline<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("plan-attachment-timeout")), ATTACHMENT_READ_TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timer); }
}
export const readPlanAttachments = (planId: string) => readAttachmentWithDeadline(async () =>
  parseBoundary(attachmentRows, await planAttachments(planId), "plan-attachments"));
export const readAttachmentUrl = (path: string) => readAttachmentWithDeadline(async () =>
  parseBoundary(z.string().url().refine((value) => new URL(value).protocol === "https:"), await attachmentUrl(path), "plan-attachment-url"));