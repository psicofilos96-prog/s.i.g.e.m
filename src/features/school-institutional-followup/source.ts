import { supabase } from "@/integrations/supabase/client";
import type { NetworkRow, SchoolSnapshot } from "./model";

// Leitura e escrita exclusivamente por RPCs institucionais: sem DML direto do navegador.
type RpcResponse = { data: unknown; error: { message: string } | null };
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function networkFollowup(from: string, to: string): Promise<NetworkRow[]> {
  const rows = await call("school_institutional_followup_network", { _from: from, _to: to });
  if (!Array.isArray(rows)) throw new Error("A consulta da rede retornou um formato inesperado.");
  return rows.map((r: Record<string, unknown>) => ({
    school_id: String(r['school_id']), school_name: String(r['school_name']),
    visits: Number(r['visits']), actions: Number(r['actions']),
    completed: Number(r['completed']), overdue: Number(r['overdue']),
    last_visit: r['last_visit'] == null ? null : String(r['last_visit']),
  }));
}
export async function schoolFollowup(school: string): Promise<SchoolSnapshot> {
  const value = await call("school_institutional_followup_school", { _school: school });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta da escola inválida.");
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj['visits']) || !Array.isArray(obj['visit_history'])
    || !Array.isArray(obj['actions']) || !Array.isArray(obj['updates'])) {
    throw new Error("O histórico da escola veio incompleto.");
  }
  return obj as unknown as SchoolSnapshot;
}
export async function recordVisit(input: {
  school: string; day: string; diagnosis: string; strengths: string; weaknesses: string;
  summary: string; request: string; base?: string | null; reason?: string | null;
}): Promise<string> {
  const id = await call("record_school_institutional_followup_visit", {
    _school: input.school, _day: input.day, _diagnosis: input.diagnosis,
    _strengths: input.strengths, _weaknesses: input.weaknesses, _summary: input.summary,
    _base: input.base ?? null, _reason: input.reason ?? null, _request: input.request,
  });
  if (typeof id !== "string") throw new Error("Não foi possível confirmar a visita.");
  return id;
}
export async function recordAction(input: {
  visit: string; description: string; responsible: string; due: string | null; request: string;
}): Promise<string> {
  const id = await call("record_school_institutional_followup_action", {
    _visit: input.visit, _description: input.description, _responsible: input.responsible,
    _due: input.due, _request: input.request,
  });
  if (typeof id !== "string") throw new Error("Não foi possível confirmar a ação.");
  return id;
}
export async function recordUpdate(input: {
  action: string; visit: string | null; day: string; situation: string; done: string;
  notDone: string; results: string; referrals: string; request: string;
}): Promise<string> {
  const id = await call("record_school_institutional_followup_update", {
    _action: input.action, _visit: input.visit, _day: input.day, _situation: input.situation,
    _done: input.done, _not_done: input.notDone, _results: input.results,
    _referrals: input.referrals, _request: input.request,
  });
  if (typeof id !== "string") throw new Error("Não foi possível confirmar a atualização.");
  return id;
}

export async function recordVisitBundle(input: {
  school: string; day: string; diagnosis: string; strengths: string; weaknesses: string;
  summary: string; request: string;
  actions: { description: string; responsible: string; due: string | null; request: string }[];
}): Promise<string> {
  const id = await call("record_school_institutional_followup_bundle", {
    _school: input.school, _day: input.day, _diagnosis: input.diagnosis,
    _strengths: input.strengths, _weaknesses: input.weaknesses,
    _summary: input.summary, _request: input.request, _actions: input.actions,
  });
  if (typeof id !== "string") throw new Error("Não foi possível confirmar a visita e o plano.");
  return id;
}

export type FollowupMonth = { month: string; visits: number };
export type FollowupStatus = { situation: string; actions: number };
export async function monthlyFollowup(from: string, to: string): Promise<FollowupMonth[]> {
  const rows = await call("school_institutional_followup_monthly", { _from: from, _to: to });
  if (!Array.isArray(rows)) throw new Error("Série mensal indisponível.");
  return rows.map((r: Record<string, unknown>) => ({
    month: String(r["month"]), visits: Number(r["visits"]),
  }));
}
export async function followupStatuses(): Promise<FollowupStatus[]> {
  const rows = await call("school_institutional_followup_statuses", {});
  if (!Array.isArray(rows)) throw new Error("Situações indisponíveis.");
  return rows.map((r: Record<string, unknown>) => ({
    situation: String(r["situation"]), actions: Number(r["actions"]),
  }));
}
