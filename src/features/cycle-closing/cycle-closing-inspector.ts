/**
 * Etapa 12K — inspetor de integridade do encerramento.
 *
 * Motor PURO. Ele apenas: (1) resolve cada requisito no avaliador registrado;
 * (2) coleta os cinco estados possíveis do diagnóstico; (3) declara se o
 * encerramento é admissível, isto é, se todos os requisitos OBRIGATÓRIOS e
 * APLICÁVEIS estão satisfeitos.
 *
 * Nenhum `switch` por tipo de requisito, nenhuma exigência universal, nenhuma
 * situação acadêmica inventada. Requisito sem avaliador registrado devolve erro
 * de configuração — nunca "satisfeito por omissão".
 */
import type {
  ClosingEvaluationContext,
  RequirementEvaluatorRegistry,
} from "./cycle-closing-evaluators";
import { requirementEvaluatorRegistry } from "./cycle-closing-evaluators";
import type {
  ClosingDiagnosis,
  ClosingRequirement,
  CycleClosingPolicy,
  RequirementDiagnosis,
  RequirementDiagnosisStatus,
  StudentDiagnosis,
} from "./cycle-closing-types";

const EMPTY_COUNTS: Record<RequirementDiagnosisStatus, number> = {
  satisfeito: 0,
  "nao-satisfeito": 0,
  "nao-aplicavel": 0,
  inconclusivo: 0,
  "erro-configuracao": 0,
};

export type StudentUnderClosing = {
  id: string;
  name?: string;
  /** Situação encontrada, quando houver. Pode legitimamente não existir. */
  terminalStandingId?: string;
  /** Origem institucional da resolução, identificador aberto. */
  resolutionSourceTypeId?: string;
};

const diagnose = (args: {
  requirement: ClosingRequirement;
  context: ClosingEvaluationContext;
  registry: RequirementEvaluatorRegistry;
  studentId?: string;
}): RequirementDiagnosis => {
  const { requirement } = args;
  const evaluator = args.registry.get(requirement.evaluatorId);
  const base = {
    requirementId: requirement.id,
    label: requirement.label,
    evaluatorId: requirement.evaluatorId,
    mandatory: requirement.mandatory,
    perStudent: requirement.perStudent,
    ...(args.studentId ? { studentId: args.studentId } : {}),
  };
  if (!evaluator)
    return {
      ...base,
      status: "erro-configuracao",
      reason: `Não existe avaliador registrado com o identificador "${requirement.evaluatorId}". Esta exigência não pode ser apurada e o encerramento não avança.`,
    };
  const result = evaluator.evaluate({ requirement, context: args.context });
  return {
    ...base,
    status: result.status,
    reason: result.reason,
    ...(result.evidence ? { evidence: result.evidence } : {}),
  };
};

const worstOf = (items: readonly RequirementDiagnosis[]): RequirementDiagnosisStatus => {
  const order: RequirementDiagnosisStatus[] = [
    "erro-configuracao",
    "nao-satisfeito",
    "inconclusivo",
    "satisfeito",
    "nao-aplicavel",
  ];
  for (const status of order) if (items.some((item) => item.status === status)) return status;
  return "nao-aplicavel";
};

export function inspectCycleClosing(input: {
  policy: CycleClosingPolicy;
  context: Omit<ClosingEvaluationContext, "studentId" | "studentIds"> & {
    students: readonly StudentUnderClosing[];
  };
  registry?: RequirementEvaluatorRegistry;
}): ClosingDiagnosis {
  const registry = input.registry ?? requirementEvaluatorRegistry;
  const students = input.context.students;
  const baseContext: ClosingEvaluationContext = {
    ...input.context,
    studentIds: students.map((student) => student.id),
  };

  const classRequirements = input.policy.requirements
    .filter((requirement) => !requirement.perStudent)
    .map((requirement) => diagnose({ requirement, context: baseContext, registry }));

  const perStudent = input.policy.requirements.filter((requirement) => requirement.perStudent);
  const terminal = input.policy.terminalStandingRequirement;

  const studentDiagnoses: StudentDiagnosis[] = students.map((student) => {
    const context: ClosingEvaluationContext = { ...baseContext, studentId: student.id };
    const diagnoses = perStudent.map((requirement) =>
      diagnose({ requirement, context, registry, studentId: student.id }),
    );

    if (terminal?.required) {
      const accepted = terminal.acceptedStandingIds;
      const has = Boolean(student.terminalStandingId);
      const allowed =
        has && (!accepted || accepted.includes(student.terminalStandingId as string));
      diagnoses.push({
        requirementId: `${input.policy.id}-situacao-terminal`,
        label: "Situação acadêmica terminal exigida pela política",
        evaluatorId: "situacao-terminal-declarada-pela-politica",
        mandatory: true,
        perStudent: true,
        studentId: student.id,
        status: allowed ? "satisfeito" : has ? "nao-satisfeito" : "inconclusivo",
        reason: allowed
          ? `Situação registrada: ${student.terminalStandingId}.`
          : has
            ? `A situação "${student.terminalStandingId}" não consta entre as aceitas por esta política.`
            : "Esta política exige situação acadêmica terminal e nenhuma foi determinada para o percurso. Nenhuma situação é criada para permitir o encerramento.",
      });
    }

    const status = worstOf(diagnoses);
    return {
      studentId: student.id,
      ...(student.name ? { studentName: student.name } : {}),
      ...(student.terminalStandingId ? { terminalStandingId: student.terminalStandingId } : {}),
      status,
      diagnoses,
      reason:
        diagnoses.length === 0
          ? "A política não declara exigência individual para este percurso."
          : (diagnoses.find((item) => item.status === status)?.reason ?? ""),
    };
  });

  const all = [...classRequirements, ...studentDiagnoses.flatMap((item) => item.diagnoses)];
  const counts = all.reduce(
    (acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
    { ...EMPTY_COUNTS },
  );

  const applicable = all.filter(
    (item) => item.mandatory && item.status !== "nao-aplicavel",
  );
  const satisfied = applicable.filter((item) => item.status === "satisfeito");
  const impediments = applicable
    .filter((item) => item.status !== "satisfeito")
    .map(
      (item) =>
        `${item.label}${item.studentId ? ` — percurso ${item.studentId}` : ""}: ${item.reason}`,
    );

  if (input.policy.cohortCompletionPolicy?.requiresAllStudentsResolved) {
    const unresolved = studentDiagnoses.filter((item) =>
      ["nao-satisfeito", "inconclusivo", "erro-configuracao"].includes(item.status),
    );
    if (unresolved.length)
      impediments.push(
        `A política exige que todos os percursos estejam resolvidos: ${unresolved.length} permanece(m) sem resolução.`,
      );
  }

  return {
    policyId: input.policy.id,
    policyVersion: input.policy.version,
    evaluatedAt: input.context.now,
    classRequirements,
    students: studentDiagnoses,
    counts,
    applicableMandatory: applicable.length,
    satisfiedMandatory: satisfied.length,
    closable: impediments.length === 0,
    impediments,
  };
}
