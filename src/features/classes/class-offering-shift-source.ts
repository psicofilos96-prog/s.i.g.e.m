/**
 * B2.6 — Fonte institucional de Oferta e Turno da Turma.
 *
 * Leitura vigente SEMPRE por `class_offering_at` / `class_shift_at` (validOn,
 * knownAt); zero linhas = não registrado; estado ambíguo é erro do banco, nunca
 * escolha local. Opções só de `homologated_attribute_values` (catálogo
 * homologado). Escrita só por `record_class_offering_version` /
 * `record_class_shift_version`. Nenhum valor é inventado aqui.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EffectiveCapability } from "@/features/authority/session-authority";
import type { ClassTemporalQuery } from "./institutional-class-contract";
import { projectOffering, projectShift, SHIFT_SCHEME, type OfferingAtRow, type ShiftAtRow } from "./class-offering-shift-projection";
export { projectOffering, projectShift, SHIFT_SCHEME };
export type { AxisValue, OfferingState, ShiftState } from "./class-offering-shift-projection";

export const CLASS_OFFERING_CAPABILITY = "manter-organizacao-da-oferta-da-turma" as const;
export const CLASS_SHIFT_CAPABILITY = "manter-turno-da-turma" as const;

const SQL_NULL = null as unknown as string;

const hasSchoolCap = (caps: readonly EffectiveCapability[], cap: string, schoolId: string) =>
  caps.some((c) => c.capabilityId === cap && c.schoolId === schoolId);
/** Capacidades independentes: uma nunca ativa as ações da outra. */
export const canMaintainOffering = (caps: readonly EffectiveCapability[], schoolId: string) => hasSchoolCap(caps, CLASS_OFFERING_CAPABILITY, schoolId);
export const canMaintainShift = (caps: readonly EffectiveCapability[], schoolId: string) => hasSchoolCap(caps, CLASS_SHIFT_CAPABILITY, schoolId);

export async function classOfferingAt(classId: string, q: ClassTemporalQuery) {
  const { data, error } = await supabase.rpc("class_offering_at", args(classId, q));
  if (error) throw error;
  return projectOffering(data as unknown as OfferingAtRow[]);
}
export async function classShiftAt(classId: string, q: ClassTemporalQuery) {
  const { data, error } = await supabase.rpc("class_shift_at", args(classId, q));
  if (error) throw error;
  return projectShift(data as unknown as ShiftAtRow[]);
}

export type FactHistoryItem = {
  id: string; logicalId: string; version: number; supersedesId: string | null; validFrom: string | null; validUntil: string | null;
  correctionReason: string | null; actRef: string | null; createdAt: string; values: { schemeId: string; valueId: string; valueVersion: number }[];
};

/** Histórico completo (append-only), em ordem de registro. */
export async function classOfferingHistory(classId: string): Promise<FactHistoryItem[]> {
  const { data, error } = await supabase.from("class_offering_versions")
    .select("*, class_offering_axis_values(scheme_id, value_id, value_version)").eq("class_id", classId).order("created_at");
  if (error) throw error;
  return ((data ?? []) as unknown as (Record<string, unknown> & { class_offering_axis_values: { scheme_id: string; value_id: string; value_version: number }[] | null })[])
    .map((r) => ({
      id: String(r["id"]), logicalId: String(r["logical_id"]), version: Number(r["version"]), supersedesId: (r["supersedes_id"] as string | null) ?? null,
      validFrom: (r["valid_from"] as string | null) ?? null, validUntil: (r["valid_until"] as string | null) ?? null,
      correctionReason: (r["correction_reason"] as string | null) ?? null, actRef: (r["originating_act_ref"] as string | null) ?? null,
      createdAt: String(r["created_at"]),
      values: (r.class_offering_axis_values ?? []).map((a) => ({ schemeId: a.scheme_id, valueId: a.value_id, valueVersion: a.value_version })),
    }));
}
export async function classShiftHistory(classId: string): Promise<FactHistoryItem[]> {
  const { data, error } = await supabase.from("class_shift_versions").select("*").eq("class_id", classId).order("created_at");
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r["id"]), logicalId: String(r["logical_id"]), version: Number(r["version"]), supersedesId: (r["supersedes_id"] as string | null) ?? null,
    validFrom: (r["valid_from"] as string | null) ?? null, validUntil: (r["valid_until"] as string | null) ?? null,
    correctionReason: (r["correction_reason"] as string | null) ?? null, actRef: (r["originating_act_ref"] as string | null) ?? null,
    createdAt: String(r["created_at"]),
    values: [{ schemeId: SHIFT_SCHEME, valueId: String(r["shift_value_id"]), valueVersion: Number(r["shift_value_version"]) }],
  }));
}

