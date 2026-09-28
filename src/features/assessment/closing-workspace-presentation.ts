/**
 * 6D.3.4.4 — Closing Workspace 2.0: apresentação pura.
 *
 * Compõe EXCLUSIVAMENTE projeções canônicas já homologadas
 * (projectClosingAdmissibility, materializeResults, cadeia de fechamentos,
 * projectClosingDivergence, determineClosingImpact,
 * projectClosingRegularization) em frases humanas. Não calcula, não cria
 * requisito, não decide rito. Identificadores técnicos ficam apenas em
 * `technical` (Nível 3).
 */
import { instrumentRoster } from "./assessment-instruments";
import {
  can,
  CLOSING_ACTION_CAPABILITY,
  materializeResults,
  officialModel,
  previewModel,
  projectClosingAdmissibility,
  transitionAllowed,
  type ClosingContext,
} from "./period-closing";
import {
  determineClosingImpact,
  projectClosingRegularization,
  type ClosingImpactKind,
  type ClosingRegularizationPolicy,
  type HistoricalNormativeArchive,
} from "./period-closing-divergence";
import {
  CLOSING_ACTION_LABEL,
  type ClosingAction,
  type ClosingActor,
  type ClosingPendency,
  type MaterializedStudentResult,
  type PeriodClosingRecord,
} from "./period-closing-types";

export const CLOSE_CONFIRM_TITLE = "Fechar este período?";
export const CLOSE_CONFIRM_TEXT =
  "O fechamento registrará oficialmente a situação atual deste período. Alterações futuras serão tratadas como correções ou regularizações e não apagarão este histórico.";
export const AFTER_CLOSING_TEXT =
  "Este fechamento passa a integrar o histórico oficial do período. Correções posteriores não apagam este registro.";
export const CANNOT_CLOSE_TITLE = "Este período ainda não pode ser fechado.";
export const DIVERGENCE_TITLE = "Existem alterações posteriores a este fechamento.";
export const PROTECTED_VALUE_LABEL = "Resultado protegido";

/** Ação contextual oferecida junto a um requisito — só se a jornada existir. */
export type UnmetAction =
  | { kind: "cycle-act"; action: ClosingAction; label: string }
  | { kind: "open-period-assessment"; label: string }
  | { kind: "open-instrument"; instrumentId: string; label: string };

export type UnmetItem = { key: string; text: string; action?: UnmetAction };

export type ConferenceRow = {
  studentId: string;
  studentName: string;
  /** Frase do resultado; nunca "0" para ausência. */
  resultLine: string;
  valueDisclosure: "disclosed" | "suppressed";
  notes: string[];
};

export type ClosingDivergenceView =
  | { kind: "none" }
  | {
      kind: "divergent";
      impactLine: string;
      affectedStudentNames: string[];
      regularization:
        | { kind: "not-required"; text: string }
        | { kind: "required"; text: string; requirements: string[]; canProceed: boolean; blockedText?: string }
        | { kind: "impeded"; text: string }
        | { kind: "insufficient"; text: string };
    };

export type ClosingWorkspaceView =
  | {
      phase: "open";
      canClose: boolean;
      /** A política não declara nada a cumprir: fechamento direto. */
      direct: boolean;
      satisfied: string[];
      unmet: UnmetItem[];
      /** Retrato é prévia não oficial (regra ainda não homologada). */
      previewOnly: boolean;
      conference: ConferenceRow[];
      summary: string[];
    }
  | {
      phase: "closed";
      record: PeriodClosingRecord;
      closedLine: string;
      summary: string[];
      conference: ConferenceRow[];
      divergence: ClosingDivergenceView;
      technical: string[];
    };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fmt = (v: number) => String(v).replace(".", ",");

function conferenceRows(
  ctx: ClosingContext,
  results: readonly MaterializedStudentResult[],
  disclosed: boolean,
): ConferenceRow[] {
  const notApplicable = new Map<string, number>();
  for (const instrument of ctx.instruments) {
    const eligible = new Set(instrumentRoster(instrument, ctx.students).eligible.map((e) => e.student.id));
    for (const r of results)
      if (!eligible.has(r.studentId)) notApplicable.set(r.studentId, (notApplicable.get(r.studentId) ?? 0) + 1);
  }
  return results.map((r) => {
    const notes: string[] = [];
    const na = notApplicable.get(r.studentId) ?? 0;
    if (na) notes.push(`Não se aplica em ${plural(na, "instrumento", "instrumentos")}.`);
    if (r.coverage !== "integral")
      notes.push("Trajetória especial: cobertura parcial do período, sem nota presumida.");
    if (!disclosed)
      return { studentId: r.studentId, studentName: r.studentName, resultLine: PROTECTED_VALUE_LABEL, valueDisclosure: "suppressed", notes };
    if (r.unregistered.length)
      notes.push(
        `Não registrado em ${plural(r.unregistered.length, "instrumento", "instrumentos")}: ${r.unregistered.map((u) => u.reason).join("; ")}.`,
      );
    const resultLine =
      r.complete && r.consolidatedPeriodScore !== null
        ? `Resultado do período: ${fmt(r.consolidatedPeriodScore)}`
        : r.usedEntryVersions.length === 0
          ? "Sem resultado registrado"
          : "Composição indisponível — os registros não formam resultado do período";
    return { studentId: r.studentId, studentName: r.studentName, resultLine, valueDisclosure: "disclosed", notes };
  });
}

