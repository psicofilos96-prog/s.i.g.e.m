/** DocServ — arquivos: leitura de texto do PDF no navegador (sugestão) e ZIP restrito com auditoria. */
import { supabase } from "@/integrations/supabase/client";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { suggestFromText, type Extraction } from "./docserv-rules";

export const ZIP_MAX = 50;

export async function extractPdfSuggestion(file: File): Promise<Extraction | null> {
  if (file.type !== "application/pdf") return null;
  try {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let text = "";
    for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
      const page = await doc.getPage(i);
      const c = await page.getTextContent();
      text += " " + c.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    }
    return suggestFromText(text);
  } catch { return null; }
}

/** ZIP só com arquivos que o banco autoriza: registra o lote (recusa se algum não for legível) e baixa por URL curta. */
export async function downloadZip(items: { document_id: string; path: string; label: string }[], name: string): Promise<string | null> {
  if (!items.length) return "Nada para baixar.";
  if (items.length > ZIP_MAX) return `Máximo de ${ZIP_MAX} documentos por ZIP.`;
  const log = await supabase.rpc("docserv_log_download", { _documents: items.map((i) => i.document_id), _zip: true });
  if (log.error) return "Sem permissão para baixar algum destes documentos.";
  const { zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  for (const [n, it] of items.entries()) {
    const s = await supabase.storage.from("docserv-documentos").createSignedUrl(it.path, SIGNED_URL_TTL_SECONDS);
    if (s.error || !s.data) return "Arquivo indisponível no lote.";
    const r = await fetch(s.data.signedUrl); if (!r.ok) return "Falha ao baixar arquivo do lote.";
    const ext = it.path.split(".").pop() ?? "bin";
    files[`${String(n + 1).padStart(2, "0")}-${it.label.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60)}.${ext}`] = new Uint8Array(await r.arrayBuffer());
  }
  const blob = new Blob([zipSync(files)], { type: "application/zip" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return null;
}
