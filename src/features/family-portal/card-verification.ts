/**
 * N9.2-2 — projeção pública mínima da verificação da carteirinha (allowlist de campos).
 * Status vem da cadeia de emissões: a última versão manda; cancelada/substituída nunca aparece como válida.
 */
export type CardIssuance = Readonly<{
  publicId: string; version: number; kind: "emissao" | "reemissao" | "cancelamento"; academicYear: string;
  validUntil: string; studentName: string; schoolName: string; classLabel: string | null; reason: string | null;
  [private_: string]: unknown;
}>;
export type PublicCardStatus = "valida" | "expirada" | "cancelada" | "substituida" | "indisponivel";
export type PublicCardView = Readonly<{ status: PublicCardStatus; publicId?: string; studentName?: string; schoolName?: string; classLabel?: string | null; academicYear?: string }>;

export function verifyCard(chain: readonly CardIssuance[], requestedPublicId: string, version: number, today: string): PublicCardView {
  const mine = chain.filter((c) => c.publicId === requestedPublicId).sort((a, b) => a.version - b.version);
  const head = mine.at(-1); const asked = mine.find((c) => c.version === version);
  if (!head || !asked || asked.kind === "cancelamento") return { status: "indisponivel" };
  const base = { publicId: asked.publicId, studentName: asked.studentName, schoolName: asked.schoolName, classLabel: asked.classLabel, academicYear: asked.academicYear };
  if (head.kind === "cancelamento") return { status: "cancelada", ...base };
  if (head.version !== asked.version) return { status: "substituida", ...base };
  if (asked.validUntil < today) return { status: "expirada", ...base };
  return { status: "valida", ...base };
}
