/**
 * Etapa 13F — Auditoria do Dossiê e Prontuário Canônico do Aluno.
 *
 * Os testes provam CAPACIDADE com dados fictícios. Nenhuma norma da Rede é
 * homologada aqui, e o dossiê nunca se torna fonte de verdade de matrícula,
 * turma, mobilidade, continuidade ou resultado acadêmico.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAccessAuditRecords,
  createAccessEffectRegistry,
  decideAccess,
  DOSSIER_ACCESS_EXECUTOR_IDS,
  redactPayload,
  registerAccessEffectExecutor,
  selectAuthorizedResources,
} from "./dossier-access";
import {
  createDocumentRecordAdapter,
  createDossierRecordAdapter,
  DOSSIER_SOURCE_TYPE_DEFINITION_IDS,
  documentRefersToStudent,
} from "./dossier-adapters";
import {
  documentFactRows,
  documentRepresentationFactRows,
  dossierRecordFactRows,
  dossierRelationFactRows,
  responsibilityFactRows,
} from "./dossier-analytics";
import {
  createLifecycleConsequenceRegistry,
  evaluateLifecycle,
  LIFECYCLE_EXECUTOR_IDS,
  registerLifecycleConsequenceExecutor,
} from "./dossier-lifecycle";
import {
  createTimelineSourceRegistry,
  projectStudentLifeTimeline,
  registerTimelineSource,
  searchAuthorizedDossier,
  type TimelineCandidate,
} from "./dossier-projection";
import {
  currentDocumentRecords,
  currentDossierRecords,
  describeDocumentRecord,
  describeDossierRecord,
  documentsForStudent,
  DOCUMENT_REQUIREMENT_RESOLUTION_IDS,
  DOSSIER_RESOURCE_KIND_IDS,
  dossierRecordsForStudent,
  personsHoldingCapacity,
  relationsTouching,
  relationshipsAsOf,
  representationsOfDocument,
  resolveDocumentRequirements,
  responsibilityAssignmentsAsOf,
} from "./dossier-records";
import {
  DEMO_ACCESS_CAPACITY_IDS,
  DEMO_ACCESS_EFFECT_IDS,
  DEMO_ACCESS_OPERATION_IDS,
  DEMO_ANALYTICAL_EXPOSURE_POLICY,
  DEMO_ATTENDANCE_RECORD,
  DEMO_ATTENDANCE_RECORD_CORRECTION,
  DEMO_BIRTH_CERTIFICATE,
  DEMO_CONFIDENTIAL_RECORD,
  DEMO_DOCUMENT_RECORDS,
  DEMO_DOCUMENT_REPRESENTATIONS,
  DEMO_DOCUMENT_STATUS_IDS,
  DEMO_DOCUMENT_TYPE_IDS,
  DEMO_DOSSIER_ACCESS_POLICY,
  DEMO_DOSSIER_RECORDS,
  DEMO_DOSSIER_RELATIONS,
  DEMO_DOSSIER_SENSITIVITY_IDS,
  DEMO_LIFECYCLE_POLICY,
  DEMO_MULTI_STUDENT_RECORD,
  DEMO_MULTI_SUBJECT_DOCUMENT,
  DEMO_PERSONAL_RELATIONSHIPS,
  DEMO_PROCESSING_PURPOSE_IDS,
  DEMO_REPORT_DOCUMENT,
  DEMO_RESPONSIBILITY_ASSIGNMENTS,
  DEMO_RESPONSIBILITY_CAPACITY_IDS,
  DEMO_SIBLING_STUDENT_ID,
  DEMO_STUDENT_ID,
  DEMO_UNIT_ID,
} from "./dossier-fixtures";
import type {
  AccessRequestFacts,
  DossierAccessPolicy,
  GovernedResourceDescriptor,
} from "./dossier-types";

const unitScope = [
  { entityKindDefinitionId: "unidade-escolar", entityId: DEMO_UNIT_ID },
];

const facts = (
  overrides: Partial<AccessRequestFacts> & {
    capacityDefinitionIds: readonly string[];
  },
): AccessRequestFacts => ({
  actorId: "agente-demo",
  processingPurposeDefinitionId: DEMO_PROCESSING_PURPOSE_IDS.schoolManagement,
  operationDefinitionId: DEMO_ACCESS_OPERATION_IDS.readContent,
  scopeEntities: unitScope,
  requestedAt: "2026-06-01T10:00:00Z",
  ...overrides,
});

const sources = () => [
  {
    sourceTypeDefinitionId: DOSSIER_SOURCE_TYPE_DEFINITION_IDS.dossierRecord,
    entities: DEMO_DOSSIER_RECORDS,
  },
  {
    sourceTypeDefinitionId: DOSSIER_SOURCE_TYPE_DEFINITION_IDS.documentRecord,
    entities: DEMO_DOCUMENT_RECORDS,
  },
];

const registry = () => {
  const reg = createTimelineSourceRegistry();
  registerTimelineSource(
    reg,
    DOSSIER_SOURCE_TYPE_DEFINITION_IDS.dossierRecord,
    createDossierRecordAdapter(),
  );
  registerTimelineSource(
    reg,
    DOSSIER_SOURCE_TYPE_DEFINITION_IDS.documentRecord,
    createDocumentRecordAdapter(),
  );
  return reg;
};

describe("13F — registros próprios do prontuário", () => {
  it("1. cria registro sem duplicar nem invadir a entidade de matrícula", () => {
    const keys = Object.keys(DEMO_MULTI_STUDENT_RECORD);
    expect(keys).not.toContain("enrollments");
    expect(keys).not.toContain("classes");
    expect(keys).not.toContain("grades");
    expect(keys).not.toContain("transfers");
    expect(DEMO_MULTI_STUDENT_RECORD.subjectReferences.length).toBe(2);
  });

  it("3. retificação preserva a versão anterior e a superação é derivada", () => {
    const current = currentDossierRecords(DEMO_DOSSIER_RECORDS);
    expect(current.map((record) => record.recordId)).toContain(
      DEMO_ATTENDANCE_RECORD_CORRECTION.recordId,
    );
    expect(current.map((record) => record.recordId)).not.toContain(
      DEMO_ATTENDANCE_RECORD.recordId,
    );
    expect(DEMO_DOSSIER_RECORDS).toContain(DEMO_ATTENDANCE_RECORD);
    expect("isSuperseded" in DEMO_ATTENDANCE_RECORD).toBe(false);
  });

  it("4. novo tipo de registro configurado é aceito sem alterar o motor", () => {
    const inedito = {
      ...DEMO_ATTENDANCE_RECORD,
      recordId: "registro-inedito",
      recordTypeDefinitionId: "natureza-jamais-prevista-em-codigo",
    };
    const descriptor = describeDossierRecord(inedito, ["resumo"]);
    expect(descriptor.typeDefinitionId).toBe(
      "natureza-jamais-prevista-em-codigo",
    );
  });

  it("18. registro multi-aluno é projetado por cada ficha, sem duplicação", () => {
    const paraAluno = dossierRecordsForStudent(
      DEMO_DOSSIER_RECORDS,
      DEMO_STUDENT_ID,
    );
    const paraIrmao = dossierRecordsForStudent(
      DEMO_DOSSIER_RECORDS,
      DEMO_SIBLING_STUDENT_ID,
    );
    expect(paraAluno).toContain(DEMO_MULTI_STUDENT_RECORD);
    expect(paraIrmao).toContain(DEMO_MULTI_STUDENT_RECORD);
    expect(paraIrmao.length).toBe(1);
  });
});

describe("13F — documentos, representações e ativos", () => {
  it("2/8. documento é multi-entidade e fundamenta mais de um processo", () => {
    expect(
      DEMO_MULTI_SUBJECT_DOCUMENT.subjectReferences.map(
        (subject) => subject.reference.entityKindDefinitionId,
      ),
    ).toEqual(["aluno", "pessoa", "processo-institucional"]);
    expect("studentId" in DEMO_MULTI_SUBJECT_DOCUMENT).toBe(false);
    expect(documentRefersToStudent(DEMO_MULTI_SUBJECT_DOCUMENT, DEMO_STUDENT_ID)).toBe(
      true,
    );
    expect(
      documentsForStudent(DEMO_DOCUMENT_RECORDS, DEMO_STUDENT_ID).length,
    ).toBe(3);
  });

  it("3b. registro documental, representação e ativo digital são distintos", () => {
    expect("storageUri" in DEMO_MULTI_SUBJECT_DOCUMENT).toBe(false);
    const representations = representationsOfDocument(
      DEMO_DOCUMENT_REPRESENTATIONS,
      DEMO_MULTI_SUBJECT_DOCUMENT.documentRecordId,
    );
    expect(representations.length).toBe(2);
    expect(new Set(representations.map((item) => item.assetId)).size).toBe(2);
  });

  it("5. novo tipo documental configurado é aceito sem alterar o domínio", () => {
    const inedito = {
      ...DEMO_BIRTH_CERTIFICATE,
      documentRecordId: "documento-inedito",
      documentTypeDefinitionId: "tipo-documental-jamais-previsto",
    };
    expect(
      describeDocumentRecord(inedito, ["tipo"]).typeDefinitionId,
    ).toBe("tipo-documental-jamais-previsto");
  });

  it("9. anexar documento não altera matrícula, nome nem transferência", () => {
    const documentos = currentDocumentRecords(DEMO_DOCUMENT_RECORDS);
    for (const documento of documentos) {
      const keys = Object.keys(documento);
      expect(keys).not.toContain("enrollmentUpdate");
      expect(keys).not.toContain("personName");
      expect(keys).not.toContain("transferEffect");
    }
  });

  it("10b. documento apresentado não produz fato institucional reconhecido", () => {
    const relacoes = relationsTouching(
      DEMO_DOSSIER_RELATIONS,
      DEMO_REPORT_DOCUMENT.documentRecordId,
    );
    expect(relacoes.length).toBe(1);
    expect(relacoes[0]?.relationTypeDefinitionId).toBe("fundamenta");
    // O fato reconhecido é um REGISTRO distinto, com sua própria proveniência.
    expect(DEMO_CONFIDENTIAL_RECORD.provenance.recordedAt).not.toBe(
      DEMO_REPORT_DOCUMENT.provenance.recordedAt,
    );
  });

  it("20. exigências documentais da 13B são resolvidas sem redundância", () => {
    const resolucoes = resolveDocumentRequirements({
      requirements: [
        {
          requirementDefinitionId: "req-documento-identificacao-demo",
          acceptedDocumentTypeDefinitionIds: [
            DEMO_DOCUMENT_TYPE_IDS.birthCertificate,
          ],
          acceptedDocumentStatusDefinitionIds: [
            DEMO_DOCUMENT_STATUS_IDS.received,
            DEMO_DOCUMENT_STATUS_IDS.authenticated,
          ],
        },
        {
          requirementDefinitionId: "req-comprovante-residencia-demo",
          acceptedDocumentTypeDefinitionIds: ["comprovante-de-residencia"],
          acceptedDocumentStatusDefinitionIds: [
            DEMO_DOCUMENT_STATUS_IDS.received,
          ],
        },
        {
          requirementDefinitionId: "req-sem-catalogo-demo",
          acceptedDocumentTypeDefinitionIds: [],
          acceptedDocumentStatusDefinitionIds: [],
        },
      ],
      documents: DEMO_DOCUMENT_RECORDS,
      studentId: DEMO_STUDENT_ID,
    });
    expect(resolucoes[0]?.resolutionDefinitionId).toBe(
      DOCUMENT_REQUIREMENT_RESOLUTION_IDS.satisfied,
    );
    expect(resolucoes[0]?.satisfiedByDocumentRecordIds).toEqual([
      DEMO_BIRTH_CERTIFICATE.documentRecordId,
    ]);
    expect(resolucoes[1]?.resolutionDefinitionId).toBe(
      DOCUMENT_REQUIREMENT_RESOLUTION_IDS.pending,
    );
    expect(resolucoes[2]?.resolutionDefinitionId).toBe(
      DOCUMENT_REQUIREMENT_RESOLUTION_IDS.inconclusive,
    );
    for (const resolucao of resolucoes) {
      expect("hasPendingDocuments" in resolucao).toBe(false);
    }
  });
});

describe("13F — relação pessoal ≠ responsabilidade institucional", () => {
  it("6/7. avó guardiã tem autoridade por atribuição vigente, não por parentesco", () => {
    for (const relacao of DEMO_PERSONAL_RELATIONSHIPS) {
      expect("isLegalGuardian" in relacao).toBe(false);
    }
    const vigentes = relationshipsAsOf(
      DEMO_PERSONAL_RELATIONSHIPS,
      DEMO_STUDENT_ID,
      "2026-06-01",
    );
    expect(vigentes.length).toBe(2);

    const assinantes = personsHoldingCapacity({
      assignments: DEMO_RESPONSIBILITY_ASSIGNMENTS,
      studentId: DEMO_STUDENT_ID,
      capacityDefinitionId: DEMO_RESPONSIBILITY_CAPACITY_IDS.signEnrollment,
      isoDate: "2026-06-01",
    });
    expect(assinantes).toEqual(["pessoa-demo-avo"]);
    // A mãe tem relação registrada, mas nenhuma atribuição vigente.
    expect(assinantes).not.toContain("pessoa-demo-mae");
  });

  it("7b. término de vigência encerra a responsabilidade sem apagar história", () => {
    expect(
      responsibilityAssignmentsAsOf(
        DEMO_RESPONSIBILITY_ASSIGNMENTS,
        DEMO_SIBLING_STUDENT_ID,
        "2026-06-01",
      ).length,
    ).toBe(1);
    expect(
      responsibilityAssignmentsAsOf(
        DEMO_RESPONSIBILITY_ASSIGNMENTS,
        DEMO_SIBLING_STUDENT_ID,
        "2026-08-01",
      ).length,
    ).toBe(0);
  });

  it("responsabilidade pode existir sem relação pessoal registrada", () => {
    const abrigo = DEMO_RESPONSIBILITY_ASSIGNMENTS[1];
    expect(abrigo?.relationshipId).toBeUndefined();
    expect(abrigo?.basisDefinitionId).toBe("designacao-institucional");
  });
});

describe("13F — governança de acesso", () => {
  it("5b. efeito de acesso é configurado e executado por executor registrado", () => {
    const resource = describeDossierRecord(DEMO_CONFIDENTIAL_RECORD, [
      "resumo",
      "conteudoSensivel",
    ]);
    const decisao = decideAccess({
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
      }),
      resource,
    });
    expect(decisao.accessEffectDefinitionId).toBe(
      DEMO_ACCESS_EFFECT_IDS.grantedWithAudit,
    );
    expect(decisao.outcome.includeInProjection).toBe(true);
    expect(decisao.outcome.requiresAuditRecord).toBe(true);
    expect("allowed" in decisao.outcome).toBe(false);
  });

  it("efeito sem executor registrado é inconclusivo e falha fechada", () => {
    const policy: DossierAccessPolicy = {
      ...DEMO_DOSSIER_ACCESS_POLICY,
      rules: [
        {
          ruleId: "regra-efeito-inedito",
          priority: 1,
          match: {},
          effect: {
            accessEffectDefinitionId: "efeito-jamais-implementado",
            executorId: "executor-inexistente",
          },
        },
      ],
    };
    const decisao = decideAccess({
      policy,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
      }),
      resource: describeDossierRecord(DEMO_ATTENDANCE_RECORD, ["resumo"]),
    });
    expect(decisao.outcome.inconclusive).toBe(true);
    expect(decisao.outcome.includeInProjection).toBe(false);
  });

  it("efeito inédito entra por registro de executor, sem alterar o motor", () => {
    const reg = createAccessEffectRegistry();
    registerAccessEffectExecutor(reg, "executor-demo-inedito", () => ({
      includeInProjection: true,
      grantedFieldPaths: ["resumo"],
      redactedFieldPaths: ["conteudoSensivel"],
      requiresAuditRecord: true,
    }));
    const policy: DossierAccessPolicy = {
      ...DEMO_DOSSIER_ACCESS_POLICY,
      rules: [
        {
          ruleId: "regra-demo-inedita",
          priority: 1,
          match: {},
          effect: {
            accessEffectDefinitionId: "permitido-em-modo-inedito",
            executorId: "executor-demo-inedito",
          },
        },
      ],
    };
    const decisao = decideAccess({
      policy,
      facts: facts({ capacityDefinitionIds: ["capacidade-inedita"] }),
      resource: describeDossierRecord(DEMO_CONFIDENTIAL_RECORD, [
        "resumo",
        "conteudoSensivel",
      ]),
      registry: reg,
    });
    expect(decisao.outcome.grantedFieldPaths).toEqual(["resumo"]);
  });

  it("10. capacidade sem autorização não lê registro restrito do prontuário", () => {
    const resource = describeDossierRecord(DEMO_CONFIDENTIAL_RECORD, [
      "resumo",
    ]);
    const decisao = decideAccess({
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({ capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.teacher] }),
      resource,
    });
    expect(decisao.accessEffectDefinitionId).toBe(
      DEMO_ACCESS_EFFECT_IDS.denied,
    );
    expect(decisao.outcome.includeInProjection).toBe(false);
  });

  it("6b. autorização alcança campos: existência sem conteúdo integral", () => {
    const resource = describeDossierRecord(DEMO_MULTI_STUDENT_RECORD, [
      "resumo",
      "detalhe",
    ]);
    const decisao = decideAccess({
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.guidance],
        processingPurposeDefinitionId:
          DEMO_PROCESSING_PURPOSE_IDS.pedagogicalFollowUp,
      }),
      resource,
    });
    const { authorizedPayload, redactedFieldPaths } = redactPayload({
      payload: DEMO_MULTI_STUDENT_RECORD.structuredPayload,
      resource,
      decision: decisao,
    });
    expect(Object.keys(authorizedPayload)).toEqual(["resumo"]);
    expect(redactedFieldPaths).toContain("detalhe");
  });

  it("11. duas capacidades veem subconjuntos distintos do mesmo dossiê", () => {
    const resources: GovernedResourceDescriptor[] = [
      describeDossierRecord(DEMO_ATTENDANCE_RECORD_CORRECTION, ["resumo"]),
      describeDossierRecord(DEMO_CONFIDENTIAL_RECORD, ["resumo"]),
    ];
    const secretaria = selectAuthorizedResources({
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.secretariat],
      }),
      resources,
    });
    const direcao = selectAuthorizedResources({
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
      }),
      resources,
    });
    expect(secretaria.authorized.length).toBe(1);
    expect(direcao.authorized.length).toBe(1);
    expect(secretaria.authorized[0]?.resource.reference.entityId).not.toBe(
      direcao.authorized[0]?.resource.reference.entityId,
    );
  });

  it("12. auditoria é consequência da política, não flag do recurso", () => {
    for (const record of DEMO_DOSSIER_RECORDS) {
      expect("requiresAccessLogging" in record).toBe(false);
    }
    const pedido = facts({
      capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
    });
    const decisao = decideAccess({
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: pedido,
      resource: describeDossierRecord(DEMO_CONFIDENTIAL_RECORD, ["resumo"]),
    });
    const trilha = buildAccessAuditRecords({
      facts: pedido,
      decisions: [decisao],
      auditIdFactory: (index) => `auditoria-demo-${index}`,
      policyRulesById: new Map(
        DEMO_DOSSIER_ACCESS_POLICY.rules.map((rule) => [rule.ruleId, rule]),
      ),
    });
    expect(trilha.length).toBe(1);
    expect(trilha[0]?.operationDefinitionId).toBe(
      DEMO_ACCESS_OPERATION_IDS.readContent,
    );
    expect(trilha[0]?.processingPurposeDefinitionId).toBeDefined();
    expect(trilha[0]?.legalOrInstitutionalBasisReference?.entityId).toBe(
      "ato-demo-competencia-direcao",
    );
  });

  it("12b. efeito condicionado exige requisito antes de disponibilizar", () => {
    const resource = describeDossierRecord(DEMO_CONFIDENTIAL_RECORD, [
      "resumo",
    ]);
    const semJustificativa = decideAccess({
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.supervision],
        processingPurposeDefinitionId:
          DEMO_PROCESSING_PURPOSE_IDS.networkSupervision,
      }),
      resource,
    });
    expect(semJustificativa.outcome.includeInProjection).toBe(false);
    expect(semJustificativa.outcome.unmetRequirementDefinitionIds).toEqual([
      "justificativa-de-finalidade",
    ]);

    const comJustificativa = decideAccess({
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.supervision],
        processingPurposeDefinitionId:
          DEMO_PROCESSING_PURPOSE_IDS.networkSupervision,
        satisfiedRequirementDefinitionIds: ["justificativa-de-finalidade"],
      }),
      resource,
    });
    expect(comJustificativa.outcome.includeInProjection).toBe(true);
    expect(comJustificativa.outcome.requiresAuditRecord).toBe(true);
  });

  it("política não homologada não disponibiliza nada", () => {
    const decisao = decideAccess({
      policy: { ...DEMO_DOSSIER_ACCESS_POLICY, homologated: false },
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
      }),
      resource: describeDossierRecord(DEMO_ATTENDANCE_RECORD, ["resumo"]),
    });
    expect(decisao.outcome.inconclusive).toBe(true);
    expect(decisao.outcome.includeInProjection).toBe(false);
  });

  it("17b. nova classificação de sensibilidade é reconhecida por configuração", () => {
    const inedito = {
      ...DEMO_ATTENDANCE_RECORD,
      recordId: "registro-sensibilidade-inedita",
      sensitivityLevelDefinitionId: "grau-inedito-de-sigilo",
    };
    const policy: DossierAccessPolicy = {
      ...DEMO_DOSSIER_ACCESS_POLICY,
      rules: [
        {
          ruleId: "regra-sensibilidade-inedita",
          priority: 1,
          match: {
            sensitivityLevelDefinitionIds: ["grau-inedito-de-sigilo"],
            capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.secretariat],
          },
          effect: {
            accessEffectDefinitionId: DEMO_ACCESS_EFFECT_IDS.granted,
            executorId: DOSSIER_ACCESS_EXECUTOR_IDS.grantAll,
          },
        },
      ],
    };
    const decisao = decideAccess({
      policy,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.secretariat],
      }),
      resource: describeDossierRecord(inedito, ["resumo"]),
    });
    expect(decisao.outcome.includeInProjection).toBe(true);
  });
});

describe("13F — projeção longitudinal e busca", () => {
  it("2b/8b. timeline reúne registros e documentos de fontes distintas", () => {
    const projecao = projectStudentLifeTimeline({
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
      }),
      sources: sources(),
      registry: registry(),
      producedAt: "2026-06-01T10:00:00Z",
    });
    const fontes = new Set(
      projecao.items.map((item) => item.sourceTypeDefinitionId),
    );
    expect(fontes.size).toBeGreaterThanOrEqual(1);
    expect(projecao.items.length).toBeGreaterThan(0);
  });

  it("8c. timeline não carrega capítulo de desenvolvimento como domínio", () => {
    const projecao = projectStudentLifeTimeline({
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.secretariat],
      }),
      sources: sources(),
      registry: registry(),
      producedAt: "2026-06-01T10:00:00Z",
    });
    for (const item of projecao.items) {
      expect("sourceModule" in item).toBe(false);
      expect(item.sourceTypeDefinitionId).not.toMatch(/^1[0-9][A-Z]$/);
      expect(item.sourceProjectionSchemaVersion).toBe(1);
    }
    expect(projecao.projectionSchemaVersion).toBe(1);
  });

  it("15. item retificado aparece com superação derivada, sem duplicar verdade", () => {
    const projecao = projectStudentLifeTimeline({
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.secretariat],
      }),
      sources: sources(),
      registry: registry(),
      producedAt: "2026-06-01T10:00:00Z",
    });
    const antigo = projecao.items.find(
      (item) =>
        item.sourceEntityReference.entityId ===
        DEMO_ATTENDANCE_RECORD.recordId,
    );
    const novo = projecao.items.find(
      (item) =>
        item.sourceEntityReference.entityId ===
        DEMO_ATTENDANCE_RECORD_CORRECTION.recordId,
    );
    expect(antigo?.supersededByEntityId).toBe(
      DEMO_ATTENDANCE_RECORD_CORRECTION.recordId,
    );
    expect(novo?.supersededByEntityId).toBeNull();
    for (const item of projecao.items) {
      expect("isSuperseded" in item).toBe(false);
    }
  });

  it("14. busca longitudinal respeita a janela de datas", () => {
    const projecao = projectStudentLifeTimeline({
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.secretariat],
      }),
      sources: sources(),
      registry: registry(),
      window: { from: "2026-05-01", to: "2026-05-31" },
      producedAt: "2026-06-01T10:00:00Z",
    });
    expect(projecao.items.length).toBeGreaterThan(0);
    for (const item of projecao.items) {
      expect(item.effectiveDate >= "2026-05-01").toBe(true);
      expect(item.effectiveDate <= "2026-05-31").toBe(true);
    }
  });

  it("16/17. busca não revela registro não autorizado nem por palavra do conteúdo", () => {
    const docente = searchAuthorizedDossier({
      query: "clínico",
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.teacher],
      }),
      sources: sources(),
      registry: registry(),
      producedAt: "2026-06-01T10:00:00Z",
    });
    expect(docente.hits.length).toBe(0);

    const direcao = searchAuthorizedDossier({
      query: "clínico",
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
      }),
      sources: sources(),
      registry: registry(),
      producedAt: "2026-06-01T10:00:00Z",
    });
    expect(direcao.hits.length).toBe(1);
  });

  it("6c. busca não vaza campo suprimido por snippet", () => {
    const orientacao = searchAuthorizedDossier({
      query: "encaminhamento",
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.guidance],
        processingPurposeDefinitionId:
          DEMO_PROCESSING_PURPOSE_IDS.pedagogicalFollowUp,
      }),
      sources: sources(),
      registry: registry(),
      producedAt: "2026-06-01T10:00:00Z",
    });
    // "encaminhamento" só existe em `detalhe`, campo suprimido para Orientação.
    expect(orientacao.hits.length).toBe(0);
  });

  it("fonte sem adaptador registrado não projeta nada e é diagnosticada", () => {
    const projecao = projectStudentLifeTimeline({
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.management],
      }),
      sources: [
        { sourceTypeDefinitionId: "fonte-sem-adaptador", entities: [{}] },
      ],
      registry: registry(),
      producedAt: "2026-06-01T10:00:00Z",
    });
    expect(projecao.items.length).toBe(0);
    expect(projecao.diagnostics.join(" ")).toContain("fonte-sem-adaptador");
  });

  it("fato de outro domínio entra por adaptador declarado pelo chamador", () => {
    const reg = registry();
    registerTimelineSource(reg, "fato-de-dominio-externo", (entity) => {
      const fato = entity as { id: string; data: string };
      const candidate: TimelineCandidate = {
        sourceTypeDefinitionId: "fato-de-dominio-externo",
        resource: {
          reference: {
            entityKindDefinitionId: "fato-institucional",
            entityId: fato.id,
          },
          resourceKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.dossierRecord,
          typeDefinitionId: "fato-externo-demo",
          sensitivityLevelDefinitionId:
            DEMO_DOSSIER_SENSITIVITY_IDS.institutional,
          subjectReferences: [
            {
              subjectRoleDefinitionId: "titular",
              reference: {
                entityKindDefinitionId: "aluno",
                entityId: DEMO_STUDENT_ID,
              },
            },
          ],
          scopeEntities: unitScope,
          projectableFieldPaths: ["resumo"],
          effectiveDate: fato.data,
          recordedAt: `${fato.data}T00:00:00Z`,
        },
        payload: { resumo: "Fato publicado por outro domínio." },
        effectiveDate: fato.data,
        recordedAt: `${fato.data}T00:00:00Z`,
        subjectStudentIds: [DEMO_STUDENT_ID],
      };
      return candidate;
    });

    const projecao = projectStudentLifeTimeline({
      studentId: DEMO_STUDENT_ID,
      policy: DEMO_DOSSIER_ACCESS_POLICY,
      facts: facts({
        capacityDefinitionIds: [DEMO_ACCESS_CAPACITY_IDS.teacher],
      }),
      sources: [
        {
          sourceTypeDefinitionId: "fato-de-dominio-externo",
          entities: [{ id: "fato-demo-001", data: "2026-04-15" }],
        },
      ],
      registry: reg,
      producedAt: "2026-06-01T10:00:00Z",
    });
    expect(projecao.items.map((item) => item.sourceTypeDefinitionId)).toEqual([
      "fato-de-dominio-externo",
    ]);
  });
});

describe("13F — ciclo de vida transversal", () => {
  it("13. políticas de retenção distintas para dois tipos documentais", () => {
    const resources = [
      describeDocumentRecord(DEMO_BIRTH_CERTIFICATE, ["tipo"]),
      describeDocumentRecord(
        {
          ...DEMO_BIRTH_CERTIFICATE,
          documentRecordId: "documento-demo-atestado",
          documentTypeDefinitionId: DEMO_DOCUMENT_TYPE_IDS.medicalCertificate,
          issuanceDate: "2026-01-05",
        },
        ["tipo"],
      ),
    ];
    const avaliacao = evaluateLifecycle({
      policy: DEMO_LIFECYCLE_POLICY,
      resources,
      evaluatedAt: "2026-06-01T10:00:00Z",
    });
    const consequencias = avaliacao.proposedActions.map(
      (action) => action.consequenceDefinitionId,
    );
    expect(consequencias).toContain("arquivar");
    expect(consequencias).not.toContain("preservar-permanentemente");
  });

  it("14b. ciclo de vida alcança também registros do prontuário", () => {
    const avaliacao = evaluateLifecycle({
      policy: DEMO_LIFECYCLE_POLICY,
      resources: [describeDossierRecord(DEMO_MULTI_STUDENT_RECORD, ["resumo"])],
      evaluatedAt: "2026-06-01T10:00:00Z",
    });
    expect(
      avaliacao.proposedActions.map((action) => action.consequenceDefinitionId),
    ).toEqual(["submeter-a-revisao", "restringir-acesso"]);
  });

  it("13b. consequência inédita entra por executor registrado", () => {
    const reg = createLifecycleConsequenceRegistry();
    registerLifecycleConsequenceExecutor(
      reg,
      "executor-demo-transferencia-de-arquivo",
      ({ resource, rule, declaration, dueDate }) => ({
        resourceReference: resource.reference,
        ruleId: rule.ruleId,
        consequenceDefinitionId: declaration.consequenceDefinitionId,
        executorId: declaration.executorId,
        dueDate,
      }),
    );
    const avaliacao = evaluateLifecycle({
      policy: {
        ...DEMO_LIFECYCLE_POLICY,
        rules: [
          {
            ruleId: "regra-inedita",
            resourceKindDefinitionIds: [
              DOSSIER_RESOURCE_KIND_IDS.dossierRecord,
            ],
            anchorDefinitionId: "data-do-fato",
            retentionDurationDays: 1,
            consequences: [
              {
                consequenceDefinitionId: "transferir-para-arquivo-permanente",
                executorId: "executor-demo-transferencia-de-arquivo",
              },
            ],
          },
        ],
      },
      resources: [describeDossierRecord(DEMO_ATTENDANCE_RECORD, ["resumo"])],
      evaluatedAt: "2026-06-01T10:00:00Z",
      registry: reg,
    });
    expect(avaliacao.proposedActions[0]?.consequenceDefinitionId).toBe(
      "transferir-para-arquivo-permanente",
    );
  });

  it("consequência sem executor não aplica nada e fica inconclusiva", () => {
    const avaliacao = evaluateLifecycle({
      policy: {
        ...DEMO_LIFECYCLE_POLICY,
        rules: [
          {
            ruleId: "regra-sem-executor",
            resourceKindDefinitionIds: [
              DOSSIER_RESOURCE_KIND_IDS.dossierRecord,
            ],
            anchorDefinitionId: "data-do-fato",
            retentionDurationDays: 1,
            consequences: [
              {
                consequenceDefinitionId: "efeito-desconhecido",
                executorId: "executor-inexistente",
              },
            ],
          },
        ],
      },
      resources: [describeDossierRecord(DEMO_ATTENDANCE_RECORD, ["resumo"])],
      evaluatedAt: "2026-06-01T10:00:00Z",
    });
    expect(avaliacao.proposedActions.length).toBe(0);
    expect(avaliacao.inconclusive.length).toBe(1);
  });

  it("política de ciclo de vida não homologada não produz consequência", () => {
    const avaliacao = evaluateLifecycle({
      policy: { ...DEMO_LIFECYCLE_POLICY, homologated: false },
      resources: [describeDossierRecord(DEMO_ATTENDANCE_RECORD, ["resumo"])],
      evaluatedAt: "2026-06-01T10:00:00Z",
    });
    expect(avaliacao.proposedActions.length).toBe(0);
  });
});

describe("13F — exposição analítica ao CIECE", () => {
  it("16b. publica fatos atômicos, nunca contagens", () => {
    const rows = documentFactRows({
      documents: DEMO_DOCUMENT_RECORDS,
      exposurePolicy: DEMO_ANALYTICAL_EXPOSURE_POLICY,
      resourceKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.documentRecord,
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const keys = Object.keys(row);
      expect(keys).not.toContain("quantidadeDocumentos");
      expect(keys).not.toContain("documentCount");
      expect(keys).not.toContain("pendingCount");
      expect(row.documentRecordId).toBeDefined();
      expect(row.documentTypeDefinitionId).toBeDefined();
      expect(row.originTypeId).toBeDefined();
    }
  });

  it("11b/16c. a existência de conteúdo sigiloso não é exposta ao cubo", () => {
    const registros = dossierRecordFactRows({
      records: DEMO_DOSSIER_RECORDS,
      exposurePolicy: DEMO_ANALYTICAL_EXPOSURE_POLICY,
      resourceKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.dossierRecord,
    });
    expect(
      registros.some((row) => row.recordId === DEMO_CONFIDENTIAL_RECORD.recordId),
    ).toBe(false);
    for (const row of registros) {
      expect(row.exposedAttributes).toEqual({});
      expect(JSON.stringify(row)).not.toContain("clínico");
    }
    const documentos = documentFactRows({
      documents: DEMO_DOCUMENT_RECORDS,
      exposurePolicy: DEMO_ANALYTICAL_EXPOSURE_POLICY,
      resourceKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.documentRecord,
    });
    expect(
      documentos.some(
        (row) => row.documentRecordId === DEMO_REPORT_DOCUMENT.documentRecordId,
      ),
    ).toBe(false);
  });

  it("fatos de representação, relação e responsabilidade são atômicos", () => {
    expect(
      documentRepresentationFactRows(DEMO_DOCUMENT_REPRESENTATIONS).length,
    ).toBe(2);
    expect(dossierRelationFactRows(DEMO_DOSSIER_RELATIONS).length).toBe(2);
    const responsabilidades = responsibilityFactRows(
      DEMO_RESPONSIBILITY_ASSIGNMENTS,
    );
    expect(responsabilidades.length).toBe(4);
    for (const row of responsabilidades) {
      expect(row.responsibilityCapacityDefinitionId).toBeDefined();
    }
  });

  it("exposição não homologada não publica nada", () => {
    const rows = documentFactRows({
      documents: DEMO_DOCUMENT_RECORDS,
      exposurePolicy: {
        ...DEMO_ANALYTICAL_EXPOSURE_POLICY,
        homologated: false,
      },
      resourceKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.documentRecord,
    });
    expect(rows.length).toBe(0);
  });
});

describe("13F — auditoria anti-rigidez e de fronteira", () => {
  const moduleFiles = [
    "dossier-types.ts",
    "dossier-access.ts",
    "dossier-records.ts",
    "dossier-lifecycle.ts",
    "dossier-projection.ts",
    "dossier-analytics.ts",
    "dossier-adapters.ts",
  ];

  const sourceOf = (file: string) =>
    readFileSync(
      path.join(process.cwd(), "src/features/student-life", file),
      "utf8",
    );

  it("18b. nenhuma taxonomia de prontuário ou documento está fixada em tipo", () => {
    const proibidos = [
      '"disciplinar"',
      '"saude"',
      '"pedagogico"',
      '"familiar"',
      '"administrativo"',
      '"laudo"',
      "| \"disciplinar\"",
    ];
    for (const file of moduleFiles) {
      const source = sourceOf(file);
      for (const termo of proibidos) {
        expect(source.includes(termo)).toBe(false);
      }
    }
  });

  it("19. o dossiê não se torna segunda fonte de matrícula, turma ou notas", () => {
    const proibidos = [
      "matriculas[]",
      "enrollments:",
      "classAllocations:",
      "grades:",
      "notas:",
      "transferencias:",
    ];
    for (const file of moduleFiles) {
      const source = sourceOf(file);
      for (const termo of proibidos) {
        expect(source.includes(termo)).toBe(false);
      }
    }
  });

  it("nenhum módulo do dossiê referencia capítulos do plano como domínio", () => {
    for (const file of moduleFiles) {
      const source = sourceOf(file);
      expect(source.includes('sourceModule')).toBe(false);
      expect(source.includes('"13A"')).toBe(false);
      expect(source.includes('"13B"')).toBe(false);
    }
  });

  it("nenhuma flag derivada é persistida nos contratos", () => {
    const source = sourceOf("dossier-types.ts");
    expect(source.includes("isSuperseded")).toBe(false);
    expect(source.includes("isLegalGuardian")).toBe(false);
    expect(source.includes("hasPendingDocuments")).toBe(false);
    expect(source.includes("requiresAccessLogging")).toBe(false);
  });

  it("fronteira: o dossiê não constitui inscrição, participação nem turma", () => {
    const proibidos = [
      "AcademicCycleEnrollment",
      "CycleParticipation",
      "ClassAllocation",
      "InstitutionalTransferProcess",
    ];
    for (const file of moduleFiles) {
      const source = sourceOf(file);
      for (const simbolo of proibidos) {
        expect(source.includes(simbolo)).toBe(false);
      }
    }
  });
});
