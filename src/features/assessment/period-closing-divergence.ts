/**
 * 6D.3.4.3 — Divergência Pós-Fechamento e Impacto (domínio puro).
 *
 * Resultado avaliativo e fechamento são fatos distintos. Esta etapa apenas
 * PROJETA: (A) divergência pelos vínculos versionados; (B) impacto factual,
 * rematerializando com a governança HISTÓRICA do ato; (C) regularização
 * segundo política homologada. Nada aqui cria, altera ou recalcula
 * um fechamento — uma nova versão continua exigindo ato humano explícito.
 */
import type { AssessmentCorrectionInput, AssessmentPeriodClosingFact } from "./assessment-correction";
import type { AssessmentEntryVersion } from "./assessment-entry-versions";
import { officialCurrentVersionsForStudent } from "./assessment-canonical-inputs";
import type { AssessmentInstrument } from "./assessment-types";
import { officialModelFromRule } from "./assessment-rule-model";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { AssessmentConfiguration } from "./assessment-types";
import { materializeResults, type ClosingContext } from "./period-closing";
import type { ClosingActor, MaterializedStudentResult, PeriodClosingRecord } from "./period-closing-types";

// ------------------------------------------------------------ A. Divergência

export type UsedVersionDivergence = {
  studentId: string;
  logicalEntryId: string;
  usedVersionId: string;
  usedVersion: number;
  /** `vigente` | `substituida` | `versao-utilizada-nao-localizada` */
  status: "vigente" | "substituida" | "versao-utilizada-nao-localizada";
  /** Versão vigente da cadeia, alcançada pelos vínculos `supersedesVersionId`. */
  currentVersionId?: string;
  currentVersion?: number;
  /** Caminho de substituição a partir da versão utilizada (exclusive). */
  successorVersionIds: string[];
};

/**
 * 6D.3.5.4 — Fato oficial vigente cuja cadeia NÃO estava entre as utilizadas
 * pelo ato (não substitui nenhuma versão usada). Relevância é decidida pelo
 * universo declarado na regra HISTÓRICA (tipos de instrumento da composição e
 * da recuperação periódica), nunca por título, data ou nome.
 */
export type NewRelevantFact = {
  studentId: string;
  logicalEntryId: string;
  instrumentId: string;
  instrumentTypeId: string;
  /** Versão vigente considerada da cadeia (a cadeia é preservada). */
  currentVersionId: string;
  currentVersion: number;
  /** `relevante` pela regra histórica; `indeterminada` quando ela não foi recuperada. */
  relevance: "relevante" | "indeterminada";
};

/** Universo factual do fechamento, segundo a regra histórica (quando recuperada). */
export type ClosingFactUniverse = {
  instruments: readonly AssessmentInstrument[];
  /** `undefined` ⇒ regra histórica indisponível: relevância indeterminada. */
  relevantInstrumentTypeIds: ReadonlySet<string> | undefined;
};

export type DivergenceOrigin = "version-succession" | "new-relevant-fact";

export type ClosingDivergenceProjection = {
  closingId: string;
  closingVersion: number;
  hasDivergence: boolean;
  /** Naturezas distintas da divergência, preservadas na proveniência. */
  origins: DivergenceOrigin[];
  used: UsedVersionDivergence[];
  stillCurrent: UsedVersionDivergence[];
  superseded: UsedVersionDivergence[];
  unresolved: UsedVersionDivergence[];
  newFacts: NewRelevantFact[];
};

/** Tipos de instrumento que a regra histórica declara capazes de afetar o resultado. */
export function historicalRelevantInstrumentTypeIds(
  rule: InstitutionalAssessmentRule,
): ReadonlySet<string> {
  const ids = new Set(rule.categories.flatMap((c) => c.instrumentTypeIds));
  if (rule.periodicRecovery?.enabled)
    for (const t of rule.periodicRecovery.instrumentTypeIds) ids.add(t);
  return ids;
}

/**
 * Deriva a divergência EXCLUSIVAMENTE pelos vínculos versionados: segue
 * `supersedesVersionId` a partir da versão utilizada. Nunca compara datas,
 * autores, valores ou textos.
 */
