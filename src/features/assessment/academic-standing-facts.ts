/**
 * Etapa 12I — camada de FATOS acadêmicos.
 *
 * Converte as fontes canônicas em fatos resolvidos com proveniência: nada é
 * recalculado, nada é presumido e nada recebe efeito normativo aqui.
 *
 *   - resultado do ciclo, recuperação final e pós-recuperação → 12H;
 *   - frequência consolidada do ciclo (unidades, minutos, ausências) → 12H.1
 *     via consolidador canônico do ciclo;
 *   - fatos adicionais (movimentação, documentação, dependências declaradas)
 *     entram como fatos DECLARADOS, sem exigir alteração do motor.
 *
 * Toda proporção existe apenas como materialização analítica reproduzível e
 * nunca é comparada a patamar nesta camada.
 */
import {
  attendanceProportionProjection,
  type CycleAttendanceConsolidation,
} from "@/features/diary/attendance-cycle-consolidation";
import type { CycleConsolidation } from "./cycle-consolidation-types";
import {
  scopeKeyOf,
  type FactDefinition,
  type FactProvenance,
  type FactProvenanceSource,
  type ResolvedFact,
  type StandingPendency,
  type StandingValue,
} from "./academic-standing-types";

// ------------------------------------------------------- Catálogo de fatos

/**
 * Catálogo de fatos disponíveis ao cadastro de critérios. É DADO: novos fatos
 * podem ser acrescentados sem alterar o motor.
 */
export const STANDING_FACT_CATALOG: FactDefinition[] = [
  {
    id: "resultado-consolidado-do-ciclo",
    label: "Resultado consolidado do ciclo",
    description: "Resultado matemático consolidado do ciclo, tal como fechado pelos períodos oficiais.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "componente-curricular",
  },
  {
    id: "resultado-pos-recuperacao-do-ciclo",
    label: "Resultado do ciclo após recuperação",
    description: "Resultado consolidado após a recuperação final, quando a regra avaliativa a aplicar.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "componente-curricular",
  },
  {
    id: "recuperacao-final-registrada",
    label: "Recuperação final registrada",
    description: "Indica se há registro de recuperação final aplicada no ciclo.",
    valueKind: "booleano",
    category: "consolidado",
    scopeKind: "componente-curricular",
  },
  {
    id: "consolidacao-do-ciclo-completa",
    label: "Consolidação do ciclo completa",
    description: "Todos os períodos do ciclo têm fechamento oficial vigente para este componente.",
    valueKind: "booleano",
    category: "consolidado",
    scopeKind: "componente-curricular",
  },
  {
    id: "unidades-de-frequencia-aplicaveis",
    label: "Unidades de frequência aplicáveis",
    description: "Unidades ministradas que alcançaram o aluno no ciclo, na unidade da política de apuração.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "ciclo",
    unit: "unidades",
  },
  {
    id: "presencas-registradas-no-ciclo",
    label: "Presenças registradas no ciclo",
    description: "Marcações de presença nas unidades aplicáveis do ciclo.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "ciclo",
    unit: "unidades",
  },
  {
    id: "ausencias-registradas-no-ciclo",
    label: "Ausências registradas no ciclo",
    description: "Marcações de ausência nas unidades aplicáveis, sem qualquer efeito atribuído.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "ciclo",
    unit: "unidades",
  },
  {
    id: "ausencias-com-ocorrencia-registrada",
    label: "Ausências com ocorrência registrada no prontuário",
    description: "Ausências cobertas por ocorrência registrada no prontuário do aluno. Nenhum efeito é presumido.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "ciclo",
    unit: "unidades",
  },
  {
    id: "ausencias-sem-ocorrencia-registrada",
    label: "Ausências sem ocorrência registrada",
    description: "Ausências sem ocorrência registrada no prontuário. Nenhum efeito é presumido.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "ciclo",
    unit: "unidades",
  },
  {
    id: "unidades-sem-registro-de-chamada",
    label: "Unidades ministradas sem registro de chamada",
    description: "Pendência institucional de registro. Nunca é ausência do aluno.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "ciclo",
    unit: "unidades",
  },
  {
    id: "minutos-aplicaveis-no-ciclo",
    label: "Carga horária aplicável no ciclo",
    description: "Minutos das unidades aplicáveis. Em branco quando a duração não é conhecida.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "ciclo",
    unit: "minutos",
  },
  {
    id: "minutos-de-presenca-no-ciclo",
    label: "Carga horária com presença no ciclo",
    description: "Minutos com marcação de presença. Em branco quando a duração não é conhecida.",
    valueKind: "numero",
    category: "consolidado",
    scopeKind: "ciclo",
    unit: "minutos",
  },
  {
    id: "proporcao-de-presenca-por-unidades",
    label: "Proporção de presença por unidades",
    description:
      "Materialização analítica reproduzível: presenças divididas por unidades aplicáveis. Não é percentual oficial e não é comparada a patamar nesta camada.",
    valueKind: "numero",
    category: "materializacao-analitica",
    scopeKind: "ciclo",
    unit: "proporção",
  },
  {
    id: "proporcao-de-presenca-por-carga-horaria",
    label: "Proporção de presença por carga horária",
    description:
      "Materialização analítica reproduzível: minutos com presença divididos pelos minutos aplicáveis.",
    valueKind: "numero",
    category: "materializacao-analitica",
    scopeKind: "ciclo",
    unit: "proporção",
  },
  {
    id: "frequencia-do-ciclo-completa",
    label: "Frequência do ciclo integralmente fechada",
    description: "Todos os períodos do ciclo têm fechamento oficial de frequência vigente.",
    valueKind: "booleano",
    category: "consolidado",
    scopeKind: "ciclo",
  },
];

