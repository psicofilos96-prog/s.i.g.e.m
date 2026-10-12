/**
 * SIGEM Documentos — L24: matriz de fechamento. Cada lote declara evidência em disco
 * (código, teste, migration) e bloqueios; seções/critérios do L01 são reavaliados
 * pelo lote que os cobre. Nenhum status "homologado": homologação institucional exige ato real.
 */
import { DOC_CRITERIA, DOC_SECTIONS, type DocAuditRow } from "./documents-audit";

export const DOCS_CLOSURE_BASE_SHA = "10c7137f2fb0de9ba41406deb4de32b008a9d451";
export type DocClosureStatus = "persistido-com-tela" | "persistido" | "nucleo-testado" | "bloqueado";
export interface DocLot { lot: number; title: string; status: DocClosureStatus; evidence: string[]; keywords: string[]; blocker: string | null }

const F = "src/features/document-management";
const M = "drizzle/migrations";
const DECISION = "Depende de decisão institucional: atribuir capacidades na política homologada.";

export const DOC_LOTS: readonly DocLot[] = [
  { lot: 1, title: "Auditoria", status: "nucleo-testado", evidence: [`${F}/documents-audit.ts`, `${F}/documents-audit.test.ts`], keywords: ["auditoria"], blocker: null },
  { lot: 2, title: "Núcleo documental", status: "nucleo-testado", evidence: [`${F}/document-core.ts`, `${F}/document-core.test.ts`], keywords: ["tipo", "metadad", "vers"], blocker: "Tipos documentais oficiais e metadados por tipo não decididos." },
  { lot: 3, title: "Editor institucional", status: "persistido-com-tela", evidence: ["src/features/document-studio/editor-model.ts", "src/features/document-studio/editor-model.test.ts"], keywords: ["editor", "redação"], blocker: null },
  { lot: 4, title: "Biblioteca de modelos e logos", status: "persistido-com-tela", evidence: ["src/features/document-studio/studio-logos.ts", "src/features/document-studio/studio-library.test.ts"], keywords: ["modelo", "logo", "brasão"], blocker: "Modelos são rascunho não homologado." },
  { lot: 5, title: "Numeração", status: "persistido", evidence: [`${F}/document-numbering.ts`, `${F}/document-numbering.test.ts`, `${M}/0385_doc05_institutional_numbering.sql`], keywords: ["numera"], blocker: "Nenhuma regra de numeração aprovada." },
  { lot: 6, title: "Protocolo único", status: "persistido", evidence: [`${F}/protocol-registry.ts`, `${F}/protocol-registry.test.ts`, `${M}/0386_doc06_single_protocol.sql`], keywords: ["protocol"], blocker: DECISION },
  { lot: 7, title: "Processos administrativos", status: "persistido", evidence: [`${F}/admin-case.ts`, `${F}/admin-case.test.ts`, `${M}/0387_doc07_administrative_cases.sql`], keywords: ["processo", "autua", "instru"], blocker: DECISION },
  { lot: 8, title: "Tramitação", status: "persistido", evidence: [`${F}/case-dispatch.ts`, `${F}/case-dispatch.test.ts`, `${M}/0388_doc08_case_dispatches.sql`], keywords: ["tramita", "encaminh", "anexo"], blocker: DECISION },
  { lot: 9, title: "Caixa de entrada", status: "persistido-com-tela", evidence: [`${F}/unit-inbox.ts`, `${F}/unit-inbox.test.ts`, `${M}/0390_doc09_unit_inbox.sql`, `${F}/documents-hub-page.tsx`], keywords: ["caixa", "ciência", "tarefa"], blocker: DECISION },
  { lot: 10, title: "Despachos, pareceres e decisões", status: "persistido", evidence: [`${F}/case-acts.ts`, `${F}/case-acts.test.ts`, `${M}/0391_doc10_case_acts.sql`], keywords: ["despacho", "parecer", "decis"], blocker: DECISION },
  { lot: 11, title: "Revisão e aprovação", status: "persistido", evidence: [`${F}/document-lifecycle.ts`, `${F}/document-lifecycle.test.ts`, `${M}/0392_doc11_18_review_signature_archive.sql`], keywords: ["revis", "aprova"], blocker: DECISION },
  { lot: 12, title: "Assinatura eletrônica", status: "persistido", evidence: [`${F}/document-lifecycle.ts`, `${M}/0392_doc11_18_review_signature_archive.sql`], keywords: ["assinatura"], blocker: "Só assinatura simples; qualificada exige provedor ICP-Brasil contratado." },
  { lot: 13, title: "Verificação pública", status: "persistido-com-tela", evidence: ["src/routes/verificar.ato.$codigo.tsx", `${M}/0392_doc11_18_review_signature_archive.sql`], keywords: ["autentic", "verifica"], blocker: null },
  { lot: 14, title: "Tarefas e prazos", status: "persistido", evidence: [`${F}/document-lifecycle.ts`, `${M}/0392_doc11_18_review_signature_archive.sql`], keywords: ["prazo"], blocker: "Nenhuma regra de prazo aprovada." },
  { lot: 15, title: "Solicitações compartilhadas", status: "nucleo-testado", evidence: [`${F}/document-integration.ts`, `${F}/document-integration.test.ts`], keywords: ["solicita"], blocker: null },
  { lot: 16, title: "Pesquisa documental", status: "persistido", evidence: [`${F}/document-integration.ts`, `${M}/0392_doc11_18_review_signature_archive.sql`], keywords: ["pesquisa", "busca"], blocker: null },
  { lot: 17, title: "Classificação, temporalidade e arquivo", status: "persistido", evidence: [`${F}/document-lifecycle.ts`, `${M}/0392_doc11_18_review_signature_archive.sql`], keywords: ["classifica", "temporalidade", "arquiv", "elimina"], blocker: "Plano de classificação e tabela de temporalidade aprovados ausentes." },
  { lot: 18, title: "Digitalização", status: "persistido", evidence: [`${F}/document-lifecycle.ts`, `${M}/0392_doc11_18_review_signature_archive.sql`], keywords: ["digitaliz"], blocker: null },
  { lot: 19, title: "Acesso granular", status: "persistido", evidence: [`${F}/document-lifecycle.ts`, `${M}/0393_doc19_sensitive_grant_and_origin_links.sql`], keywords: ["acesso", "permiss"], blocker: DECISION },
  { lot: 20, title: "LGPD e proteção de arquivos", status: "persistido", evidence: [`${F}/document-integration.ts`, `${M}/0389_doc08_safe_view_access.sql`], keywords: ["lgpd", "sigilo", "sensív", "privacidade"], blocker: "Base legal e retenção por tipo não decididas." },
  { lot: 21, title: "Integração Secretaria", status: "persistido", evidence: [`${F}/document-integration.ts`, `${M}/0393_doc19_sensitive_grant_and_origin_links.sql`], keywords: ["secretaria"], blocker: null },
  { lot: 22, title: "Pessoas, Direção, Supervisão, Orientação", status: "persistido", evidence: [`${F}/document-integration.ts`, `${M}/0393_doc19_sensitive_grant_and_origin_links.sql`], keywords: ["pessoas", "direção", "supervis", "orienta"], blocker: null },
  { lot: 23, title: "Família e sistemas externos", status: "bloqueado", evidence: [`${F}/document-integration.ts`], keywords: ["família", "externo", "municipal"], blocker: "Nenhum sistema oficial externo identificado; integração exige contrato e decisão." },
  { lot: 24, title: "Painel, relatórios e fechamento", status: "persistido-com-tela", evidence: [`${F}/documents-closure.ts`, `${F}/documents-reports.ts`, `${F}/documents-hub-page.tsx`, "src/routes/sigem-documentos.tsx", "supabase/tests/doc24_documents_rls.sql"], keywords: ["relatório", "painel", "dashboard"], blocker: "E2E autenticado no navegador não executado." },
];