export type HomologatedValue = { schemeId: string; valueId: string; version: number; label: string };
/** Valores homologados e válidos na data; `scheme` nulo ⇒ todos os esquemas. */
export async function homologatedValues(scheme: string | null, on: string): Promise<HomologatedValue[]> {
  const { data, error } = await supabase.rpc("homologated_attribute_values", { _scheme: scheme ?? SQL_NULL, _on: on });
  if (error) throw error;
  return ((data ?? []) as { scheme_id: string; value_id: string; version: number; label: string }[])
    .map((r) => ({ schemeId: r.scheme_id, valueId: r.value_id, version: r.version, label: r.label }));
}

export type FactOperation = "register" | "correct" | "switch";
const newLogical = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

/** register: base nula; correct: mesma cadeia lógica; switch: nova cadeia que fecha a base. */
export async function recordOffering(input: {
  classId: string; operation: FactOperation; base: { versionId: string; logicalId: string } | null;
  axes: { schemeId: string; valueId: string; version: number }[]; validFrom: string; validUntil: string | null; reason: string | null; actRef: string;
}) {
  const logical = input.operation === "correct" && input.base ? input.base.logicalId : newLogical("oferta");
  const { error } = await supabase.rpc("record_class_offering_version", {
    _logical: logical, _base_version_id: input.operation === "register" ? SQL_NULL : input.base?.versionId ?? SQL_NULL,
    _class: input.classId, _axes: input.axes.map((a) => ({ scheme: a.schemeId, value: a.valueId, version: a.version })),
    _valid_from: input.validFrom, _valid_until: input.validUntil ?? SQL_NULL,
    _correction_reason: input.reason ?? SQL_NULL, _act_ref: input.actRef,
  });
  if (error) throw error;
}
export async function recordShift(input: {
  classId: string; operation: FactOperation; base: { versionId: string; logicalId: string } | null;
  valueId: string; valueVersion: number; validFrom: string; validUntil: string | null; reason: string | null; actRef: string;
}) {
  const logical = input.operation === "correct" && input.base ? input.base.logicalId : newLogical("turno");
  const { error } = await supabase.rpc("record_class_shift_version", {
    _logical: logical, _base_version_id: input.operation === "register" ? SQL_NULL : input.base?.versionId ?? SQL_NULL,
    _class: input.classId, _shift_value: input.valueId, _shift_version: input.valueVersion,
    _valid_from: input.validFrom, _valid_until: input.validUntil ?? SQL_NULL,
    _correction_reason: input.reason ?? SQL_NULL, _act_ref: input.actRef,
  });
  if (error) throw error;
}

export function humanFactError(message: string): string {
  const m = message ?? "";
  const kind = m.includes("shift:") ? "o turno" : "a classificação da oferta";
  if (m.includes("school-capability-required")) return `Sua atuação vigente não concede manter ${kind} desta turma nesta escola.`;
  if (m.includes("valid-from-required")) return "Informe o início da vigência.";
  if (m.includes("value-not-homologated")) return "O valor escolhido não está homologado no catálogo institucional para essa data.";
  if (m.includes("axis-required")) return "Selecione ao menos um eixo com valor homologado.";
  if (m.includes("duplicate-axis")) return "Cada eixo pode ter apenas um valor.";
  if (m.includes("reason-required")) return "Informe o motivo.";
  if (m.includes("base-superseded")) return "Já existe uma versão posterior. Recarregue e confira o histórico.";
  if (m.includes("invalid-switch")) return "A troca exige início posterior ao da versão vigente e dentro de sua vigência.";
  if (m.includes("overlap")) return "O período se sobrepõe a outra vigência registrada para esta turma.";
  if (m.includes("class-inactive-or-unavailable")) return "A turma não está ativa em todo o período informado.";
  if (m.includes("year")) return "O ano letivo da turma não admite essa vigência.";
  if (m.includes("invalid-dates")) return "Confira as datas: o término não pode ser anterior ao início.";
  if (m.includes("ambiguous")) return "Há registros inconsistentes nesta data; nenhuma versão foi escolhida.";
  if (m.includes("not-found")) return "Turma não encontrada ou fora do seu escopo autorizado.";
  return "Não foi possível registrar. Confira os dados e tente novamente.";
}
