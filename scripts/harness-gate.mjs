// NTEST.1 — porta fail-closed do harness institucional. Fica fora do bundle do app.
// Não concede nada: só decide SE o harness pode rodar e EM QUAL camada. RLS/capabilities seguem valendo.
// Nunca guarda nem imprime senha/token. Sem magic link, sem impersonação.
import { assertCanonicalTarget } from "./environment-gate.mjs";

export const FIXTURE_DOMAIN = "bo-fixture.invalid"; // .invalid nunca recebe e-mail (RFC 2606)
export const ACK = "fixtures-efemeras-com-cleanup";

/** Camadas, da mais forte para a mais fraca. A diferença é sempre declarada no relatório. */
export const LAYERS = Object.freeze({
  browser: "Navegador headless autenticado (sessão mintada pela plataforma com aprovação humana)",
  "authenticated-layer": "Camada autenticada equivalente: JWT real do usuário sintético contra RLS/capabilities, sem navegador",
  static: "Somente regras puras (navegação por estação, catálogo); NÃO prova RLS nem tela",
});

/** Decide a camada. Lança se qualquer condição de segurança falhar (fail closed). */
export function resolveHarness(env) {
  const reasons = [];
  if (env.NODE_ENV === "production") reasons.push("NODE_ENV=production");
  if (Object.keys(env).some((k) => k.startsWith("VITE_") && /HARNESS|FIXTURE|IMPERSON/i.test(k))) reasons.push("variável VITE_ de harness (iria ao navegador)");
  if (env.SIGEM_TEST_HARNESS !== "1") reasons.push("SIGEM_TEST_HARNESS≠1");
  if (env.SIGEM_HARNESS_ACK !== ACK) reasons.push("SIGEM_HARNESS_ACK ausente");
  if (reasons.length) throw new Error(`harness recusado: ${reasons.join("; ")}`);

  const hasDb = !!(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasDb) return { layer: "static", note: "sem credencial técnica de ambiente: só camada estática" };
  assertCanonicalTarget(env.SUPABASE_URL, { mutation: true });
  const browser = env.LOVABLE_BROWSER_AUTH_STATUS === "injected";
  return { layer: browser ? "browser" : "authenticated-layer", note: browser ? "" : "login interativo indisponível: camada autenticada equivalente" };
}
