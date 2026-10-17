import { callRpc } from "@/lib/rpc-call";

export type HistoryRow = { enrollment_id: string; school_id: string; school_name: string | null; year_label: string | null; opened_on: string | null; ended_on: string | null; ending: string | null; classes: string | null };
export const readTransferHistory = (school: string, student: string) =>
  callRpc<HistoryRow[]>("student_transfer_history", { _school: school, _student: student }).then((r) => r ?? []);

export const receiveTransfer = (a: { student: string; school: string; year: string; classId: string; on: string; idem: string }) =>
  callRpc<{ enrollment_id: string; origin_school_name: string | null }>("secretariat_receive_transfer", {
    _student: a.student, _dest_school: a.school, _year: a.year, _class: a.classId, _on: a.on, _idem: a.idem,
  });

export type DeclarationFacts = {
  student_name: string | null; birth_date: string | null; school_name: string | null; school_id: string; year_label: string | null;
  class_label: string | null; opened_on: string | null; ended_on: string | null; destination: string | null;
  number: number; issue_year: number; issued_on: string; valid_until: string; validity_days: number;
};
export const emitTransferDeclaration = (enrollment: string) => callRpc<DeclarationFacts>("secretariat_emit_transfer_declaration", { _enrollment: enrollment });

export const recordDeath = (a: { enrollment: string; certificate: string; diedOn: string; note: string }) =>
  callRpc<string>("secretariat_record_death", { _enrollment: a.enrollment, _certificate: a.certificate, _died_on: a.diedOn, _note: a.note || null });

export type DeathRow = { death_id: string; certificate_number: string; died_on: string; note: string | null; corrected: boolean };
export const readDeath = (student: string) => callRpc<DeathRow[]>("student_death_current", { _student: student }).then((r) => r?.[0] ?? null);

export const recordRenewalTerm = (a: { enrollment: string; grade: string | null; image: boolean | null; address: string | null }) =>
  callRpc<string>("secretariat_record_renewal_term", { _enrollment: a.enrollment, _grade: a.grade, _image: a.image, _address: a.address });
