// L16 — Integração com a Orientação Pedagógica (OP). A Permanência NÃO grava
// registro pedagógico: acolhimento, adaptação, recuperação e reintegração vivem
// nos writers canônicos da OP (`record_school_pedagogical_record_v2` e plano de
// intervenção `aa_intervention_*`). Aqui só se monta a SOLICITAÇÃO à OP e se
// vincula por referência ao registro que a OP criou.

export const GUIDANCE_KINDS = ["acolhimento", "adaptacao", "recuperacao", "reintegracao"] as const;
export type GuidanceKind = (typeof GUIDANCE_KINDS)[number];

/** Escritor canônico de cada tipo (nunca da Permanência). */
export const CANONICAL_WRITER: Record<GuidanceKind, "record_school_pedagogical_record_v2" | "aa_record_intervention"> = {
  acolhimento: "record_school_pedagogical_record_v2",
  adaptacao: "aa_record_intervention",
  recuperacao: "aa_record_intervention",
  reintegracao: "record_school_pedagogical_record_v2",
};

export interface GuidanceRequest {
  caseId: string; schoolId: string; studentId: string; kind: GuidanceKind;
  purpose: string; requestedBy: string | null; key: string;
}
export interface OpRecordRef { kind: GuidanceKind; ref: string; schoolId: string; studentId: string; authorPerson: string }

// Conteúdo íntimo do caso (família, barreira reforçada, clínica) não segue para a OP.
const SENSITIVE = /(laudo|cid\b|diagn[oó]stic|viol[eê]ncia|abuso|renda|benef[ií]cio|endere[cç]o|cpf|neglig)/i;

export function requestIssues(r: GuidanceRequest, caps: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (!r.requestedBy) out.push("sem-pessoa");
  if (!caps.has("solicitar-orientacao-pedagogica")) out.push("sem-capacidade");
  if (!GUIDANCE_KINDS.includes(r.kind)) out.push("tipo-desconhecido");
  if (r.purpose.trim().length < 10) out.push("sem-finalidade");
  if (SENSITIVE.test(r.purpose)) out.push("conteudo-sensivel");
  if (!r.key.trim()) out.push("sem-chave");
  return out;
}
export const requestKey = (caseId: string, kind: GuidanceKind, purposeRef: string) => `perm-op|${caseId}|${kind}|${purposeRef}`;

/** Vínculo caso ↔ registro da OP: só referência, mesma escola e estudante, autor ≠ executor técnico. */
export function linkIssues(req: GuidanceRequest, rec: OpRecordRef, technicalExecutors: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (rec.kind !== req.kind) out.push("tipo-divergente");
  if (rec.schoolId !== req.schoolId || rec.studentId !== req.studentId) out.push("outro-estudante-ou-escola");
  if (technicalExecutors.has(rec.authorPerson)) out.push("autor-tecnico");
  return out;
}

/** O que a Permanência pode fazer: pedir e referenciar. Nunca escreve no domínio da OP. */
export const BRIDGE_WRITES: readonly string[] = [];
export type BridgeState = "nao-solicitado" | "solicitado" | "atendido-pela-op";
export function bridgeState(requests: readonly GuidanceRequest[], links: readonly OpRecordRef[], kind: GuidanceKind): BridgeState {
  if (links.some((l) => l.kind === kind)) return "atendido-pela-op";
  return requests.some((r) => r.kind === kind) ? "solicitado" : "nao-solicitado";
}