function summaryOf(results: readonly MaterializedStudentResult[], disclosed: boolean) {
  const lines = [plural(results.length, "estudante", "estudantes")];
  if (!disclosed) return lines;
  const complete = results.filter((r) => r.complete && r.consolidatedPeriodScore !== null).length;
  const unavailable = results.length - complete;
  const unregistered = results.filter((r) => r.unregistered.length).length;
  if (complete) lines.push(`${plural(complete, "resultado", "resultados")} do período`);
  if (unavailable) lines.push(`${plural(unavailable, "estudante", "estudantes")} sem resultado do período formado`);
  if (unregistered) lines.push(`${plural(unregistered, "estudante", "estudantes")} com “Não registrado”`);
  const special = results.filter((r) => r.coverage !== "integral").length;
  if (special) lines.push(`${plural(special, "trajetória especial", "trajetórias especiais")}`);
  return lines;
}

/** Converte os motivos canônicos em frases concretas, agrupadas por requisito. */
function unmetItems(ctx: ClosingContext, reasons: readonly ClosingPendency[], actor: ClosingActor, stage: ClosingContext["stage"]): UnmetItem[] {
  const requirements = ctx.rule?.closingAdmissibility?.requirements ?? [];
  const groups = new Map<string, ClosingPendency[]>();
  for (const p of reasons) {
    const key = p.requirementId ? `req:${p.requirementId}` : `code:${p.code}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const items: UnmetItem[] = [];
  for (const [key, list] of groups) {
    const req = requirements.find((r) => `req:${r.id}` === key);
    const first = list[0]!;
    if (req?.evaluatorId === "resultados-elegiveis-registrados" && list.every((p) => p.studentId)) {
      const n = new Set(list.map((p) => p.studentId)).size;
      items.push({
        key,
        text: `${plural(n, "estudante ainda precisa", "estudantes ainda precisam")} de resultado, conforme a regra deste período.`,
        action: { kind: "open-period-assessment", label: "Ver estudantes" },
      });
      continue;
    }
    if (req?.evaluatorId === "instrumentos-planejados-resolvidos") {
      const n = list.length;
      items.push({
        key,
        text:
          n === 1
            ? "Existe 1 instrumento planejado que ainda precisa ser resolvido."
            : `Existem ${n} instrumentos planejados que ainda precisam ser resolvidos.`,
        ...(n === 1 && first.instrumentId
          ? { action: { kind: "open-instrument" as const, instrumentId: first.instrumentId, label: "Ver instrumento" } }
          : {}),
      });
      continue;
    }
    if (req?.evaluatorId === "ato-do-fluxo-realizado" && first.code === "ato-requerido-nao-realizado") {
      const actionId = req.parameters?.["actionId"];
      const action = typeof actionId === "string" && actionId in CLOSING_ACTION_LABEL ? (actionId as ClosingAction) : undefined;
      const label = action ? CLOSING_ACTION_LABEL[action] : req.label;
      const available = action && can(actor, CLOSING_ACTION_CAPABILITY[action]) && transitionAllowed(action, stage);
      items.push({
        key,
        text: `${label} é exigida antes do fechamento.`,
        ...(available ? { action: { kind: "cycle-act" as const, action, label: `Realizar ${label.toLowerCase()}` } } : {}),
      });
      continue;
    }
    // Demais motivos: o texto canônico por extenso, sem generalizar.
    for (const text of new Set(list.map((p) => (p.studentName ? `${p.studentName}: ${p.message}` : p.message))))
      items.push({ key: `${key}:${text}`, text });
  }
  return items;
}

export function projectClosingWorkspace(args: {
  ctx: ClosingContext;
  actor: ClosingActor;
  current: PeriodClosingRecord | undefined;
  archive: HistoricalNormativeArchive;
  regularizationPolicies: readonly ClosingRegularizationPolicy[];
  /** Mesma fronteira de divulgação da Avaliação do período. */
  valueReadCapability?: string;
}): ClosingWorkspaceView {
  const { ctx, actor, current } = args;
  const disclosed =
    !args.valueReadCapability || (actor.capabilities as readonly string[]).includes(args.valueReadCapability);

  if (current && ctx.stage === "fechado") {
    const impact = determineClosingImpact({ record: current, currentFacts: ctx, archive: args.archive });
    const regularization = projectClosingRegularization({ impact, policies: args.regularizationPolicies, actor });
    return {
      phase: "closed",
      record: current,
      closedLine: `Fechado por ${current.closedBy.actorName} (${current.closedBy.profileLabel})`,
      summary: summaryOf(current.results, disclosed),
      // Conferência do fechamento é o retrato congelado, nunca reprojetado.
      conference: conferenceRows(ctx, current.results, disclosed),
      divergence: divergenceView(impact.kind, impact.changes, current, regularization, disclosed),
      technical: [
        `Fechamento ${current.id} · versão ${current.version}`,
        `Regra ${current.ruleId} · versão ${current.ruleVersion}`,
        `Configuração ${current.configurationId}${current.configurationVersion !== undefined ? ` · versão ${current.configurationVersion}` : ""}`,
        ...impact.undeterminedReasons,
        regularization.provenance.reason,
      ],
    };
  }

  const admissibility = projectClosingAdmissibility(ctx, actor);
  const capability = CLOSING_ACTION_CAPABILITY["fechamento-oficial"];
  const hasCapability = can(actor, capability);
  const unmet = unmetItems(ctx, admissibility.blockingReasons, actor, ctx.stage);
  if (!hasCapability)
    unmet.push({ key: "capacidade", text: "Este perfil não tem autorização institucional para fechar o período." });
  const model = officialModel(ctx) ?? previewModel(ctx);
  const results = model ? materializeResults(ctx, model) : [];
  const satisfied = admissibility.requirements.filter((r) => r.status === "atendido").map((r) => r.requirement.label);
  if (ctx.officialPeriod && ctx.calendarId) satisfied.unshift("Período do calendário homologado");
  if (officialModel(ctx)) satisfied.unshift("Regra de avaliação homologada");
  return {
    phase: "open",
    canClose: admissibility.canClose && hasCapability,
    direct: admissibility.normativeSufficiency === "suficiente" && admissibility.requirements.length === 0,
    satisfied,
    unmet,
    previewOnly: !officialModel(ctx),
    conference: conferenceRows(ctx, results, disclosed),
    summary: summaryOf(results, disclosed),
  };
}

function divergenceView(
  kind: ClosingImpactKind,
  changes: ReturnType<typeof determineClosingImpact>["changes"],
  record: PeriodClosingRecord,
  reg: ReturnType<typeof projectClosingRegularization>,
  disclosed: boolean,
): ClosingDivergenceView {
  if (kind === "no-divergence") return { kind: "none" };
  const names = [...new Set(changes.map((c) => c.studentId))].map(
    (id) => record.results.find((r) => r.studentId === id)?.studentName ?? "Estudante",
  );
  const impactLine =
    kind === "divergence-without-material-impact"
      ? "As alterações não mudam o que foi oficializado neste fechamento."
      : kind === "divergence-with-material-impact"
        ? `As alterações mudariam o que foi oficializado para ${plural(names.length, "estudante", "estudantes")}.`
        : "Não foi possível determinar automaticamente o efeito dessas alterações sobre o fechamento.";
  const regularization: Extract<ClosingDivergenceView, { kind: "divergent" }>["regularization"] =
    reg.status === "rito-declarado"
      ? {
          kind: "required",
          text: "A regra deste período exige regularização do fechamento.",
          requirements: reg.requirements.map((r) => r.label),
          canProceed: reg.canProceed,
          ...(reg.canProceed ? {} : { blockedText: "Este perfil não tem a autorização institucional exigida para conduzir a regularização." }),
        }
      : reg.status === "regularizacao-impedida"
        ? { kind: "impeded", text: "A regra deste período declara que a regularização não pode ser feita por este caminho." }
        : reg.status === "insuficiencia-normativa"
          ? { kind: "insufficient", text: "Não há regra suficiente para determinar automaticamente o procedimento." }
          : { kind: "not-required", text: "Nenhuma regularização é exigida pela regra deste período." };
  return { kind: "divergent", impactLine, affectedStudentNames: disclosed ? names : [], regularization };
}
