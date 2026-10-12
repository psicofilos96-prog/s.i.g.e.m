// Tecnologia L10 — controle documentado de mudanças e reversão (migrations 0484/0485). Documentos são juntadas do
// SIGEM Documentos vinculadas por tipo; o banco recusa aprovar/executar/reverter/encerrar sem o documento exigido
// (trigger tech_change_doc_gate). Esta projeção espelha os gates para orientar a tela; a garantia é do banco.
import { changeNextAllowed, type ChangeAction } from "./itsm-core";

export type ChangeDocKind = "plano" | "teste" | "evidencia-execucao" | "evidencia-reversao" | "revisao-pos";

export function missingDocs(action: ChangeAction, has: readonly ChangeDocKind[], history: readonly ChangeAction[]): ChangeDocKind[] {
  const need: ChangeDocKind[] =
    action === "aprovar" ? ["plano"]
    : action === "executar" ? ["plano", "teste"]
    : action === "reverter" ? ["evidencia-reversao"]
    : action === "encerrar" ? ["revisao-pos", ...(history.includes("executar") && !history.includes("reverter") ? ["evidencia-execucao" as const] : [])]
    : [];
  return need.filter((k) => !has.includes(k));
}

/** Próximas ações com pendência documental de cada uma. */
export function changeReadiness(history: readonly ChangeAction[], has: readonly ChangeDocKind[]) {
  return changeNextAllowed(history.at(-1) ?? null).map((a) => ({ action: a, missing: missingDocs(a, has, history) }));
}

/** Desfecho projetado: reverter nunca apaga a execução; ambos ficam na trilha. */
export function changeOutcome(history: readonly ChangeAction[]) {
  if (history.includes("rejeitar")) return "rejeitada";
  if (history.includes("reverter")) return history.includes("encerrar") ? "revertida-encerrada" : "revertida";
  if (history.includes("encerrar")) return "implantada-encerrada";
  if (history.includes("executar")) return "executada";
  return history.includes("aprovar") ? "aprovada" : "em-analise";
}