export function projectClosingDivergence(
  record: PeriodClosingRecord,
  versions: readonly AssessmentEntryVersion[],
  universe?: ClosingFactUniverse,
): ClosingDivergenceProjection {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const successorOf = new Map<string, AssessmentEntryVersion>();
  for (const v of versions) if (v.supersedesVersionId) successorOf.set(v.supersedesVersionId, v);

  const used = record.results.flatMap((result) =>
    result.usedEntryVersions.map((ref): UsedVersionDivergence => {
      const base = { studentId: result.studentId, logicalEntryId: ref.logicalEntryId, usedVersionId: ref.versionId, usedVersion: ref.version };
      if (!byId.has(ref.versionId))
        return { ...base, status: "versao-utilizada-nao-localizada", successorVersionIds: [] };
      const path: string[] = [];
      let cursor = byId.get(ref.versionId)!;
      const seen = new Set([cursor.id]);
      for (let next = successorOf.get(cursor.id); next && !seen.has(next.id); next = successorOf.get(cursor.id)) {
        path.push(next.id);
        seen.add(next.id);
        cursor = next;
      }
      return {
        ...base,
        status: path.length ? "substituida" : "vigente",
        currentVersionId: cursor.id,
        currentVersion: cursor.version,
        successorVersionIds: path,
      };
    }),
  );
  const superseded = used.filter((u) => u.status === "substituida");
  const unresolved = used.filter((u) => u.status === "versao-utilizada-nao-localizada");
  const newFacts = universe ? newOfficialFacts(record, versions, universe) : [];
  const origins: DivergenceOrigin[] = [
    ...(superseded.length || unresolved.length ? (["version-succession"] as const) : []),
    ...(newFacts.length ? (["new-relevant-fact"] as const) : []),
  ];
  return {
    closingId: record.id,
    closingVersion: record.version,
    hasDivergence: origins.length > 0,
    origins,
    newFacts,
    used,
    stillCurrent: used.filter((u) => u.status === "vigente"),
    superseded,
    unresolved,
  };
}

/**
 * Cadeias oficiais vigentes (rascunho nunca entra — mesma seleção canônica do
 * motor) do período e dos estudantes do ato, ausentes do conjunto utilizado.
 */
function newOfficialFacts(
  record: PeriodClosingRecord,
  versions: readonly AssessmentEntryVersion[],
  universe: ClosingFactUniverse,
): NewRelevantFact[] {
  const instruments = universe.instruments.filter((i) => i.periodId === record.scope.periodId);
  const typeIds = universe.relevantInstrumentTypeIds;
  return record.results.flatMap((result) => {
    const usedLogical = new Set(result.usedEntryVersions.map((u) => u.logicalEntryId));
    return officialCurrentVersionsForStudent({ studentId: result.studentId, instruments, versions })
      .filter(({ version }) => !usedLogical.has(version.logicalEntryId))
      .filter(({ instrument }) => !typeIds || typeIds.has(instrument.instrumentTypeId))
      .map(({ version, instrument }): NewRelevantFact => ({
        studentId: result.studentId,
        logicalEntryId: version.logicalEntryId,
        instrumentId: instrument.id,
        instrumentTypeId: instrument.instrumentTypeId,
        currentVersionId: version.id,
        currentVersion: version.version,
        relevance: typeIds ? "relevante" : "indeterminada",
      }));
  });
}

// ----------------------------------------------------------------- B. Impacto

export type ClosingImpactKind =
  | "no-divergence"
  | "divergence-without-material-impact"
  | "divergence-with-material-impact"
  | "impact-undetermined";

/** Arquivo de artefatos normativos por identidade + versão. Nunca "o vigente". */
export type HistoricalNormativeArchive = {
  rule: (ruleId: string, ruleVersion: number) => InstitutionalAssessmentRule | undefined;
  configuration: (
    configurationId: string,
    configurationVersion: number | undefined,
  ) => AssessmentConfiguration | undefined;
};

export type MaterialFactChange = {
  studentId: string;
  /** Fato do snapshot que mudaria: identificador aberto (ex.: `categoria:cat-1`). */
  factId: string;
  materialized: unknown;
  rematerialized: unknown;
};

export type ClosingImpactProjection = {
  kind: ClosingImpactKind;
  divergence: ClosingDivergenceProjection;
  changes: MaterialFactChange[];
  undeterminedReasons: string[];
  provenance: {
    closingId: string;
    closingVersion: number;
    ruleId: string;
    ruleVersion: number;
    configurationId: string;
    configurationVersion?: number;
    /** Presentes só quando os artefatos históricos foram recuperados. */
    analyzedWithRule?: { id: string; version: number };
    analyzedWithConfiguration?: { id: string; version?: number };
    analyzedWithModelStatus?: string;
  };
};

