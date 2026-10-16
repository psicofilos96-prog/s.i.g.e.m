/**
 * Leitura da Ficha de Matrícula com a sessão do usuário (RLS decide o alcance). Nada é gravado.
 * Só preenche o que já está registrado; pai/mãe/representante só pelo parentesco declarado.
 */
import { supabase } from "@/integrations/supabase/client";
import { institution } from "@/config/institution";
import { formatAcademicDateNumeric, operationalToday } from "@/lib/academic-date";
import { loadStudentRecord } from "@/features/students/student-record";
import { currentStudentPhoto, photoUrl } from "../enrollment-wizard-source";
import type { WizardPayload } from "../enrollment-wizard-model";
import type { EnrollmentFormData, PersonBlock } from "./model";

type SchoolRow = { school_id: string; official_name: string | null; address: string | null; district: string | null; phone: string | null; institutional_email: string | null; version_number: number; valid_from: string | null };

export async function loadSchoolHeader(schoolId: string): Promise<EnrollmentFormData["header"]> {
  const { data, error } = await supabase.from("institutional_school_record_versions")
    .select("school_id, official_name, address, district, phone, institutional_email, version_number, valid_from").eq("school_id", schoolId);
  if (error) throw new Error("leitura-escola");
  const today = operationalToday();
  const cur = ((data ?? []) as SchoolRow[]).filter((r) => !r.valid_from || r.valid_from <= today).sort((a, b) => b.version_number - a.version_number)[0];
  const address = [cur?.address, cur?.district].map((x) => x?.trim()).filter(Boolean).join(" – ");
  return {
    government: institution.documentGovernmentName, department: institution.departmentName,
    school: cur?.official_name ?? null, address: address || null, phone: cur?.phone ?? null, email: cur?.institutional_email ?? null,
  };
}

export type FilledForm = { data: EnrollmentFormData; photoUrl: string | null };

/** Rótulo de parentesco → bloco da ficha. Sem correspondência explícita, o responsável não ocupa pai/mãe/representante. */
export function guardianSlot(parentesco: string | undefined): "father" | "mother" | "guardian" | null {
  const p = (parentesco ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  if (/^pai\b/.test(p)) return "father";
  if (/^mae\b/.test(p)) return "mother";
  if (/representante|responsavel legal/.test(p)) return "guardian";
  return null;
}

export function payloadToForm(p: WizardPayload | null): Pick<EnrollmentFormData, "father" | "mother" | "guardian"> & { address: string | null } {
  const out: Pick<EnrollmentFormData, "father" | "mother" | "guardian"> = {};
  for (const r of p?.responsaveis ?? []) {
    const slot = guardianSlot(r.parentesco); if (!slot || out[slot]) continue;
    const b: PersonBlock = { name: r.nome ?? null, phone: r.telefone ?? null }; out[slot] = b;
  }
  const e = p?.endereco;
  const address = e ? [[e.logradouro, e.numero].filter(Boolean).join(", "), e.bairro, e.cidade, e.cep && `CEP ${e.cep}`].filter(Boolean).join(" – ") : "";
  return { ...out, address: address || null };
}

export async function loadFilledForm(studentId: string): Promise<FilledForm | null> {
  const rec = await loadStudentRecord(studentId);
  if (!rec) return null;
  const [idv, draftEv] = await Promise.all([
    supabase.from("student_identity_versions").select("version, birth_date, civil_name, social_name").eq("student_id", studentId).order("version", { ascending: false }).limit(1),
    supabase.from("enrollment_wizard_draft_events").select("draft_id, sequence, payload, inep, existing_student_id, result").or(`existing_student_id.eq.${studentId},result->>student_id.eq.${studentId}`).order("sequence", { ascending: false }).limit(50),
  ]);
  const ident = (idv.data ?? [])[0] as { birth_date: string | null; civil_name: string | null; social_name: string | null } | undefined;
  const evs = (draftEv.data ?? []) as Array<{ draft_id: string; sequence: number; payload: unknown; inep: string | null }>;
  const payload = (evs.find((e) => e.payload && typeof e.payload === "object" && Object.keys(e.payload as object).length)?.payload ?? null) as WizardPayload | null;
  const inep = evs.find((e) => e.inep)?.inep ?? null;

  // matrícula/turma vigente mais recente
  const enrollments = rec.enrollments;
  const withClass = enrollments.flatMap((e) => e.classes.map((c) => ({ e, c }))).sort((a, b) => (b.c.validFrom ?? "").localeCompare(a.c.validFrom ?? ""));
  const pick = withClass.find((x) => x.c.situation.kind === "vigente") ?? withClass[0];
  const schoolId = pick?.e.schoolId ?? enrollments[0]?.schoolId ?? null;
  const header = schoolId ? await loadSchoolHeader(schoolId) : { government: institution.documentGovernmentName, department: institution.departmentName };
  let photo: string | null = null;
  if (schoolId) { try { const p = await currentStudentPhoto(schoolId, studentId); photo = p ? await photoUrl(p) : null; } catch { photo = null; } }
  const fam = payloadToForm(payload);
  const birth = ident?.birth_date ?? payload?.aluno?.nascimento ?? null;
  return {
    photoUrl: photo,
    data: {
      header, yearLabel: pick?.c.year ?? payload?.matricula?.ano ?? null,
      student: {
        name: ident?.civil_name ?? rec.name, birth: birth ? formatAcademicDateNumeric(birth) : null,
        grade: [pick?.c.stage, pick?.c.label].filter(Boolean).join(" – ") || null,
        socialName: ident?.social_name ?? payload?.aluno?.nomeSocial ?? null, address: fam.address,
        birthCertificate: payload?.documentos?.certidao ?? null, censusId: inep,
      },
      father: fam.father, mother: fam.mother, guardian: fam.guardian,
    },
  };
}
