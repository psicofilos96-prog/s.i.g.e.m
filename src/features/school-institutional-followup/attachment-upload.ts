import { supabase } from "@/integrations/supabase/client";
import { recordFollowupAttachment } from "./source";

export const FOLLOWUP_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export function followupImageError(file: File): string | null {
  if (!FOLLOWUP_IMAGE_ACCEPT.split(",").includes(file.type)) return "Escolha uma imagem PNG, JPEG ou WebP.";
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return "Cada imagem precisa ter no máximo 5 MB.";
  return null;
}
export type PendingVisitImage = {
  file: File; request: string; uploaded: boolean; registered: boolean;
};

/** Stable paths and receipts survive retries; never overwrite an existing object. */
export async function uploadVisitImage(school: string, visit: string, image: PendingVisitImage) {
  const issue = followupImageError(image.file);
  if (issue) throw new Error(issue);
  if (image.registered) return;
  const path = `${school}/${image.request}`;
  if (!image.uploaded) {
    const { error } = await supabase.storage.from("followup-attachments").upload(path, image.file, {
      contentType: image.file.type, upsert: false,
    });
    // An interrupted response can leave the object stored. The canonical RPC
    // rechecks its ownership, size, type and authority before accepting it.
    if (error && String(error.statusCode) !== "409") throw error;
    image.uploaded = true;
  }
  await recordFollowupAttachment({ visit, path, contentType: image.file.type,
    size: image.file.size, request: image.request });
  image.registered = true;
}