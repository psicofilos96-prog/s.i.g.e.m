import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PHOTO_OUT, cameraErrorMessage, cropRect, type Crop } from "./photo-crop";

/**
 * NCARD.1 — foto 3×4 pela câmera (celular/webcam) ou envio de arquivo, com enquadramento.
 * A imagem só sai do aparelho quando a pessoa confirma; o resultado é um JPEG 600×800.
 */
export function PhotoCapture({ busy, onConfirm }: { busy: boolean; onConfirm: (jpeg: Blob, origin: "camera" | "arquivo") => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [img, setImg] = useState<{ el: HTMLImageElement | HTMLCanvasElement; w: number; h: number; origin: "camera" | "arquivo" } | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, dx: 0, dy: 0 });
  const preview = useRef<HTMLCanvasElement>(null);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  useEffect(() => { if (video.current && stream) video.current.srcObject = stream; }, [stream]);

  async function openCamera() {
    setCamErr(null);
    if (!navigator.mediaDevices?.getUserMedia) { setCamErr(cameraErrorMessage("unsupported")); return; }
    try { setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })); }
    catch (e) { setCamErr(cameraErrorMessage((e as DOMException).name ?? "")); }
  }
  function stopCamera() { stream?.getTracks().forEach((t) => t.stop()); setStream(null); }
  function snap() {
    const v = video.current; if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setImg({ el: c, w: c.width, h: c.height, origin: "camera" }); setCrop({ zoom: 1, dx: 0, dy: 0 }); stopCamera();
  }
  function pickFile(f: File | undefined) {
    if (!f) return;
    const url = URL.createObjectURL(f); const el = new Image();
    el.onload = () => { setImg({ el, w: el.naturalWidth, h: el.naturalHeight, origin: "arquivo" }); setCrop({ zoom: 1, dx: 0, dy: 0 }); URL.revokeObjectURL(url); };
    el.onerror = () => { setCamErr("Não foi possível ler esta imagem. Use JPG ou PNG."); URL.revokeObjectURL(url); };
    el.src = url;
  }
  function draw(target: HTMLCanvasElement, w: number, h: number) {
    if (!img) return;
    const r = cropRect(img.w, img.h, crop); target.width = w; target.height = h;
    target.getContext("2d")!.drawImage(img.el, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
  }
  useEffect(() => { if (preview.current) draw(preview.current, 150, 200); }); // eslint-disable-line react-hooks/exhaustive-deps
  function confirm() {
    if (!img) return;
    const c = document.createElement("canvas"); draw(c, PHOTO_OUT.w, PHOTO_OUT.h);
    c.toBlob((b) => { if (b) onConfirm(b, img.origin); }, "image/jpeg", 0.88);
  }
  const slider = (label: string, k: keyof Crop, min: number, max: number) => (
    <label className="block text-sm">{label}
      <input type="range" aria-label={label} className="block w-full" min={min} max={max} step={0.01} value={crop[k]} onChange={(e) => setCrop({ ...crop, [k]: Number(e.target.value) })} />
    </label>);

  return (
    <div className="space-y-3 rounded-md border p-3" aria-label="Foto 3x4">
      <div className="flex flex-wrap gap-2">
        {!stream && <Button type="button" variant="outline" onClick={() => void openCamera()}>Usar câmera</Button>}
        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm">Enviar foto do aparelho
          <input type="file" accept="image/jpeg,image/png" capture="user" className="sr-only" aria-label="Enviar foto do aparelho" onChange={(e) => pickFile(e.target.files?.[0])} />
        </label>
      </div>
      {camErr && <p role="alert" className="text-sm text-destructive">{camErr}</p>}
      {stream && (
        <div className="space-y-2">
          <video ref={video} autoPlay playsInline muted className="aspect-[3/4] w-48 rounded border bg-muted object-cover" aria-label="Imagem da câmera" />
          <div className="flex gap-2"><Button type="button" onClick={snap}>Tirar foto</Button><Button type="button" variant="ghost" onClick={stopCamera}>Fechar câmera</Button></div>
        </div>)}
      {img && (
        <div className="flex flex-wrap items-start gap-4">
          <canvas ref={preview} className="aspect-[3/4] w-[150px] rounded border" aria-label="Prévia do enquadramento 3x4" />
          <div className="w-56 space-y-2">
            {slider("Aproximar", "zoom", 1, 4)}{slider("Mover na horizontal", "dx", -1, 1)}{slider("Mover na vertical", "dy", -1, 1)}
            <Button type="button" disabled={busy} onClick={confirm}>Salvar foto</Button>
          </div>
        </div>)}
    </div>
  );
}
