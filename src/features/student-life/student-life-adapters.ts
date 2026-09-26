/**
 * Etapa 13A — Adaptadores dos protótipos legados (8A–8F) para os contratos
 * canônicos da Vida Escolar.
 *
 * Transição progressiva: protótipo legado → adaptador → contrato canônico →
 * remoção futura do legado. Nenhuma rota existente é quebrada e nenhum dado
 * demonstrativo é promovido a norma.
 */
import { parseAcademicDate } from "@/lib/academic-date";
import {
  demonstrationStudents,
  type DemonstrationStudent,
  type SchoolEnrollment,
} from "@/features/students/students-data";
import { getPersonByStudentId } from "@/features/students/person-draft";
import { ABSENCE_REASONS, DEMO_EVENT_TYPES, DEMO_PAYLOAD_SCHEMAS } from "./student-life-fixtures";
import {
  absentValue,
  presentValue,
  type ExternalIdentifierReference,
  type Person,
  type SchoolInstitutionalBond,
  type StudentLifeEvent,
  type StudentLifeProvenance,
  type StudentRole,
} from "./student-life-types";
import type { StudentReference } from "./student-life-ledger";

const LEGACY_ORIGIN = "prototipo-demonstrativo-8x";

function legacyProvenance(recordedAt: string): StudentLifeProvenance {
  return {
    originTypeId: LEGACY_ORIGIN,
    recordedAt,
    sourceSystemNamespace: "SIGEM_PROTOTIPO_CAP8",
  };
}

function externalReference(
  code: string | null,
  systemNamespace: string,
  recordedAt: string,
  index: number,
): ExternalIdentifierReference | null {
  if (!code) return null;
  return {
    identifierId: `ext-${systemNamespace}-${index}`,
    systemNamespace,
    externalCode: code,
    validationStateId: "declarado",
    provenance: legacyProvenance(recordedAt),
  };
}

/** PESSOA canônica a partir do cadastro demonstrativo. */
export function adaptPerson(student: DemonstrationStudent): Person {
  const legacyPerson = getPersonByStudentId(student.id);
  const recordedAt = student.updatedAt;
  const isoBirth = parseAcademicDate(legacyPerson?.birthDate ?? null);

  const externals = [
    externalReference(legacyPerson?.identifiers.cpf ?? null, "RECEITA_FEDERAL_CPF", recordedAt, 1),
    externalReference(
      legacyPerson?.identifiers.civilRegistry ?? null,
      "REGISTRO_CIVIL",
      recordedAt,
      2,
    ),
  ].filter((item): item is ExternalIdentifierReference => item !== null);

  return {
    personId: legacyPerson?.id ?? `pes-${student.id}`,
    civilName: legacyPerson?.fullName ?? student.personName,
    socialName: legacyPerson?.socialName ?? null,
    birthDate: isoBirth
      ? presentValue(isoBirth)
      : absentValue<string>(ABSENCE_REASONS.notInformed, "Data não informada no protótipo."),
    civilAttributes: [],
    externalIdentifiers: externals,
    provenance: legacyProvenance(recordedAt),
  };
}

/** ALUNO canônico: papel institucional, sem data de ingresso duplicada. */
export function adaptStudentRole(student: DemonstrationStudent): StudentRole {
  const legacyPerson = getPersonByStudentId(student.id);
  const externals = [
    externalReference(student.externalId, "IDENTIFICADOR_EDUCACIONAL_EXTERNO", student.updatedAt, 1),
  ].filter((item): item is ExternalIdentifierReference => item !== null);

  return {
    studentId: student.id,
    personId: legacyPerson?.id ?? `pes-${student.id}`,
    institutionalIdentifier: {
      value: student.sigemId,
      patternDefinitionId: "padrao-sigem-demo",
    },
    networkStateDefinitionId:
      student.currentSituation === "Sem participação atual" ? "sem-vinculo-atual" : "na-rede",
    externalIdentifiers: externals,
    provenance: legacyProvenance(student.updatedAt),
  };
}

/**
 * VÍNCULO INSTITUCIONAL canônico a partir da "matrícula escolar" legada.
 * Cada relação legada gera um vínculo com um episódio de vigência.
 */
