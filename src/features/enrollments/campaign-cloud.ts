/**
 * Matrículas L03 — campanhas persistidas (migrations 0455/0456).
 * Única porta TS: grava só pelos writers SECURITY DEFINER e lê pela RLS de quem consulta.
 * Estado = último evento; edital/regra = versão de ato do SIGEM Documentos assinada (conferido no banco).
 */
import { supabase } from "@/integrations/supabase/client";

export type CycleTerm = "anual" | "1-semestre" | "2-semestre";
export type CampaignStateDb = "rascunho" | "revisao" | "autorizada" | "publicada" | "suspensa" | "encerrada" | "cancelada";
export type CampaignActionDb = "enviar-revisao" | "devolver" | "autorizar" | "publicar" | "suspender" | "retomar" | "encerrar" | "cancelar";

/** Transições aceitas pelo writer; mantida igual a `record_enr_campaign_event`. */
export const TRANSITIONS: Record<CampaignActionDb, { from: readonly CampaignStateDb[]; to: CampaignStateDb; capability: string }> = {
  "enviar-revisao": { from: ["rascunho"], to: "revisao", capability: "manter-campanhas-de-matricula" },
  devolver: { from: ["revisao", "autorizada"], to: "rascunho", capability: "autorizar-campanhas-de-matricula" },
  autorizar: { from: ["revisao"], to: "autorizada", capability: "autorizar-campanhas-de-matricula" },
  publicar: { from: ["autorizada"], to: "publicada", capability: "publicar-campanhas-de-matricula" },
  suspender: { from: ["publicada"], to: "suspensa", capability: "publicar-campanhas-de-matricula" },
  retomar: { from: ["suspensa"], to: "publicada", capability: "publicar-campanhas-de-matricula" },
  encerrar: { from: ["publicada", "suspensa"], to: "encerrada", capability: "publicar-campanhas-de-matricula" },
  cancelar: { from: ["rascunho", "revisao", "autorizada"], to: "cancelada", capability: "manter-campanhas-de-matricula" },
};

export function nextState(state: CampaignStateDb, action: CampaignActionDb): CampaignStateDb | null {
  const t = TRANSITIONS[action];
  return t.from.includes(state) ? t.to : null;
}

export interface CampaignDraft {
  stages: string[]; modalities: string[]; schoolKeys: string[]; periodFrom: string; periodTo: string;
  editalActVersionId: string | null; rulesActVersionId: string | null; reason: string | null;
}

export async function createCampaign(year: number, term: CycleTerm, kind: string, key: string) {
  return supabase.rpc("create_enr_campaign", { _year: year, _term: term, _kind: kind, _key: key });
}
export async function recordCampaignVersion(campaignId: string, expectedVersion: number, d: CampaignDraft) {
  return supabase.rpc("record_enr_campaign_version", {
    _c: campaignId, _expected_version: expectedVersion, _stages: d.stages, _modalities: d.modalities, _schools: d.schoolKeys,
    _from: d.periodFrom, _to: d.periodTo, _edital: d.editalActVersionId as string, _rules: d.rulesActVersionId as string, _reason: d.reason ?? "",
  });
}
export async function recordCampaignEvent(campaignId: string, expectedSeq: number, action: CampaignActionDb, reason: string, key: string) {
  return supabase.rpc("record_enr_campaign_event", { _c: campaignId, _expected_seq: expectedSeq, _action: action, _reason: reason, _key: key });
}
export async function listCampaigns() {
  return supabase.from("enr_campaigns").select("id, cycle_year, cycle_term, kind, created_at").order("created_at", { ascending: false }).limit(200);
}
