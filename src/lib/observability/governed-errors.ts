// AV — erros governados: categoria por domínio, mensagem útil e código de correlação.
// A mensagem ao usuário nunca contém detalhe interno (SQL, stack, identificadores, PII).
import { classifyError, redactText } from "./telemetry";

export type GovernedCategory = "validacao" | "autorizacao" | "conflito" | "dependencia-normativa" | "fonte-ausente" | "falha-tecnica";

const USER_MESSAGE: Record<GovernedCategory, string> = {
  validacao: "Algum dado informado não foi aceito. Revise os campos e tente de novo.",
  autorizacao: "Sua conta não tem permissão para esta ação, ou o registro não está disponível para você.",
  conflito: "O registro mudou desde que você abriu a tela. Recarregue e confira antes de repetir.",
  "dependencia-normativa": "Falta uma regra institucional homologada para concluir esta ação.",
  "fonte-ausente": "A fonte de dados necessária ainda não está disponível.",
  "falha-tecnica": "Ocorreu uma falha técnica. Tente de novo; se persistir, informe o código ao suporte.",
};

/** Código de correlação: aleatório, curto, sem nenhuma informação do usuário ou do registro. */
export function newCorrelationId(): string {
  return `op-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function categorize(error: unknown): GovernedCategory {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  if (/base-superseded|stale|conflito|conflict|concurrent|already-exists|duplicad/.test(msg)) return "conflito";
  if (/regra-institucional-pendente|norm|policy-not-homologated|nao-homologad|not-homologated|rule-pending/.test(msg)) return "dependencia-normativa";
  if (/source-missing|fonte|blocked_by_source|layout-missing|missing-source/.test(msg)) return "fonte-ausente";
  const cls = classifyError(error);
  if (cls === "expected.auth" || cls === "expected.forbidden" || /not-authorized|access-denied|capability-required/.test(msg)) return "autorizacao";
  if (cls === "expected.validation") return "validacao";
  return "falha-tecnica";
}

export type GovernedError = Readonly<{ category: GovernedCategory; userMessage: string; correlationId: string; technical: string }>;

/** `technical` é só para log (já sanitizado); a UI mostra `userMessage` + `correlationId`. */
export function governError(error: unknown, correlationId = newCorrelationId()): GovernedError {
  const category = categorize(error);
  return { category, userMessage: USER_MESSAGE[category], correlationId, technical: redactText(error, 200) };
}