export const factDefinitionById = (id: string) =>
  STANDING_FACT_CATALOG.find((definition) => definition.id === id);

// ------------------------------------------------------------- Construção

export type StandingFactInput = {
  cycle: { id: string; kindId: string; academicYearId: string };
  studentId: string;
  studentName?: string;
  /** Consolidações do ciclo (12H), uma por componente/escopo curricular. */
  consolidations: readonly {
    /** Identidade estável do componente/campo no percurso. */
    componentId: string;
    componentLabel: string;
    consolidation: CycleConsolidation;
  }[];
  /** Consolidação canônica da frequência do ciclo (12H.1), quando existir. */
  attendance?: CycleAttendanceConsolidation;
  /**
   * Fatos DECLARADOS por outras áreas (movimentação, documentação, dependências
   * de ciclos anteriores). Entram sem alteração do motor.
   */
  additionalFacts?: readonly ResolvedFact[];
  now?: string;
};

export type StandingFactContext = {
  facts: ResolvedFact[];
  pendencies: StandingPendency[];
  /** Ciclo completo em resultados E em frequência, quando a frequência existir. */
  cycleComplete: boolean;
  factsOfficial: boolean;
};

const provenance = (args: {
  sources: FactProvenanceSource[];
  algorithm: string;
  at: string;
  configuration?: Record<string, StandingValue>;
}): FactProvenance => ({
  sources: args.sources,
  algorithm: args.algorithm,
  ...(args.configuration ? { configuration: args.configuration } : {}),
  materializedAt: args.at,
});