export function adaptSchoolBond(
  student: DemonstrationStudent,
  enrollment: SchoolEnrollment,
): SchoolInstitutionalBond {
  const openedIso = parseAcademicDate(enrollment.openedAt) ?? enrollment.openedAt;
  const closedIso = enrollment.closedAt ? parseAcademicDate(enrollment.closedAt) : null;
  const openEventId = `evt-${enrollment.id}-abertura`;
  const closeEventId = `evt-${enrollment.id}-encerramento`;

  return {
    bondId: enrollment.id,
    studentId: student.id,
    schoolId: enrollment.unitId,
    schoolNameAtEstablishment: enrollment.unitNameAtTime,
    institutionalIdentifier: {
      value: enrollment.number,
      patternDefinitionId: "padrao-registro-vinculo-demo",
    },
    bondStateDefinitionId: enrollment.situation === "Vigente" ? "vigente" : "encerrado",
    episodes: [
      {
        episodeId: `${enrollment.id}-ep-1`,
        validFrom: openedIso,
        validUntil: closedIso ?? null,
        openedByEventId: openEventId,
        ...(closedIso ? { closedByEventId: closeEventId } : {}),
      },
    ],
    sourceEventIds: closedIso ? [openEventId, closeEventId] : [openEventId],
    provenance: legacyProvenance(student.updatedAt),
  };
}

/** Eventos do ledger derivados do protótipo, com bitemporalidade preservada. */
export function adaptStudentLifeEvents(student: DemonstrationStudent): StudentLifeEvent[] {
  const events: StudentLifeEvent[] = [];
  const bonds = [...student.enrollments].sort((a, b) => (a.openedAt < b.openedAt ? -1 : 1));
  const first = bonds[0];

  if (first) {
    const admissionIso = parseAcademicDate(first.openedAt) ?? first.openedAt;
    const personId = getPersonByStudentId(student.id)?.id;
    events.push({
      eventId: `evt-${student.id}-ingresso-rede`,
      eventTypeDefinitionId: DEMO_EVENT_TYPES.networkAdmission,
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.admission,
      scope: { studentId: student.id, ...(personId ? { personId } : {}) },
      effectiveDate: admissionIso,
      attributes: { admissionDate: admissionIso },
      summary: "Ingresso demonstrativo na Rede, reconstituído do protótipo.",
      isCorrection: false,
      provenance: legacyProvenance(student.updatedAt),
    });
  }

  for (const enrollment of bonds) {
    const openedIso = parseAcademicDate(enrollment.openedAt) ?? enrollment.openedAt;
    events.push({
      eventId: `evt-${enrollment.id}-abertura`,
      eventTypeDefinitionId: DEMO_EVENT_TYPES.bondEstablished,
      payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bond,
      scope: { studentId: student.id, bondId: enrollment.id, schoolId: enrollment.unitId },
      effectiveDate: openedIso,
      attributes: {
        validFrom: openedIso,
        schoolNameAtEstablishment: enrollment.unitNameAtTime,
      },
      isCorrection: false,
      provenance: legacyProvenance(student.updatedAt),
    });

    const closedIso = enrollment.closedAt ? parseAcademicDate(enrollment.closedAt) : null;
    if (closedIso) {
      events.push({
        eventId: `evt-${enrollment.id}-encerramento`,
        eventTypeDefinitionId: DEMO_EVENT_TYPES.bondConcluded,
        payloadSchemaDefinitionId: DEMO_PAYLOAD_SCHEMAS.bondClosure,
        scope: { studentId: student.id, bondId: enrollment.id, schoolId: enrollment.unitId },
        effectiveDate: closedIso,
        attributes: {
          validUntil: closedIso,
          closureReasonDefinitionId: "encerramento-demo",
        },
        isCorrection: false,
        provenance: legacyProvenance(student.updatedAt),
      });
    }
  }

  return events;
}

/** Referência mínima do aluno: nenhuma informação de dossiê é carregada. */
export function adaptStudentReference(student: DemonstrationStudent): StudentReference {
  const role = adaptStudentRole(student);
  const legacyPerson = getPersonByStudentId(student.id);
  return {
    studentId: role.studentId,
    personId: role.personId,
    displayName: legacyPerson?.socialName ?? student.personName,
    institutionalIdentifierValue: role.institutionalIdentifier.value,
    networkStateDefinitionId: role.networkStateDefinitionId,
  };
}

/** Projeção canônica completa dos protótipos demonstrativos. */
export function adaptDemonstrationStudentLife() {
  const persons: Person[] = [];
  const roles: StudentRole[] = [];
  const bonds: SchoolInstitutionalBond[] = [];
  const events: StudentLifeEvent[] = [];

  for (const student of demonstrationStudents) {
    persons.push(adaptPerson(student));
    roles.push(adaptStudentRole(student));
    for (const enrollment of student.enrollments) {
      bonds.push(adaptSchoolBond(student, enrollment));
    }
    events.push(...adaptStudentLifeEvents(student));
  }

  return { persons, roles, bonds, events };
}
