/**
 * Carteirinha do estudante — projeção pura de fatos já autorizados (resumo da família).
 * Campo sem fonte canônica fica "não registrado"; nada é inventado (turno, foto, código, QR).
 * QR só existe quando há URL https de verificação emitida pelo banco.
 */
import type { FamilyStudent, FamilySummary } from "./family-portal";

export type StudentCard = Readonly<{
  name: string | null; school: string | null; className: string | null; shift: string | null;
  code: string | null; year: string | null; photoUrl: string | null; verifyUrl: string | null;
  status: "vigente" | "sem-matricula-vigente";
  /** N9.2.4: validade da emissão oficial ("Válida até …"/"Expirada em …"); ausente sem emissão. */
  validity?: string | null;
}>;

export function projectStudentCard(st: FamilyStudent, s: FamilySummary, today: string): StudentCard {
  const active = (s.enrollments ?? []).find((e) => e.ended_on === null || e.ended_on >= today) ?? null;
  const cls = active?.classes.find((c) => c.from <= today && (c.until === null || c.until >= today)) ?? null;
  return {
    name: st.display_name, school: active?.school ?? null, className: cls?.class ?? null,
    shift: null, code: null, photoUrl: null, verifyUrl: null,
    year: cls ? cls.from.slice(0, 4) : null,
    status: active ? "vigente" : "sem-matricula-vigente",
  };
}

export const cardValue = (v: string | null) => v ?? "não registrado";
export const safeVerifyUrl = (u: string | null) => (u && /^https:\/\//.test(u) ? u : null);