/** Fatos materiais do snapshot — sem IDs de versão, que não são fato material. */
function materialFacts(r: MaterializedStudentResult): Record<string, unknown> {
  const facts: Record<string, unknown> = {
    "resultado-do-periodo": r.consolidatedPeriodScore,
    "arredondamento-do-periodo": r.rounded,
    completude: r.complete,
    cobertura: r.coverage,
    "nao-registrado": r.unregistered.map((u) => u.reason).sort(),
  };
  for (const c of r.categories) facts[`categoria:${c.categoryId}`] = { value: c.value, rounded: c.rounded };
  return facts;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * "Se este fechamento fosse materializado agora, com os fatos vigentes e a
 * MESMA governança do ato, algum fato materializado seria diferente?"
 *
 * `currentFacts` fornece fatos vigentes (versões, instrumentos, estudantes);
 * regra e configuração são SEMPRE as do arquivo histórico. Artefato ausente ⇒
 * `impact-undetermined`, nunca a regra atual.
 */
export function determineClosingImpact(args: {
  record: PeriodClosingRecord;
  currentFacts: ClosingContext;
  archive: HistoricalNormativeArchive;
}): ClosingImpactProjection {
  const { record, currentFacts, archive } = args;
  const historicalRule = archive.rule(record.ruleId, record.ruleVersion);
  const divergence = projectClosingDivergence(record, currentFacts.versions, {
    instruments: currentFacts.instruments,
    relevantInstrumentTypeIds:
      historicalRule && historicalRule.id === record.ruleId && historicalRule.version === record.ruleVersion
        ? historicalRelevantInstrumentTypeIds(historicalRule)
        : undefined,
  });
  const provenance: ClosingImpactProjection["provenance"] = {
    closingId: record.id,
    closingVersion: record.version,
    ruleId: record.ruleId,
    ruleVersion: record.ruleVersion,
    configurationId: record.configurationId,
    ...(record.configurationVersion !== undefined ? { configurationVersion: record.configurationVersion } : {}),
  };
  const out = (kind: ClosingImpactKind, changes: MaterialFactChange[] = [], undeterminedReasons: string[] = []) => ({
    kind,
    divergence,
    changes,
    undeterminedReasons,
    provenance,
  });

  if (!divergence.hasDivergence) return out("no-divergence");
  if (divergence.unresolved.length)
    return out("impact-undetermined", [], [
      "Há versão utilizada pelo fechamento que não pode ser localizada entre os fatos avaliativos.",
    ]);

  const rule = historicalRule;
  const configuration = archive.configuration(record.configurationId, record.configurationVersion);
  const reasons: string[] = [];
  if (!rule || rule.id !== record.ruleId || rule.version !== record.ruleVersion)
    reasons.push(`A regra ${record.ruleId} versão ${record.ruleVersion}, usada no ato, não foi recuperada com segurança.`);
  if (
    !configuration ||
    configuration.id !== record.configurationId ||
    configuration.version !== record.configurationVersion
  )
    reasons.push(`A configuração ${record.configurationId} da versão usada no ato não foi recuperada com segurança.`);
  const model = rule && !reasons.length ? officialModelFromRule(rule) : null;
  if (rule && !reasons.length && !model)
    reasons.push("A regra histórica recuperada não produz modelo oficial de composição.");
  if (reasons.length || !model || !rule || !configuration) return out("impact-undetermined", [], reasons);

  provenance.analyzedWithRule = { id: rule.id, version: rule.version };
  provenance.analyzedWithConfiguration = {
    id: configuration.id,
    ...(configuration.version !== undefined ? { version: configuration.version } : {}),
  };
  provenance.analyzedWithModelStatus = model.normativeStatus;

  const again = materializeResults({ ...currentFacts, rule, configuration }, model);
  const before = new Map(record.results.map((r) => [r.studentId, r]));
  const after = new Map(again.map((r) => [r.studentId, r]));
  const changes: MaterialFactChange[] = [];
  for (const studentId of new Set([...before.keys(), ...after.keys()])) {
    const b = before.get(studentId);
    const a = after.get(studentId);
    if (!b || !a) {
      changes.push({ studentId, factId: "presenca-no-snapshot", materialized: Boolean(b), rematerialized: Boolean(a) });
      continue;
    }
    const fb = materialFacts(b);
    const fa = materialFacts(a);
    for (const factId of new Set([...Object.keys(fb), ...Object.keys(fa)]))
      if (!same(fb[factId], fa[factId]))
        changes.push({ studentId, factId, materialized: fb[factId] ?? null, rematerialized: fa[factId] ?? null });
  }
  return out(changes.length ? "divergence-with-material-impact" : "divergence-without-material-impact", changes);
}

// ------------------------------------------------------------ C. Regularização

export type ClosingRegularizationRequirement = {
  id: string;
  label: string;
  /** Natureza aberta declarada (ex.: justificativa, documento, autorização). */
  natureId: string;
};

/** Política homologada de regularização. Nenhuma resposta é universal. */
export type ClosingRegularizationPolicy = {
  id: string;
  version: number;
  homologated: boolean;
  appliesToImpactKinds: readonly ClosingImpactKind[];
  /** Desfecho declarado, identificador aberto (ex.: retificacao-admissivel, reabertura-exigida, impedida). */
  outcomeId: string;
  /** A política declara o desfecho como impedimento? */
  blocksRegularization?: boolean;
  requiredCapabilityIds: readonly string[];
  requirements: readonly ClosingRegularizationRequirement[];
};

export type ClosingRegularizationProjection = {
  status: "sem-divergencia" | "nenhuma-acao-exigida" | "rito-declarado" | "regularizacao-impedida" | "insuficiencia-normativa";
  outcomeId?: string;
  requirements: readonly ClosingRegularizationRequirement[];
  requiredCapabilityIds: readonly string[];
  missingCapabilityIds: string[];
  /** O agente pode executar o rito declarado agora? */
  canProceed: boolean;
  /** Esta etapa NUNCA cria versão de fechamento. */
  createsClosingVersion: false;
  provenance: {
    closingId: string;
    closingVersion: number;
    impactKind: ClosingImpactKind;
    policyId?: string;
    policyVersion?: number;
    reason: string;
  };
};

export function projectClosingRegularization(args: {
  impact: ClosingImpactProjection;
  policies: readonly ClosingRegularizationPolicy[];
  actor?: Pick<ClosingActor, "capabilities">;
}): ClosingRegularizationProjection {
  const { impact, actor } = args;
  const base = {
    requirements: [] as ClosingRegularizationRequirement[],
    requiredCapabilityIds: [] as string[],
    missingCapabilityIds: [] as string[],
    canProceed: false,
    createsClosingVersion: false as const,
  };
  const prov = (reason: string, policy?: ClosingRegularizationPolicy) => ({
    closingId: impact.provenance.closingId,
    closingVersion: impact.provenance.closingVersion,
    impactKind: impact.kind,
    ...(policy ? { policyId: policy.id, policyVersion: policy.version } : {}),
    reason,
  });
  if (impact.kind === "no-divergence")
    return { ...base, status: "sem-divergencia", provenance: prov("As versões utilizadas continuam vigentes.") };

  const policy = args.policies.find((p) => p.homologated && p.appliesToImpactKinds.includes(impact.kind));
  if (!policy) {
    if (impact.kind === "divergence-without-material-impact")
      return {
        ...base,
        status: "nenhuma-acao-exigida",
        provenance: prov("Nenhum fato materializado mudaria e nenhuma política homologada declara rito para este caso."),
      };
    return {
      ...base,
      status: "insuficiencia-normativa",
      provenance: prov("Não existe política homologada que determine a regularização deste caso."),
    };
  }
  const missing = policy.requiredCapabilityIds.filter(
    (c) => !(actor?.capabilities as readonly string[] | undefined)?.includes(c),
  );
  const blocked = Boolean(policy.blocksRegularization);
  return {
    status: blocked ? "regularizacao-impedida" : "rito-declarado",
    outcomeId: policy.outcomeId,
    requirements: policy.requirements,
    requiredCapabilityIds: policy.requiredCapabilityIds,
    missingCapabilityIds: missing,
    canProceed: !blocked && missing.length === 0,
    createsClosingVersion: false,
    provenance: prov(`Rito declarado pela política ${policy.id} v${policy.version}.`, policy),
  };
}

// ------------------------------------------- 6. Contexto do resolvedor de correção

/** Traduz o fechamento vigente no fato consultado pelo AssessmentCorrectionResolver. */
export function closingFactForCorrection(
  record: PeriodClosingRecord | undefined,
  periodLabel: string,
): AssessmentPeriodClosingFact | undefined {
  return record ? { closingId: record.id, closingVersion: record.version, periodLabel } : undefined;
}

/** Acrescenta ao input do resolvedor o fechamento vigente, sem decidir nada. */
export function withCurrentClosing(
  input: Omit<AssessmentCorrectionInput, "periodClosing">,
  record: PeriodClosingRecord | undefined,
  periodLabel: string,
): AssessmentCorrectionInput {
  const fact = closingFactForCorrection(record, periodLabel);
  return fact ? { ...input, periodClosing: fact } : { ...input };
}
