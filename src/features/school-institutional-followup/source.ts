import { supabase } from "@/integrations/supabase/client";
import { UserFacingError } from "@/lib/observability/governed-errors";
import type { NetworkPendingAction, NetworkRow, SchoolSnapshot } from "./model";
import { parseSchoolFollowupSnapshot } from "./school-read-contract";
import { parseFollowupNetworkRows, parseFollowupMonths, parseFollowupStatuses } from "./network-read-contract";

// Leitura e escrita exclusivamente por RPCs institucionais: sem DML direto do navegador.
type RpcResponse = { data: unknown; error: { message: string } | null };
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) {
    if (error.message.includes("followup:network-pending-volume-exceeded")) {
      throw new UserFacingError(
        "Há mais de 5.000 medidas não concluídas neste escopo. Para evitar um relatório incompleto, solicite uma consulta paginada ao suporte.",
      );
    }
    if (error.message.includes("followup:history-volume-exceeded")) {
      throw new UserFacingError(
        "O histórico desta unidade é muito extenso para esta tela. Para evitar mostrar dados incompletos, a consulta foi interrompida. Solicite ao suporte a consulta paginada.",
      );
    }
    if (error.message.includes("followup:base-superseded")) {
      throw new UserFacingError("Esta visita já foi retificada. Atualize o histórico antes de registrar outra correção.");
    }
    if (error.message.includes("followup:date-after-plan-deadline")) {
      throw new UserFacingError("A nova data da visita não pode ser posterior ao prazo de uma medida vinculada.");
    }
    if (error.message.includes("followup:date-after-action-update")) {
      throw new UserFacingError("A nova data da visita não pode ser posterior a uma evolução já registrada para seu plano.");
    }
    if (error.message.includes("followup:date-after-linked-update")) {
      throw new UserFacingError("Esta visita está vinculada à evolução de uma medida. Sua data não pode ficar depois da data dessa evolução.");
    }
    if (error.message.includes("followup:origin-after-linked-return")) {
      throw new UserFacingError("A data desta visita não pode ficar depois de uma visita de retorno já associada à evolução do seu plano.");
    }
    if (error.message.includes("followup:linked-return-before-origin")
      || error.message.includes("followup:linked-visit-before-origin")) {
      throw new UserFacingError("A visita de retorno não pode anteceder a visita que originou a medida.");
    }
    if (error.message.includes("followup:update-before-origin-visit")
      || error.message.includes("followup:update-before-linked-visit")) {
      throw new UserFacingError("A data da evolução não pode anteceder a visita a que a medida está vinculada.");
    }
    if (error.message.includes("followup:action-description-required")) {
      throw new UserFacingError("Uma medida possui responsável ou prazo, mas está sem descrição. Descreva a medida antes de salvar a visita.");
    }
    if (error.message.includes("followup:due-before-visit")) {
      throw new UserFacingError("O prazo de uma medida não pode anteceder a data da visita.");
    }
    if (error.message.includes("followup:request-conflict")) {
      throw new UserFacingError("O registro enviado não corresponde à tentativa anterior. Atualize os dados antes de repetir.");
    }
    throw new Error(error.message);
  }
  return data;
}
export async function networkFollowup(from: string, to: string): Promise<NetworkRow[]> {
  const rows = await call("school_institutional_followup_network", { _from: from, _to: to });
  return parseFollowupNetworkRows(rows);
}
export async function schoolFollowup(school: string): Promise<SchoolSnapshot> {
  const value = await call("school_institutional_followup_school", { _school: school });
  return parseSchoolFollowupSnapshot(value, school);
}
export async function recordVisit(input: {
  school: string; day: string; diagnosis: string; strengths: string; weaknesses: string;
  summary: string; participants: string; purpose: string;
  request: string; base?: string | null; reason?: string | null;
}): Promise<string> {
  const id = await call("record_school_institutional_followup_visit", {
    _school: input.school, _day: input.day, _diagnosis: input.diagnosis,
    _strengths: input.strengths, _weaknesses: input.weaknesses, _summary: input.summary,
    _base: input.base ?? null, _reason: input.reason ?? null, _request: input.request,
    _participants: input.participants, _purpose: input.purpose,
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
  summary: string; participants: string; purpose: string; request: string;
  actions: { description: string; responsible: string; due: string | null; request: string }[];
}): Promise<string> {
  const id = await call("record_school_institutional_followup_bundle", {
    _school: input.school, _day: input.day, _diagnosis: input.diagnosis,
    _strengths: input.strengths, _weaknesses: input.weaknesses,
    _summary: input.summary, _request: input.request, _actions: input.actions,
    _participants: input.participants, _purpose: input.purpose,
  });
  if (typeof id !== "string") throw new Error("Não foi possível confirmar a visita e o plano.");
  return id;
}

export type FollowupMonth = { month: string; visits: number };
export type FollowupStatus = { situation: string; actions: number };
export async function monthlyFollowup(from: string, to: string): Promise<FollowupMonth[]> {
  const rows = await call("school_institutional_followup_monthly", { _from: from, _to: to });
  return parseFollowupMonths(rows, from, to);
}
export async function followupStatuses(): Promise<FollowupStatus[]> {
  const rows = await call("school_institutional_followup_statuses", {});
  return parseFollowupStatuses(rows);
}
/** JSONB evita o limite implícito de linhas da API; a autorização ocorre na RPC. */
export async function networkPendingFollowup(): Promise<NetworkPendingAction[]> {
  const value = await call("school_institutional_followup_pending", {});
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !Array.isArray((value as Record<string, unknown>)["pending"])) {
    throw new Error("A relação de providências retornou um formato inesperado.");
  }
  const rows = (value as { pending: unknown[] }).pending;
  if (rows.length > 5000) throw new Error("O quadro excedeu o limite esperado.");
  return rows.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("Registro inválido no quadro de providências.");
    const r = item as Record<string, unknown>;
    if (typeof r["action_id"] !== "string" || typeof r["school_id"] !== "string"
      || typeof r["school_name"] !== "string" || typeof r["description"] !== "string"
      || typeof r["situation"] !== "string" || typeof r["created_at"] !== "string")
      throw new Error("Registro incompleto no quadro de providências.");
    return {
      action_id: r["action_id"], school_id: r["school_id"], school_name: r["school_name"],
      inep: r["inep"] == null ? null : String(r["inep"]), description: r["description"],
      responsible_label: r["responsible_label"] == null ? null : String(r["responsible_label"]),
      due_on: r["due_on"] == null ? null : String(r["due_on"]),
      situation: r["situation"],
      last_update_on: r["last_update_on"] == null ? null : String(r["last_update_on"]),
      created_at: r["created_at"],
    };
  });
}
