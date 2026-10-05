// Registry de integrações institucionais: slots plausíveis, adaptadores e validações puras.
// Nenhum provedor real vem conectado; sem adaptador registrado tudo falha fechado.

export type SlotKey = "email" | "push" | "armazenamento" | "identidade" | "importador-censo" | "sistema-educacional";

export type Slot = {
  key: SlotKey;
  label: string;
  capabilities: string[];
  /** Campos de destino que um mapeamento pode alimentar (só para dry-run; nunca grava domínio). */
  mappingTargets: string[];
};

export const SLOTS: Record<SlotKey, Slot> = {
  email: { key: "email", label: "E-mail transacional", capabilities: ["enviar-resumo-externo"], mappingTargets: [] },
  push: { key: "push", label: "Notificação push", capabilities: ["enviar-resumo-externo"], mappingTargets: [] },
  armazenamento: { key: "armazenamento", label: "Armazenamento de arquivos", capabilities: ["guardar-anexo", "ler-anexo"], mappingTargets: [] },
  identidade: { key: "identidade", label: "Provedor de identidade", capabilities: ["autenticar-conta"], mappingTargets: ["identificador_login", "nome_exibicao"] },
  "importador-censo": { key: "importador-censo", label: "Importador do Censo Escolar", capabilities: ["preparar-lote-de-importacao"], mappingTargets: ["codigo_inep", "nome_estudante", "data_nascimento", "codigo_turma"] },
  "sistema-educacional": { key: "sistema-educacional", label: "Outro sistema educacional", capabilities: ["preparar-lote-de-importacao", "receber-webhook"], mappingTargets: ["codigo_escola", "codigo_turma", "codigo_componente"] },
};

/** Adaptador = código que fala com um provedor. Sem adaptador registrado, nada executa. */
export type Adapter = {
  slot: SlotKey;
  provider: string;
  health: (ctx: { config: Record<string, unknown>; secret: string }) => Promise<{ ok: boolean; code: string; retryable?: boolean }>;
};
export const ADAPTERS: Adapter[] = [];

export function findAdapter(slot: string, provider: string, adapters: Adapter[] = ADAPTERS) {
  return adapters.find((a) => a.slot === slot && a.provider === provider) ?? null;
}

const SECRET_KEY = /(secret|senha|password|token|api[_-]?key|private)/i;
const SECRET_VALUE = /^(sk_|sgk_|whsec_|sb_secret_|eyJ[A-Za-z0-9_-]{10,}\.|-----BEGIN)/;
export const SECRET_REF = /^[A-Z][A-Z0-9_]{2,63}$/;

export type MappingRule = { from: string; to: string };

export function validateConfig(config: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const walk = (o: unknown, path: string) => {
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const [k, v] of Object.entries(o)) {
        if (SECRET_KEY.test(k)) issues.push(`config.${path}${k}: campo com nome de segredo; use referência a segredo`);
        walk(v, `${path}${k}.`);
      }
    } else if (typeof o === "string" && SECRET_VALUE.test(o)) issues.push(`config.${path.slice(0, -1)}: valor parece credencial`);
  };
  walk(config, "");
  return issues;
}

export function validateSecretRef(ref: string | null): string[] {
  if (ref === null || ref === "") return [];
  return SECRET_REF.test(ref) ? [] : ["secret_ref: deve ser o NOME de uma variável (ex.: PROVEDOR_API_KEY), nunca o valor"];
}

export function validateMapping(slot: SlotKey, mapping: MappingRule[]): string[] {
  const issues: string[] = [];
  const targets = new Set(SLOTS[slot].mappingTargets);
  const seen = new Set<string>();
  mapping.forEach((m, i) => {
    if (!m.from?.trim()) issues.push(`mapping[${i}]: origem vazia`);
    if (!targets.has(m.to)) issues.push(`mapping[${i}]: destino "${m.to}" não existe neste tipo`);
    if (seen.has(m.to)) issues.push(`mapping[${i}]: destino "${m.to}" repetido`);
    seen.add(m.to);
  });
  return issues;
}

/** Dry-run: aplica o mapeamento a uma linha de exemplo. Nunca chama writer; ausência continua ausência. */
export function dryRunMapping(mapping: MappingRule[], sample: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const m of mapping) {
    if (m.from in sample && sample[m.from] !== "" && sample[m.from] !== null) out[m.to] = sample[m.from];
    else { out[m.to] = null; missing.push(m.from); }
  }
  return { preview: out, missing, writes: 0 as const };
}

export type IntegrationVersion = {
  key: string; version: number; slot: SlotKey; provider: string; state: "inativa" | "ativa";
  config: Record<string, unknown>; secret_ref: string | null; mapping: MappingRule[]; reason: string; recorded_at: string;
};

export function heads(versions: IntegrationVersion[]) {
  const m = new Map<string, IntegrationVersion>();
  for (const v of versions) if (!m.has(v.key) || m.get(v.key)!.version < v.version) m.set(v.key, v);
  return [...m.values()];
}

export type HealthResult = { outcome: "ok" | "falha" | "recusado"; code: string; attempts: number };

/** Health check fechado: inativa, sem adaptador, sem segredo ou falha ⇒ nunca "ok". Retentativa limitada. */
export async function runHealth(
  v: IntegrationVersion,
  env: (name: string) => string | undefined,
  adapters: Adapter[] = ADAPTERS,
  maxAttempts = 3,
): Promise<HealthResult> {
  if (v.state !== "ativa") return { outcome: "recusado", code: "integracao-inativa", attempts: 0 };
  const issues = [...validateConfig(v.config), ...validateSecretRef(v.secret_ref), ...validateMapping(v.slot, v.mapping)];
  if (issues.length) return { outcome: "recusado", code: "configuracao-invalida", attempts: 0 };
  const adapter = findAdapter(v.slot, v.provider, adapters);
  if (!adapter) return { outcome: "recusado", code: "sem-adaptador", attempts: 0 };
  const secret = v.secret_ref ? env(v.secret_ref) : undefined;
  if (v.secret_ref && !secret) return { outcome: "recusado", code: "segredo-ausente", attempts: 0 };
  let last = "provedor-indisponivel";
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const r = await adapter.health({ config: v.config, secret: secret ?? "" });
      if (r.ok) return { outcome: "ok", code: r.code, attempts: i };
      last = r.code;
      if (!r.retryable) return { outcome: "falha", code: r.code, attempts: i };
    } catch {
      last = "provedor-indisponivel";
    }
  }
  return { outcome: "falha", code: last, attempts: maxAttempts };
}