export function buildStandingFactContext(input: StandingFactInput): StandingFactContext {
  const at = input.now ?? new Date().toISOString();
  const facts: ResolvedFact[] = [];
  const pendencies: StandingPendency[] = [];

  const push = (fact: Omit<ResolvedFact, "scopeKey">) =>
    facts.push({ ...fact, scopeKey: scopeKeyOf(fact.scope) });

  // 1. Resultados do ciclo, por componente (12H) -------------------------
  let resultsComplete = input.consolidations.length > 0;
  let resultsOfficial = input.consolidations.length > 0;

  for (const entry of input.consolidations) {
    const consolidation = entry.consolidation;
    const scope = { kind: "componente-curricular", id: entry.componentId };
    const sources: FactProvenanceSource[] = [
      { kind: "ciclo-avaliativo", id: consolidation.cycle.id },
      ...consolidation.facts.sourceClosings.map((source) => ({
        kind: "fechamento-de-periodo",
        id: source.closingId,
        version: source.closingVersion,
        at: source.materializedAt,
      })),
    ];
    const prov = provenance({
      sources,
      algorithm: `consolidação do ciclo (12H) — ${consolidation.kind}`,
      at,
      configuration: {
        configuracao: consolidation.facts.configurationId,
        ...(consolidation.facts.ruleId ? { regraAvaliativa: consolidation.facts.ruleId } : {}),
      },
    });

    const consolidated = consolidation.kind === "consolidado";
    if (!consolidated) {
      resultsComplete = false;
      resultsOfficial = false;
      pendencies.push({
        id: `resultado-do-ciclo-indisponivel:${entry.componentId}`,
        severity:
          consolidation.kind === "nao-aplicavel"
            ? "aviso"
            : consolidation.kind === "acumulado-parcial"
              ? "bloqueante"
              : "pendencia-administrativa",
        message: `${entry.componentLabel}: ${
          consolidation.kind === "acumulado-parcial"
            ? "o ciclo ainda não está completo (períodos sem fechamento oficial)."
            : consolidation.kind === "nao-aplicavel"
              ? consolidation.reason
              : consolidation.reasons.join(" ")
        }`,
        scopeKey: scopeKeyOf(scope),
      });
    } else if (!consolidation.official) {
      resultsOfficial = false;
    }

    push({
      factId: "resultado-consolidado-do-ciclo",
      scope,
      category: "consolidado",
      valueKind: "numero",
      value: consolidation.kind === "consolidado" ? consolidation.cycleScore : null,
      ...(consolidated ? {} : { unavailableReason: "Ciclo sem resultado consolidado oficial." }),
      provenance: prov,
    });
    push({
      factId: "resultado-pos-recuperacao-do-ciclo",
      scope,
      category: "consolidado",
      valueKind: "numero",
      value: consolidation.postRecoveryScore,
      ...(consolidation.postRecoveryScore === null
        ? { unavailableReason: "Sem resultado pós-recuperação registrado." }
        : {}),
      provenance: prov,
    });
    push({
      factId: "recuperacao-final-registrada",
      scope,
      category: "consolidado",
      valueKind: "booleano",
      value: consolidation.finalRecovery ? consolidation.finalRecovery.state === "aplicada" : false,
      provenance: prov,
    });
    push({
      factId: "consolidacao-do-ciclo-completa",
      scope,
      category: "consolidado",
      valueKind: "booleano",
      value: consolidated,
      provenance: prov,
    });
  }

  if (input.consolidations.length === 0)
    pendencies.push({
      id: "sem-componente-no-percurso",
      severity: "pendencia-administrativa",
      message:
        "O percurso não declara componentes curriculares consolidados neste ciclo. Nenhuma situação é determinada sobre percurso vazio.",
    });

  // 2. Frequência consolidada do ciclo (12H.1) ---------------------------
  const attendance = input.attendance;
  if (attendance) {
    const scope = { kind: "ciclo", id: attendance.cycleId };
    const prov = provenance({
      sources: [
        { kind: "ciclo-avaliativo", id: attendance.cycleId },
        ...attendance.sourceClosings.map((source) => ({
          kind: "fechamento-de-frequencia",
          id: source.closingId,
          version: source.closingVersion,
          at: source.materializedAt,
        })),
      ],
      algorithm: "consolidação canônica da frequência do ciclo (12H.1), agregação factual",
      at,
      ...(attendance.policies[0]
        ? {
            configuration: {
              politicaDeApuracao: attendance.policies[0].policyId,
              versaoDaPolitica: attendance.policies[0].policyVersion,
              unidade: attendance.unitKinds.join(", "),
            },
          }
        : {}),
    });
    const attendanceProv: FactProvenance = {
      ...prov,
      ...(attendance.policies[0]
        ? {
            policyId: attendance.policies[0].policyId,
            policyVersion: attendance.policies[0].policyVersion,
          }
        : {}),
    };

    const numeric: Array<[string, number | null]> = [
      ["unidades-de-frequencia-aplicaveis", attendance.student.applicableUnits],
      ["presencas-registradas-no-ciclo", attendance.student.presences],
      ["ausencias-registradas-no-ciclo", attendance.student.absences],
      ["ausencias-com-ocorrencia-registrada", attendance.student.absencesWithRegisteredOccurrence],
      [
        "ausencias-sem-ocorrencia-registrada",
        attendance.student.absencesWithoutRegisteredOccurrence,
      ],
      ["unidades-sem-registro-de-chamada", attendance.student.unitsWithoutAttendanceRecord],
      ["minutos-aplicaveis-no-ciclo", attendance.student.applicableMinutes],
      ["minutos-de-presenca-no-ciclo", attendance.student.presenceMinutes],
    ];
    for (const [factId, value] of numeric)
      push({
        factId,
        scope,
        category: "consolidado",
        valueKind: "numero",
        value,
        ...(value === null ? { unavailableReason: "Carga horária não conhecida." } : {}),
        provenance: attendanceProv,
      });

    for (const basis of ["unidades", "minutos"] as const) {
      const projection = attendanceProportionProjection(attendance.student, basis);
      push({
        factId:
          basis === "unidades"
            ? "proporcao-de-presenca-por-unidades"
            : "proporcao-de-presenca-por-carga-horaria",
        scope,
        category: "materializacao-analitica",
        valueKind: "numero",
        value: projection.value,
        ...(projection.value === null
          ? { unavailableReason: "Sem base suficiente para a projeção." }
          : {}),
        provenance: { ...attendanceProv, algorithm: projection.algorithm },
      });
    }

    push({
      factId: "frequencia-do-ciclo-completa",
      scope,
      category: "consolidado",
      valueKind: "booleano",
      value: attendance.complete,
      provenance: attendanceProv,
    });

    for (const pendency of attendance.pendencies)
      if (pendency.severity !== "aviso")
        pendencies.push({
          id: `frequencia:${pendency.code}`,
          severity: pendency.severity,
          message: pendency.message,
          scopeKey: scopeKeyOf(scope),
        });
  }

  for (const extra of input.additionalFacts ?? [])
    facts.push({ ...extra, scopeKey: extra.scopeKey || scopeKeyOf(extra.scope) });

  const cycleComplete = resultsComplete && (!attendance || attendance.complete);
  const factsOfficial =
    resultsOfficial && (!attendance || attendance.official) && pendencies.every((p) => p.severity === "aviso");

  return { facts, pendencies, cycleComplete, factsOfficial };
}
