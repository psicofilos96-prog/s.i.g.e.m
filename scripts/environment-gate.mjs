// Gate fail-closed de ambiente: scripts técnicos/importadores/migrations operacionais só mutam
// o banco canônico do SIGEM. Nunca imprime URL, senha ou token — só o ref resolvido.
// Não concede nada: RLS e capabilities continuam valendo no destino.
import { readFileSync, existsSync } from "node:fs";

export const CANONICAL_PROJECT_REF = "crfqhyqkujhhlbiyhdbc";
export const NON_CANONICAL_REFS = Object.freeze(["vwhvqtdvzbnfffkgoaen"]);

const REF = /^[a-z0-9]{20}$/;

/** Extrai o project ref de uma URL HTTP (<ref>.supabase.co) ou connection string Postgres
 *  (host db.<ref>.supabase.co ou usuário postgres.<ref> do pooler). null se não resolvível. */
export function resolveProjectRef(target) {
  if (!target || typeof target !== "string") return null;
  const t = target.trim();
  if (REF.test(t)) return t;
  let u;
  try { u = new URL(t); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const user = decodeURIComponent(u.username || "").toLowerCase();
  const fromUser = /^postgres\.([a-z0-9]{20})$/.exec(user)?.[1] ?? null;
  const fromHost = /^(?:db\.)?([a-z0-9]{20})\.supabase\.(?:co|in)$/.exec(host)?.[1] ?? null;
  if (fromUser && fromHost && fromUser !== fromHost) return "ambiguous";
  return fromUser ?? fromHost;
}

/** Recusa (lança) se o destino não for comprovadamente o canônico. Nome "postgres" não prova nada. */
export function assertCanonicalTarget(target, { mutation = true } = {}) {
  const ref = resolveProjectRef(target);
  if (ref === null) {
    if (mutation) throw new Error("environment-gate: destino sem project ref resolvível; mutação recusada");
    return { ref: null, canonical: false };
  }
  if (ref === "ambiguous") throw new Error("environment-gate: destino com refs divergentes; recusado");
  if (ref !== CANONICAL_PROJECT_REF) {
    const tag = NON_CANONICAL_REFS.includes(ref) ? " (não canônico / não usar)" : "";
    throw new Error(`environment-gate: destino ${ref}${tag} ≠ canônico ${CANONICAL_PROJECT_REF}; recusado`);
  }
  return { ref, canonical: true };
}

/** Confere que a configuração versionada aponta para o canônico. */
export function assertRepoConfig(root = ".") {
  const p = `${root}/supabase/config.toml`;
  if (!existsSync(p)) throw new Error("environment-gate: supabase/config.toml ausente");
  const id = /project_id\s*=\s*"([^"]+)"/.exec(readFileSync(p, "utf8"))?.[1];
  if (id !== CANONICAL_PROJECT_REF) throw new Error(`environment-gate: config.toml aponta para ${id ?? "nada"}`);
  return id;
}

/** Resolve o destino a partir do ambiente de execução (migration URL, DB URL, SUPABASE_URL). */
export function assertCanonicalEnvironment(env = process.env) {
  const target = env.LOVABLE_DB_MIGRATION_URL || env.SUPABASE_DB_URL || env.SUPABASE_URL || env.SUPABASE_PROJECT_ID;
  return assertCanonicalTarget(target);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    assertRepoConfig();
    const { ref } = assertCanonicalEnvironment();
    console.log(`environment-gate: ok (${ref})`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
