import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { presentError } from "@/lib/observability/governed-errors";
import { recordFollowupAttachment, type FollowupAttachment } from "./source";

const BUCKET = "followup-attachments";
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/** URLs assinadas de curta duração para as imagens já autorizadas pela RPC. */
function useSignedUrls(paths: readonly string[]) {
  const key = paths.slice().sort().join("|");
  return useQuery({
    queryKey: ["followup-attachment-urls", key],
    enabled: paths.length > 0,
    retry: false,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const entries = await Promise.all(paths.map(async (path) => {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
        return [path, error ? null : data.signedUrl] as const;
      }));
      return new Map(entries);
    },
  });
}

/**
 * Imagens anexadas a uma visita registrada. O envio vai ao armazenamento privado
 * no caminho <escola>/<chave-idempotente> e só então é registrado pela RPC, que
 * revalida a competência de escrita. Anexos são permanentes, como o histórico.
 */
export function VisitAttachments({
  schoolId, visitId, canRecord, attachments, onChanged,
}: {
  schoolId: string;
  visitId: string;
  canRecord: boolean;
  attachments: readonly FollowupAttachment[];
  onChanged: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const own = attachments.filter((a) => a.visit_id === visitId);
  const urls = useSignedUrls(own.map((a) => a.storage_path));

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      setError("A imagem precisa ser PNG, JPEG ou WebP.");
      return;
    }
    if (file.size < 1 || file.size > MAX_BYTES) {
      setError("A imagem precisa ter no máximo 5 MB.");
      return;
    }
    setUploading(true);
    setError("");
    const request = crypto.randomUUID();
    const path = `${schoolId}/${request}`;
    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);
      await recordFollowupAttachment({
        visit: visitId, path, contentType: file.type, size: file.size, request,
      });
      await onChanged();
    } catch (e) {
      setError(presentError(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2" aria-label="Imagens anexadas à visita">
      {own.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {own.map((a) => {
            const url = urls.data?.get(a.storage_path);
            return (
              <li key={a.id} className="space-y-1">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={a.caption ?? "Imagem anexada à visita"}
                      className="h-24 w-24 rounded-lg border border-border/60 object-cover shadow-sm" />
                  </a>
                ) : (
                  <div className="grid h-24 w-24 place-items-center rounded-lg border border-border/60 bg-muted/40 text-xs text-muted-foreground">
                    {urls.isPending ? "Carregando…" : "Indisponível"}
                  </div>
                )}
                <p className="max-w-24 truncate text-xs text-muted-foreground">
                  {a.author_name || "Autoria registrada"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {canRecord && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            aria-label="Selecionar imagem para anexar"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }} />
          <Button type="button" size="sm" variant="outline" disabled={uploading}
            onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
            {uploading ? "Enviando imagem…" : "Adicionar imagem"}
          </Button>
          <span className="text-xs text-muted-foreground">PNG, JPEG ou WebP, até 5 MB. O anexo é permanente.</span>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
