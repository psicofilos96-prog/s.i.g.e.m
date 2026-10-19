import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";

export type LogoImage = { dataUrl: string; format: "PNG" | "JPEG" | "WEBP"; version: number };

const FORMAT: Record<string, LogoImage["format"]> = { "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP" };

/** Logo vigente da escola para cabeçalhos; ausência ou falha = null (documento sai sem logo, nunca com outra). */
export async function loadSchoolLogo(school: string): Promise<LogoImage | null> {
  try {
    const rows = await callRpc<{ version: number; object_path: string }[]>("school_logo_at", { _school: school });
    const row = rows?.[0]; if (!row) return null;
    const { data, error } = await supabase.storage.from("escola-logos").download(row.object_path);
    if (error || !data) return null;
    const format = FORMAT[data.type]; if (!format) return null;
    const dataUrl = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(data); });
    return { dataUrl, format, version: row.version };
  } catch { return null; }
}
