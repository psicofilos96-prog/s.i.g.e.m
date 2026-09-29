/**
 * 6D.FINAL.6 — fonte institucional das ocorrências de frequência.
 *
 * Mesmo conceito do laboratório: ocorrência registrada no prontuário do aluno,
 * cobrindo intervalo de datas, apenas REFERENCIADA pela frequência. Nunca vira
 * falta, presença, nota, penalidade ou situação acadêmica.
 *
 * - Tipos: catálogo homologável versionado (`attendance_occurrence_types`),
 *   sem lista normativa no código; base vazia ⇒ nenhum tipo.
 * - Ocorrências: append-only versionadas (`student_attendance_occurrences`);
 *   vigente = versão não superada e não anulada. Gravação só por
 *   `record_attendance_occurrence` (capacidade existente
 *   `registrar-ocorrencia-no-prontuario`).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { refusalMessage } from "@/features/assessment/assessment-results-cloud";
import type { AttendanceOccurrenceType, StudentAttendanceOccurrence } from "./attendance-closing-types";

export type OccurrenceTypeRow = {
  id: string;
  version: number;
  code: string;
  label: string;
  description: string;
  requires_document: boolean;
  status: string;
  valid_from: string;
  valid_until: string | null;
};

export type OccurrenceRow = {
  id: string;
  logical_id: string;
  version: number;
  supersedes_id: string | null;
  student_id: string;
  class_id: string;
  occurrence_type_id: string;
  occurrence_type_version: number;
  from_date: string;
  until_date: string;
  document_ref: string | null;
  note: string | null;
  annulled: boolean;
  created_at: string;
  author_person_id: string | null;
};

/** Tipo vigente = maior versão homologada cuja vigência contém a data. */
export function currentOccurrenceTypes(rows: readonly OccurrenceTypeRow[], date: string): AttendanceOccurrenceType[] {
  const byId = new Map<string, OccurrenceTypeRow>();
  for (const r of rows) {
    if (r.status !== "homologada" || r.valid_from > date || (r.valid_until && r.valid_until < date)) continue;
    const prev = byId.get(r.id);
    if (!prev || prev.version < r.version) byId.set(r.id, r);
  }
  return [...byId.values()].map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    description: r.description,
    requiresDocument: r.requires_document,
    active: true,
  }));
}

/** Versão vigente de cada ocorrência lógica; anuladas não são referenciadas. */
export function currentOccurrences(rows: readonly OccurrenceRow[]): (StudentAttendanceOccurrence & { versionId: string; version: number })[] {
  const superseded = new Set(rows.map((r) => r.supersedes_id).filter(Boolean));
  return rows
    .filter((r) => !superseded.has(r.id) && !r.annulled)
    .map((r) => ({
      id: r.logical_id,
      versionId: r.id,
      version: r.version,
      studentId: r.student_id,
      occurrenceTypeId: r.occurrence_type_id,
      from: r.from_date,
      until: r.until_date,
      source: "prontuario-do-aluno-secretaria-escolar" as const,
      ...(r.document_ref ? { documentRef: r.document_ref } : {}),
      registeredAt: r.created_at,
      registeredBy: r.author_person_id ?? "autoria registrada",
      ...(r.note ? { note: r.note } : {}),
    }));
}

export function useCloudAttendanceOccurrences(classId: string, enabled: boolean, date: string) {
  const [typeRows, setTypeRows] = useState<OccurrenceTypeRow[]>([]);
  const [rows, setRows] = useState<OccurrenceRow[]>([]);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const [t, o] = await Promise.all([
      supabase.from("attendance_occurrence_types").select("id, version, code, label, description, requires_document, status, valid_from, valid_until"),
      supabase
        .from("student_attendance_occurrences")
        .select("id, logical_id, version, supersedes_id, student_id, class_id, occurrence_type_id, occurrence_type_version, from_date, until_date, document_ref, note, annulled, created_at, author_person_id")
        .eq("class_id", classId),
    ]);
    setTypeRows((t.data ?? []) as OccurrenceTypeRow[]);
    setRows((o.data ?? []) as OccurrenceRow[]);
  }, [enabled, classId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const register = useCallback(
    async (input: { studentId: string; typeId: string; from: string; until: string; documentRef?: string; note?: string }) => {
      const type = typeRows
        .filter((r) => r.id === input.typeId && r.status === "homologada")
        .sort((a, b) => b.version - a.version)[0];
      if (!type) return { ok: false as const, reasons: ["Tipo de ocorrência não homologado."] };
      const { error } = await supabase.rpc("record_attendance_occurrence" as never, {
        _class: classId,
        _student: input.studentId,
        _type_id: type.id,
        _type_version: type.version,
        _from: input.from,
        _until: input.until,
        _document_ref: input.documentRef ?? "",
        _note: input.note ?? "",
        _expected_version_id: null,
        _annul: false,
        _justification: "",
        _plan_id: `ocorrencia:${classId}|${input.studentId}|${type.id}|${input.from}|${input.until}|${crypto.randomUUID()}`,
      } as never);
      await refresh();
      return error ? { ok: false as const, reasons: [refusalMessage(error.message)] } : { ok: true as const };
    },
    [classId, typeRows, refresh],
  );

  return {
    types: currentOccurrenceTypes(typeRows, date),
    occurrences: currentOccurrences(rows),
    register,
    refresh,
  };
}