export interface DocClosureRow { n: number; title: string; before: DocAuditRow["status"]; status: DocClosureStatus; lots: number[]; blocker: string | null }

export function closeRows(rows: readonly DocAuditRow[]): DocClosureRow[] {
  return rows.map((row) => {
    const t = row.title.toLowerCase();
    const lots = DOC_LOTS.filter((l) => l.keywords.some((k) => t.includes(k)));
    const best = lots.find((l) => l.status === "persistido-com-tela") ?? lots.find((l) => l.status === "persistido") ?? lots.find((l) => l.status === "nucleo-testado");
    const blocked = row.status === "bloqueado" || !best;
    return {
      n: row.n, title: row.title, before: row.status, lots: lots.map((l) => l.lot),
      status: blocked ? "bloqueado" : best.status,
      blocker: blocked ? (row.gap || "Sem lote que cubra esta seção.") : (lots.find((l) => l.blocker)?.blocker ?? null),
    };
  });
}
export const DOCS_CLOSURE_SECTIONS = closeRows(DOC_SECTIONS);
export const DOCS_CLOSURE_CRITERIA = closeRows(DOC_CRITERIA);
export const docClosureSummary = (rows: readonly { status: DocClosureStatus }[]) =>
  rows.reduce<Record<DocClosureStatus, number>>((a, r) => ({ ...a, [r.status]: a[r.status] + 1 }), { "persistido-com-tela": 0, persistido: 0, "nucleo-testado": 0, bloqueado: 0 });

export function docClosureProblems(exists: (p: string) => boolean): string[] {
  const p: string[] = [];
  for (const l of DOC_LOTS) for (const e of l.evidence) if (!exists(e)) p.push(`L${l.lot}: evidência ausente ${e}`);
  if (DOC_LOTS.length !== 24) p.push("Esperados 24 lotes.");
  if (DOCS_CLOSURE_SECTIONS.length !== 41 || DOCS_CLOSURE_CRITERIA.length !== 20) p.push("Esperadas 41 seções e 20 critérios.");
  return p;
}
