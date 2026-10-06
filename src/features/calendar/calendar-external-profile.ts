/**
 * CAL.EXT.1 — Leitor/gravador do perfil visual dos modelos externos (0201). O banco é a autoridade:
 * writer exige `construir-calendario-da-rede`, base esperada (cabeça) e valida imagens; leitor é at/knownAt.
 * Nada aqui toca versão acadêmica, homologação ou conteúdo.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeProfile, type ExternalProfile, type ExternalTemplateCode } from "./calendar-external-model";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const defaultRpc: Rpc = (fn, args) => supabase.rpc(fn as "calendar_list_at", args as never) as never;

export type ExternalProfileRead =
  | { kind: "padrao"; headId: null; profile: ExternalProfile }
  | { kind: "lido"; headId: string; revision: number; profile: ExternalProfile; recordedAt: string }
  | { kind: "negado" }
  | { kind: "erro"; message: string };

export function parseExternalProfile(t: ExternalTemplateCode, data: unknown): ExternalProfileRead {
  const d = data as Record<string, unknown> | null;
  if (!d || d["contract"] !== "cal-ext-1/1") return { kind: "erro", message: "Resposta fora do contrato do perfil visual." };
  if (d["state"] === "access-denied") return { kind: "negado" };
  if (d["state"] === "padrao") return { kind: "padrao", headId: null, profile: sanitizeProfile(t, null) };
  if (d["state"] === "lido" && typeof d["revisionId"] === "string" && typeof d["revision"] === "number")
    return { kind: "lido", headId: d["revisionId"], revision: d["revision"], profile: sanitizeProfile(t, d["profile"]), recordedAt: String(d["recordedAt"]) };
  return { kind: "erro", message: "Estado desconhecido do perfil visual." };
}

export async function readExternalProfile(p: { calendarId: string; template: ExternalTemplateCode; on: string; knownAt: string }, rpc: Rpc = defaultRpc) {
  const { data, error } = await rpc("calendar_external_profile_at", { _calendar_id: p.calendarId, _template_code: p.template, _on: p.on, _known_at: p.knownAt });
  if (error) return { kind: "erro", message: "Não foi possível ler o perfil visual." } as ExternalProfileRead;
  return parseExternalProfile(p.template, data);
}

const REFUSAL: Record<string, string> = {
  "base-superseded": "Outra pessoa salvou este modelo depois que você abriu a tela. Recarregue antes de salvar.",
  "asset-invalid": "Imagem recusada: use PNG, JPEG ou WEBP.",
  "asset-too-large": "Imagem recusada: maior que o limite de 1,1 MB.",
  "profile-too-large": "Personalização grande demais; reduza as imagens.",
  "invalid-template": "Modelo de apresentação inválido.",
  "calendar-not-found": "Calendário não encontrado.",
  "session-required": "É preciso estar com a sessão ativa.",
};
export function externalRefusalText(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("capability:")) return "Sua atuação não permite personalizar o calendário.";
  const code = /calendar-external:([a-z-]+)/.exec(m)?.[1] ?? (m.includes("calendar:session-required") ? "session-required" : "");
  return REFUSAL[code] ?? "O banco recusou a gravação do perfil visual.";
}

export async function saveExternalProfile(p: { calendarId: string; template: ExternalTemplateCode; expectedHead: string | null; profile: ExternalProfile; reason: string | null }, rpc: Rpc = defaultRpc) {
  const { data, error } = await rpc("record_calendar_external_profile", {
    _calendar_id: p.calendarId, _template_code: p.template, _expected_head: p.expectedHead, _profile: p.profile, _reason: p.reason,
  });
  if (error) throw new Error(externalRefusalText(error.message));
  return data as { revisionId: string; revision: number };
}
