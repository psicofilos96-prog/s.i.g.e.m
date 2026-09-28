/**
 * 6D.3.2.5-A — Integração controlada da Pauta 2.0 no Diário.
 *
 * Configuração/dado do laboratório de campo: política de correção
 * demonstrativa, política de "não registrado" e repositório em memória das
 * versões oficiais. Nenhum domínio novo: a página só monta as peças
 * homologadas (projeção 12L-like, rascunho, lote, correção focal).
 */
import { useSyncExternalStore } from "react";
import { FIELD_LAB_INSTRUMENT_ID, fieldLabOfficialVersions, type FieldLabMode } from "./assessment-entry-field-fixture";
import { periodLabVersions } from "./assessment-period-lab-fixture";
import type { AssessmentCorrectionPolicy } from "./assessment-correction";
import type { AssessmentEntryBatchAct } from "./assessment-entry-batch";
import type { MissingEntryPolicyProjection } from "./assessment-entry-projection";
import type { AssessmentEntryVersion } from "./assessment-entry-versions";

/** Política DEMONSTRATIVA declarada para o laboratório, não norma da rede. */
export const FIELD_CORRECTION_POLICIES: readonly AssessmentCorrectionPolicy[] = [
  {
    id: "pol-demo-correcao-laboratorio",
    version: 1,
    label: "Correção de resultado — política demonstrativa do laboratório",
    homologated: true,
    appliesWhenPeriodClosing: "absent",
    outcome: "admissible",
    requiredCapabilities: [],
    requirements: [
      {
        code: "justificativa",
        label: "Justificativa da correção",
        provenance: "Exigida pela política demonstrativa do laboratório de campo (6D.3.2.5).",
      },
    ],
    disclosesNormativeContext: true,
  },
];

export const FIELD_MISSING_ENTRY_POLICY: MissingEntryPolicyProjection = {
  requiresReason: true,
  admissibleReasons: [
    { id: "mot-demo-nao-realizou", label: "Não realizou o instrumento" },
    { id: "mot-demo-afastamento", label: "Afastamento registrado no período" },
  ],
  allowsCustomReason: false,
};

type Bucket = { versions: AssessmentEntryVersion[]; acts: AssessmentEntryBatchAct[] };

function createFieldVersionStore() {
  const buckets = new Map<string, Bucket>();
  const listeners = new Set<() => void>();
  let tick = 0;
  let mode: FieldLabMode = "numerica";
  const bucket = (instrumentId: string) => {
    const key = `${instrumentId}::${mode}`;
    let b = buckets.get(key);
    if (!b) {
      b = { versions: instrumentId === FIELD_LAB_INSTRUMENT_ID ? fieldLabOfficialVersions(instrumentId, mode) : mode === "numerica" ? periodLabVersions(instrumentId) : [], acts: [] };
      buckets.set(key, b);
    }
    return b;
  };
  const emit = () => {
    tick += 1;
    listeners.forEach((l) => l());
  };
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    tick: () => tick,
    /** Ensaio demonstrativo ativo; cada natureza tem seu próprio repositório. */
    mode: () => mode,
    setMode(next: FieldLabMode) {
      if (next === mode) return;
      mode = next;
      emit();
    },
    versions: (instrumentId: string): readonly AssessmentEntryVersion[] => bucket(instrumentId).versions,
    acts: (instrumentId: string): readonly AssessmentEntryBatchAct[] => bucket(instrumentId).acts,
    appendBatch(instrumentId: string, versions: readonly AssessmentEntryVersion[], act: AssessmentEntryBatchAct) {
      const b = bucket(instrumentId);
      b.versions = [...b.versions, ...versions];
      b.acts = [...b.acts, act];
      emit();
    },
    appendVersion(instrumentId: string, version: AssessmentEntryVersion) {
      const b = bucket(instrumentId);
      b.versions = [...b.versions, version];
      emit();
    },
  };
}

export const fieldVersionStore = createFieldVersionStore();

export function useFieldVersionTick(): number {
  return useSyncExternalStore(fieldVersionStore.subscribe, fieldVersionStore.tick, fieldVersionStore.tick);
}
