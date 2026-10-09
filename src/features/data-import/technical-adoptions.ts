/**
 * NIMPORT.STANDARD.1 — cargas técnicas 2026 adotadas no pipeline padrão (proveniência, nunca fato novo).
 * Reconhecimento por SHA-256: arquivo já adotado ⇒ só prévia (dry-run) e comparação, nunca novo lote aplicável.
 */
import { importRpc } from "./import-source";

export type TechnicalAdoption = Readonly<{
  id: string; adapter_id: string; adapter_version: number; parser_ref: string; source_name: string; source_sha256: string;
  logical_batch_key: string; idempotency_key: string; target_counts: Record<string, number>;
  reported_result: Record<string, unknown>; executed_at: string; adopted_at: string;
}>;

export type SourceRecognition = Readonly<{
  adoptions: ReadonlyArray<{ id: string; parser_ref: string; source_name: string; target_counts: Record<string, number>; executed_at: string; idempotency_key: string }>;
  batches: ReadonlyArray<{ id: string; adapter_id: string; row_count: number; received_at: string }>;
}>;

export async function listTechnicalAdoptions(): Promise<TechnicalAdoption[]> {
  const { data, error } = await importRpc("import_technical_adoptions_list", {});
  if (error) throw new Error(error.message);
  return (data as TechnicalAdoption[]) ?? [];
}

export async function recognizeSource(sha: string): Promise<SourceRecognition> {
  const { data, error } = await importRpc("import_source_recognition", { _source_sha256: sha });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Partial<SourceRecognition>;
  return { adoptions: d.adoptions ?? [], batches: d.batches ?? [] };
}

/** Lotes lógicos = mesmo hash de fonte; várias operações (carga + correção/conversão) pertencem ao mesmo lote. */
export function groupByLogicalBatch(rows: readonly TechnicalAdoption[]): Array<{ key: string; sha: string; sourceName: string; operations: TechnicalAdoption[] }> {
  const m = new Map<string, { key: string; sha: string; sourceName: string; operations: TechnicalAdoption[] }>();
  for (const r of rows) {
    const g = m.get(r.logical_batch_key) ?? { key: r.logical_batch_key, sha: r.source_sha256, sourceName: r.source_name, operations: [] };
    g.operations.push(r); m.set(r.logical_batch_key, g);
  }
  return [...m.values()];
}

/** Números informados pela operação técnica (contagens, correspondências, conflitos); só valores numéricos. */
export function reportedNumbers(result: Record<string, unknown>): Array<[string, number]> {
  return Object.entries(result).filter((e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1]));
}

export type DryRunDiff = Readonly<{ adoptedRows: number | null; previewRows: number; difference: number | null; verdict: "igual" | "diferente" | "sem-contagem-comparavel" }>;

/** Compara a prévia de um arquivo reconhecido com a contagem de linhas registrada na adoção; ausência nunca vira zero. */
export function compareDryRun(adoptionResult: Record<string, unknown>, previewRows: number): DryRunDiff {
  const v = adoptionResult["row_count"];
  if (typeof v !== "number") return { adoptedRows: null, previewRows, difference: null, verdict: "sem-contagem-comparavel" };
  return { adoptedRows: v, previewRows, difference: previewRows - v, verdict: previewRows === v ? "igual" : "diferente" };
}
