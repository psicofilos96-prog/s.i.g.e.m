/**
 * Etapa 12F — repositório em memória das regras avaliativas (estado da aba).
 * Contrato pensado para trocar por persistência sem refazer a interface.
 * Persistência real permanece pendente antes de qualquer uso produtivo.
 */
import { adoptCycleNomenclature } from "./assessment-rule-model";
import { useSyncExternalStore } from "react";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import {
  canRemoveRule,
  createRule,
  duplicateRule,
  mutateRule,
  transitionRule,
  type RuleMutation,
  type RuleMutationResult,
  type RuleTransition,
} from "./assessment-rule-governance";
import type { InstitutionalAssessmentRule, RuleActor } from "./assessment-rule-types";

export type AssessmentRuleRepository = {
  list(): InstitutionalAssessmentRule[];
  create(
    actor: RuleActor,
    input: {
      name: string;
      academicYearId: string;
      calendarId: string;
      stageIds?: string[];
      strategy?: InstitutionalAssessmentRule["strategy"];
    },
  ): RuleMutationResult;
  get(id: string): InstitutionalAssessmentRule | undefined;
  mutate(id: string, actor: RuleActor, m: RuleMutation): RuleMutationResult;
  transition(
    id: string,
    actor: RuleActor,
    t: RuleTransition,
    opts?: { blockingErrors?: number; requiredPending?: number },
  ): RuleMutationResult;
  duplicate(
    id: string,
    actor: RuleActor,
    opts?: { academicYearId?: string; calendarId?: string; name?: string },
  ): RuleMutationResult;
  remove(id: string, actor: RuleActor, used?: boolean): RuleMutationResult;
  subscribe(fn: () => void): () => void;
};

export function createInMemoryAssessmentRuleRepository(
  seed: InstitutionalAssessmentRule[] = createAssessmentRuleFixtures(),
): AssessmentRuleRepository {
  let items = seed.map((rule) => adoptCycleNomenclature(rule));
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const missing: RuleMutationResult = { ok: false, reason: "Regra avaliativa não encontrada." };
  const replace = (res: RuleMutationResult) => {
    if (res.ok) {
      const exists = items.some((r) => r.id === res.rule.id);
      items = exists
        ? items.map((r) => (r.id === res.rule.id ? res.rule : r))
        : [...items, res.rule];
      emit();
    }
    return res;
  };
  return {
    list: () => items,
    create: (actor, input) => replace(createRule(actor, input)),
    get: (id) => items.find((r) => r.id === id),
    mutate: (id, actor, m) => {
      const rule = items.find((r) => r.id === id);
      return rule ? replace(mutateRule(rule, actor, m)) : missing;
    },
    transition: (id, actor, t, opts) => {
      const rule = items.find((r) => r.id === id);
      return rule ? replace(transitionRule(rule, actor, t, opts)) : missing;
    },
    duplicate: (id, actor, opts) => {
      const rule = items.find((r) => r.id === id);
      return rule ? replace(duplicateRule(rule, actor, opts)) : missing;
    },
    remove: (id, actor, used = false) => {
      const rule = items.find((r) => r.id === id);
      if (!rule) return missing;
      if (actor.role !== "supervisao")
        return { ok: false, reason: "Somente a Supervisão de Ensino exclui rascunhos." };
      const allowed = canRemoveRule(rule, used);
      if (!allowed.allowed) return { ok: false, reason: allowed.reason };
      items = items.filter((r) => r.id !== id);
      emit();
      return { ok: true, rule };
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const assessmentRuleRepository = createInMemoryAssessmentRuleRepository();

export function useAssessmentRules(repo: AssessmentRuleRepository = assessmentRuleRepository) {
  return useSyncExternalStore(repo.subscribe, repo.list, repo.list);
}
