import { supabase } from "@/integrations/supabase/client";
import { UserFacingError } from "@/lib/observability/governed-errors";
import type { NetworkPendingAction, NetworkRow, SchoolSnapshot } from "./model";
import { parseSchoolFollowupSnapshot } from "./school-read-contract";
import { parseFollowupNetworkRows, parseFollowupMonths, parseFollowupStatuses } from "./network-read-contract";
import { parseNetworkPendingFollowup } from "./pending-read-contract";

// Leitura e escrita exclusivamente por RPCs institucionais: sem DML direto do navegador.
type RpcResponse = { data: unknown; error: { message: string } | null };
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) {
    if (error.message.includes("followup:recording-denied")
      || error.message.includes("followup:read-denied")) {
      throw new UserFacingError(
        "Seu acesso ao acompanhamento desta escola não está mais autorizado. Atualize a página e peça à administração que confira a designação antes de continuar.",
      );
    }
    if (error.message.includes("followup:session-required")) {
      throw new UserFacingError(
        "Sua sessão não está mais válida. Entre novamente no SIGEM para continuar.",
      );
    }
    if (error.message.includes("followup:natural-person-required")) {
      throw new UserFacingError(
        "Não foi identificado um responsável autorizado para este acesso. Solicite à administração a regularização do vínculo antes de registrar visitas.",
      );
    }
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
    if (error.message.includes("followup:attachment-type")) {
      throw new UserFacingError("A imagem precisa ser PNG, JPEG ou WebP.");
    }
    if (error.message.includes("followup:attachment-size")) {
      throw new UserFacingError("A imagem precisa ter no máximo 5 MB.");
    }
    if (error.message.includes("followup:attachment-missing")
      || error.message.includes("followup:attachment-path")) {
      throw new UserFacingError("O envio da imagem não foi confirmado. Tente anexar novamente.");
    }
    if (error.message.includes("followup:attachment-required")) {
      throw new UserFacingError("Não foi possível identificar o pedido de anexo. Tente novamente.");
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
  return parseNetworkPendingFollowup(value);
}

export type FollowupAttachment = {
  id: string; visit_id: string; visit_logical_id: string; caption: string | null;
  storage_path: string; content_type: string; size_bytes: number;
  author_name: string; created_at: string;
};
function parseAttachments(value: unknown): FollowupAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (typeof r["id"] !== "string" || typeof r["visit_id"] !== "string"
      || typeof r["storage_path"] !== "string" || typeof r["content_type"] !== "string") return [];
    return [{
      id: r["id"], visit_id: r["visit_id"],
      visit_logical_id: typeof r["visit_logical_id"] === "string" ? r["visit_logical_id"] : "",
      caption: typeof r["caption"] === "string" ? r["caption"] : null,
      storage_path: r["storage_path"], content_type: r["content_type"],
      size_bytes: typeof r["size_bytes"] === "number" ? r["size_bytes"] : 0,
      author_name: typeof r["author_name"] === "string" ? r["author_name"] : "",
      created_at: typeof r["created_at"] === "string" ? r["created_at"] : "",
    }];
  });
}
/** Anexos de imagem da unidade, lidos pela RPC autorizada (mesmo escopo do snapshot). */
export async function schoolFollowupAttachments(school: string): Promise<FollowupAttachment[]> {
  const value = await call("school_institutional_followup_attachments", { _school: school });
  return parseAttachments(value);
}
/** Registro idempotente do anexo após o envio do arquivo ao armazenamento privado. */
export async function recordFollowupAttachment(input: {
  visit: string; path: string; contentType: string; size: number; request: string;
}): Promise<string> {
  const id = await call("record_school_institutional_followup_attachment", {
    _visit: input.visit, _storage_path: input.path, _caption: null,
    _content_type: input.contentType, _size_bytes: input.size, _request: input.request,
  });
  if (typeof id !== "string") throw new Error("Não foi possível confirmar o anexo.");
  return id;
}
