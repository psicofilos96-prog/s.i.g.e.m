// L21 — Busca Ativa Escolar nacional (UNICEF/Undime). Investigação (2026-10-12):
// a plataforma (plataforma.buscaativaescolar.org.br) é ferramenta própria com
// adesão feita pelo(a) prefeito(a) na plataforma e equipe intersetorial com
// Coordenador Operacional e Gestor Político; NÃO há API pública documentada
// encontrada. Logo: nenhuma API é presumida e o processo oficial não é duplicado.
// Sem integração, só existe CONCILIAÇÃO MANUAL: uma pessoa autorizada consulta a
// plataforma oficial e registra, no caso do SIGEM, a referência opaca e o que
// observou, com data e evidência — nunca importa dado pessoal da plataforma.

export const BAE_INVESTIGATION = {
  date: "2026-10-12",
  sources: ["https://buscaativaescolar.org.br/", "https://selounicef.org.br/busca-ativa-escolar"],
  publicApiFound: false,
  adhesionPath: "Adesão na plataforma pelo(a) prefeito(a); cadastro de Coordenador(a) Operacional e Gestor(a) Político(a).",
  municipalAdhesion: "nao-verificada" as const, // nenhuma evidência no projeto
} as const;

export interface BaeAdhesion { evidenceRef: string | null; evidenceSha256: string | null; verifiedBy: string | null; verifiedOn: string | null }
export interface BaeIntegration { mode: "nenhuma" | "conciliacao-manual" | "api-autorizada"; contractRef: string | null; decisionRef: string | null; documentedEndpoint: string | null }

export type BaeStatus = "nao-consultado" | "adesao-nao-comprovada" | "conciliacao-manual" | "integracao-autorizada";

export function baeStatus(a: BaeAdhesion | null, i: BaeIntegration | null): BaeStatus {
  if (!a || !a.evidenceRef || !a.evidenceSha256 || !/^[0-9a-f]{64}$/.test(a.evidenceSha256) || !a.verifiedBy) return a ? "adesao-nao-comprovada" : "nao-consultado";
  if (i?.mode === "api-autorizada" && i.contractRef && i.decisionRef && i.documentedEndpoint) return "integracao-autorizada";
  if (i?.mode === "conciliacao-manual" && i.decisionRef) return "conciliacao-manual";
  return "nao-consultado";
}

/** Registro de conciliação: referência opaca + situação observada como texto da plataforma; sem nome/CPF/endereço. */
export interface BaeReconciliation { caseId: string; externalRef: string; observedStatus: string; observedOn: string; evidenceSha256: string; person: string | null; key: string }
const PII = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|rua |avenida|endere[cç]o|nome:|cpf|nis\b)/i;

export function reconciliationIssues(status: BaeStatus, r: BaeReconciliation, today: string): string[] {
  const out: string[] = [];
  if (status !== "conciliacao-manual" && status !== "integracao-autorizada") out.push("sem-adesao-ou-decisao");
  if (!r.person) out.push("sem-pessoa");
  if (!/^[A-Za-z0-9-_.]{3,64}$/.test(r.externalRef)) out.push("referencia-invalida");
  if (PII.test(r.observedStatus) || PII.test(r.externalRef)) out.push("dado-pessoal");
  if (r.observedOn > today) out.push("data-futura");
  if (!/^[0-9a-f]{64}$/.test(r.evidenceSha256)) out.push("sem-evidencia");
  if (!r.key.trim()) out.push("sem-chave");
  return out;
}

/** Divergência é listada para conferência humana; nunca altera o caso do SIGEM nem a plataforma. */
export function divergences(sigemCases: readonly { caseId: string; closed: boolean }[], recs: readonly BaeReconciliation[], closedLabels: ReadonlySet<string>) {
  const last = new Map<string, BaeReconciliation>();
  for (const r of recs) if ((last.get(r.caseId)?.observedOn ?? "") <= r.observedOn) last.set(r.caseId, r);
  return sigemCases.flatMap((c): { caseId: string; kind: "nao-conciliado" | "situacao-divergente" }[] => {
    const r = last.get(c.caseId);
    if (!r) return [{ caseId: c.caseId, kind: "nao-conciliado" as const }];
    const extClosed = closedLabels.has(r.observedStatus);
    return extClosed !== c.closed ? [{ caseId: c.caseId, kind: "situacao-divergente" as const }] : [];
  });
}
