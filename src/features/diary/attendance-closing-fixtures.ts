/**
 * Etapa 12H.1 — fixtures DEMONSTRATIVAS da frequência oficial.
 *
 * Nada aqui é norma da rede: são exemplos para exercitar a infraestrutura.
 * Nenhuma política está homologada — logo, nenhum fechamento oficial é possível
 * até que a rede cadastre e homologue a política de apuração.
 */
import type {
  AttendanceAccountingPolicy,
  AttendanceOccurrenceType,
  StudentAttendanceOccurrence,
} from "./attendance-closing-types";

/**
 * Tipos de ocorrência CONFIGURÁVEIS, com identificadores estáveis. Os rótulos
 * abaixo são exemplos; a rede cadastra os seus próprios tipos.
 */
export const demonstrationOccurrenceTypes: AttendanceOccurrenceType[] = [
  {
    id: "toc-001",
    code: "OCR-DOC-CLINICO",
    label: "Ocorrência com documento de saúde",
    description:
      "Ocorrência registrada no prontuário do aluno com documento de origem clínica. Exemplo demonstrativo: o efeito na frequência depende de regra institucional futura.",
    requiresDocument: true,
    active: true,
  },
  {
    id: "toc-002",
    code: "OCR-AMPARO-LEGAL",
    label: "Ocorrência com amparo legal declarado",
    description:
      "Ocorrência registrada com fundamento legal declarado pela Secretaria Escolar. Exemplo demonstrativo, sem efeito automático.",
    requiresDocument: true,
    active: true,
  },
  {
    id: "toc-003",
    code: "OCR-DECL-FAMILIA",
    label: "Ocorrência declarada pela família",
    description:
      "Comunicação da família registrada no prontuário, sem documento externo obrigatório.",
    requiresDocument: false,
    active: true,
  },
];

/**
 * Ocorrências do PRONTUÁRIO DO ALUNO (fonte: Secretaria Escolar). Abrangem
 * intervalo de datas e são apenas referenciadas pela frequência — o documento
 * não é duplicado em cada chamada.
 */
export const demonstrationOccurrences: StudentAttendanceOccurrence[] = [
  {
    id: "ocr-001",
    studentId: "alu-001",
    occurrenceTypeId: "toc-001",
    from: "2026-09-21",
    until: "2026-09-25",
    source: "prontuario-do-aluno-secretaria-escolar",
    documentRef: "PRT-2026-000117 (demonstração)",
    registeredAt: "2026-09-22T12:00:00.000Z",
    registeredBy: "Secretaria escolar (demonstração)",
    note: "Ocorrência fictícia registrada apenas para exercitar a referência documental.",
  },
  {
    id: "ocr-002",
    studentId: "alu-002",
    occurrenceTypeId: "toc-003",
    from: "2026-09-18",
    until: "2026-09-18",
    source: "prontuario-do-aluno-secretaria-escolar",
    registeredAt: "2026-09-18T18:00:00.000Z",
    registeredBy: "Secretaria escolar (demonstração)",
  },
];

/**
 * Políticas de unidade/apuração DEMONSTRATIVAS. Ambas em rascunho: a
 * granularidade oficial só existe após cadastro e homologação pela rede.
 */
export const demonstrationAttendancePolicies: AttendanceAccountingPolicy[] = [
  {
    id: "pol-freq-001",
    version: 1,
    label: "Apuração por componente/campo, em aulas ministradas (rascunho)",
    status: "rascunho",
    unitKind: "aula",
    scopeKind: "componente-ou-campo",
    requiresConcludedAttendance: true,
    preservesDurationMinutes: true,
    appliesTo: { academicYearId: "ano-2026" },
    note: "Exemplo demonstrativo. A rede ainda não definiu se a frequência oficial será apurada por aulas, dias, blocos ou horas.",
  },
  {
    id: "pol-freq-002",
    version: 1,
    label: "Apuração por dia escolar, em contexto integrado (rascunho)",
    status: "rascunho",
    unitKind: "dia",
    scopeKind: "turma-integrada",
    requiresConcludedAttendance: true,
    preservesDurationMinutes: true,
    appliesTo: { academicYearId: "ano-2026" },
    note: "Exemplo demonstrativo para etapas que apuram a jornada do dia. A unidade real permanece pendente de confirmação da rede.",
  },
];

export function attendancePolicyById(id: string) {
  return demonstrationAttendancePolicies.find((policy) => policy.id === id);
}

export function occurrenceTypeById(id: string) {
  return demonstrationOccurrenceTypes.find((type) => type.id === id);
}

export const ATTENDANCE_POLICY_PENDING_NOTE =
  "Nenhuma política de apuração da frequência está homologada. A unidade oficial (aulas, dias, blocos, turnos ou horas), inclusive para a Educação Infantil, será cadastrada quando a rede confirmar a norma. Até então o fechamento oficial permanece bloqueado e nada é presumido.";
