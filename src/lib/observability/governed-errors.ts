// AV/BK — erros governados: categoria por domínio, mensagem útil e código de correlação.
// A mensagem ao usuário nunca contém detalhe interno (SQL, stack, identificadores, PII).
// O código canônico (`code`) fica disponível só para telemetria/auditoria.
import { classifyError, redactText } from "./telemetry";
import { blockByCode } from "@/features/help/block-codes";

export type GovernedCategory =
  | "sessao-expirada" | "sem-conexao" | "validacao" | "autorizacao" | "conflito" | "registro-fechado"
  | "dependencia-normativa" | "fonte-ausente" | "indisponivel" | "falha-tecnica";

const USER_MESSAGE: Record<GovernedCategory, string> = {
  "sessao-expirada": "Sua sessão terminou. Entre de novo para continuar; nada foi gravado nesta tentativa.",
  "sem-conexao": "Sem conexão com o servidor. Verifique a internet e tente de novo; nada foi gravado nesta tentativa.",
  validacao: "Algum dado informado não foi aceito. Revise os campos e tente de novo.",
  autorizacao: "Sua conta não tem permissão para esta ação, ou o registro não está disponível para você.",
  conflito: "O registro mudou desde que você abriu a tela. Recarregue e confira antes de repetir.",
  "registro-fechado": "Este período, versão ou registro já foi fechado e não aceita mais alterações.",
  "dependencia-normativa": "Falta uma regra institucional homologada para concluir esta ação.",
  "fonte-ausente": "A fonte de dados necessária ainda não está disponível.",
  indisponivel: "Este recurso está indisponível no momento. Tente de novo mais tarde.",
  "falha-tecnica": "Ocorreu uma falha técnica. Tente de novo; se persistir, informe o código ao suporte.",
};

/** Código de correlação: aleatório, curto, sem nenhuma informação do usuário ou do registro. */
export function newCorrelationId(): string {
  return `op-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

// Ordem importa: autorização/IDOR antes de regra (ex.: school-capability-required).
const RULES: ReadonlyArray<[RegExp, GovernedCategory]> = [
  // NOBS.1: sessão expirada e rede vêm antes de autorização — a próxima ação é outra (entrar de novo / reconectar).
  [/jwt expired|token.*expired|session.*expired|refresh_token_not_found|invalid refresh token/, "sessao-expirada"],
  [/failed to fetch|networkerror|network request failed|load failed|err_internet_disconnected|offline/, "sem-conexao"],
  [/unauthenticated|no-session|session-required|not-authorized|access-denied|capability|natural-person-required|not-author\b|not-in-school|other-school|outside-school|cross-school|engagement-outside-school|not-posted-in-school|student-not-enrolled-in-school|family:not-authorized|permission denied/, "autorizacao"],
  [/base-superseded|base-unknown|base-not-allowed|stale|conflito|conflict|concurrent|already-exists|duplicad|same-source-different-value/, "conflito"],
  [/period-closed|cycle-closed|version-closed|already-closed|window-closed|staging-closed|order-closed|nonconformity-closed|after-version-closed|enrollment-ended|competence-not-ended|already-revoked|already-annulled|append-only/, "registro-fechado"],
  [/regra-institucional-pendente|not-homologated|nao-homologad|rule-pending|rule-required|rule-not-defined|no-homologated-rule|homologation-rule-missing|without-rules|without-homologated-rule|ambiguous-rules|policy-pending|blocked-composition|blocked-applicability|_policy_pending|_rule_pending|institutional_rule|blocked-/, "dependencia-normativa"],
  [/source-missing|blocked_by_source|by_official_source|layout-missing|missing-source|official_source_pending|source_pending|content_source|catalog-pending|catalog_pending|_pending/, "fonte-ausente"],
  [/unavailable|indisponivel|year-unavailable|instance-unavailable/, "indisponivel"],
];

/** Extrai o código canônico (`dominio:codigo` → `codigo`; código BK em MAIÚSCULAS preservado). */
export function canonicalCode(error: unknown): string | null {
  const raw = String((error as { message?: string })?.message ?? error ?? "");
  const bk = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+){2,}\b/.exec(raw);
  if (bk) return bk[0];
  const m = /\b([a-z][a-z0-9-]*):([a-z0-9][a-z0-9_-]*)/.exec(raw);
  if (m) return `${m[1]}:${m[2]}`;
  const bare = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)+)$/.exec(raw.trim());
  return bare?.[1] ?? null;
}

export function categorize(error: unknown): GovernedCategory {
  const raw = String((error as { message?: string })?.message ?? error ?? "");
  const bk = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+){2,}\b/.exec(raw)?.[0];
  if (bk) {
    const b = blockByCode(bk);
    if (b?.kind === "fonte-externa") return "fonte-ausente";
    if (b?.kind === "plataforma") return "indisponivel";
    if (b) return "dependencia-normativa";
  }
  const msg = raw.toLowerCase();
  for (const [re, cat] of RULES) if (re.test(msg)) return cat;
  const cls = classifyError(error);
  if (cls === "expected.auth" || cls === "expected.forbidden") return "autorizacao";
  if (cls === "incident.dependency") return "indisponivel";
  if (cls === "expected.validation") return "validacao";
  return "falha-tecnica";
}

export type GovernedError = Readonly<{ category: GovernedCategory; userMessage: string; correlationId: string; code: string | null; technical: string }>;

/** `technical`/`code` são só para log/auditoria; a UI mostra `userMessage` + `correlationId`. */
export function governError(error: unknown, correlationId = newCorrelationId()): GovernedError {
  const category = categorize(error);
  const code = canonicalCode(error);
  const b = code && /^[A-Z]/.test(code) ? blockByCode(code) : null;
  const userMessage = b ? `${b.unavailable} indisponível: ${b.why}. Falta: ${b.missing}.` : USER_MESSAGE[category];
  return { category, userMessage, correlationId, code, technical: redactText(error, 200) };
}

/** Texto pronto para a tela: mensagem pt-BR + código de correlação; nunca a mensagem crua. */
export function userErrorText(error: unknown): string {
  const g = governError(error);
  return `${g.userMessage} Código: ${g.correlationId}.`;
}
