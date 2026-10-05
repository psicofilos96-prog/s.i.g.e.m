import type { BulkOperation } from "../bulk-engine";
import { recordReview } from "@/features/data-quality/quality-source";

export type QualityReviewPayload = Readonly<{ fingerprint: string; evidenceSha256: string | null; ruleId: string; ruleVersion: number;
  state: "revisado" | "dispensado" | "reaberto"; reason: string; currentState: string }>;

/** Revisão em lote: cada item passa pelo writer canônico `record_data_quality_review` (capability + cabeça esperada). */
export const qualityReviewBulk: BulkOperation<QualityReviewPayload> = {
  id: "revisao-qualidade-dos-dados", version: 1, label: "Revisar itens de qualidade", mode: "parcial", maxItems: 200,
  validate: (i) => {
    const p = i.payload;
    if (p.reason.trim().length < 3) return "Motivo obrigatório.";
    if (!p.evidenceSha256) return "Evidência atual indisponível.";
    if (p.currentState === "resolvido") return "Item já resolvido na fonte.";
    if (p.state === "reaberto" ? p.currentState === "aberto" : p.currentState !== "aberto") return "Estado atual não permite esta revisão.";
    return null;
  },
  executeOne: async (i) => {
    const p = i.payload;
    await recordReview({ fingerprint: p.fingerprint, evidenceSha256: p.evidenceSha256!, ruleId: p.ruleId, ruleVersion: p.ruleVersion,
      schoolId: i.scope, state: p.state, reason: p.reason, expectedHead: i.expectedBase });
  },
};
