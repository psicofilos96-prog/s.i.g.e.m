import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOLLOWUP_IMAGE_ACCEPT, followupImageError, type PendingVisitImage } from "./attachment-upload";

function ImagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? <img src={url} alt={file.name} className="h-24 w-full object-cover" /> : null;
}

export function VisitImagePicker({ images, onChange, disabled }: {
  images: PendingVisitImage[]; onChange: (images: PendingVisitImage[]) => void; disabled: boolean;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  return <section className="space-y-3" aria-label="Imagens da nova visita">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Imagens anexas <span className="font-normal text-muted-foreground">(opcional)</span></h4>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
        <ImagePlus className="mr-2 size-4" />Adicionar imagens
      </Button>
    </div>
    <input ref={input} type="file" multiple accept={FOLLOWUP_IMAGE_ACCEPT} disabled={disabled}
      className="hidden" aria-label="Selecionar imagens da visita" onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        const invalid = files.map(followupImageError).find(Boolean);
        e.target.value = "";
        if (invalid) { setError(invalid); return; }
        setError("");
        onChange([...images, ...files.map((file) => ({ file, request: crypto.randomUUID(), uploaded: false, registered: false }))]);
      }} />
    <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, até 5 MB por imagem. Evite fotos de estudantes e documentos pessoais.</p>
    {images.length > 0 && <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((image) => <li key={image.request} className="min-w-0 overflow-hidden rounded-md border border-border">
        <ImagePreview file={image.file} />
        <div className="flex items-center gap-1 p-2">
          <span className="min-w-0 flex-1 truncate text-xs" title={image.file.name}>{image.file.name}</span>
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" disabled={disabled}
            aria-label={`Remover imagem ${image.file.name}`} title="Remover imagem"
            onClick={() => onChange(images.filter((entry) => entry.request !== image.request))}><X className="size-3.5" /></Button>
        </div>
      </li>)}
    </ul>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}