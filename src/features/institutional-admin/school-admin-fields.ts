/**
 * Classificação administrativa (0101): três estados por campo.
 * - manter: omitido ⇒ o banco herda da versão anterior;
 * - alterar: valor não vazio (vazio acidental NÃO vira mudança: é recusado na tela);
 * - limpar: intenção explícita ⇒ nome do campo em `_clear_administrative`, grava NULL na nova versão.
 */
export const ADMIN_FIELDS = ["administrative_dependency", "private_school_category", "partnership_public_authority"] as const;
export type AdminField = (typeof ADMIN_FIELDS)[number];
export type AdminFieldState = { mode: "manter" } | { mode: "alterar"; value: string } | { mode: "limpar" };

export const ADMIN_FIELD_LABEL: Record<AdminField, string> = {
  administrative_dependency: "Dependência administrativa",
  private_school_category: "Categoria da escola privada",
  partnership_public_authority: "Poder público do convênio",
};

export type AdminArgs = {
  _administrative_dependency: string | null; _private_school_category: string | null;
  _partnership_public_authority: string | null; _clear_administrative: string[] | null;
};

export function adminFieldArgs(states: Partial<Record<AdminField, AdminFieldState>>): { ok: true; args: AdminArgs } | { ok: false; field: AdminField } {
  const args: AdminArgs = { _administrative_dependency: null, _private_school_category: null, _partnership_public_authority: null, _clear_administrative: null };
  const clear: string[] = [];
  for (const f of ADMIN_FIELDS) {
    const s = states[f] ?? { mode: "manter" };
    if (s.mode === "alterar") {
      const v = s.value.trim();
      if (!v) return { ok: false, field: f };
      args[`_${f}`] = v;
    } else if (s.mode === "limpar") clear.push(f);
  }
  if (clear.length) args._clear_administrative = clear;
  return { ok: true, args };
}

/** Valores resultantes da nova versão (para avisos), sem inventar nada. */
export function resultingAdmin(prev: Record<AdminField, string | null>, states: Partial<Record<AdminField, AdminFieldState>>): Record<AdminField, string | null> {
  const out = { ...prev };
  for (const f of ADMIN_FIELDS) {
    const s = states[f];
    if (s?.mode === "alterar") out[f] = s.value.trim() || prev[f];
    else if (s?.mode === "limpar") out[f] = null;
  }
  return out;
}

/** Avisos de coerência semântica; nunca alteram nem sugerem valores. */
export function adminCoherenceWarnings(v: Record<AdminField, string | null>): string[] {
  const dep = v.administrative_dependency?.toLowerCase() ?? null;
  const w: string[] = [];
  if (dep && dep !== "privada" && v.private_school_category) w.push("A categoria de escola privada continua preenchida, mas a dependência não é privada. Se não se aplica mais, escolha \"Limpar\".");
  if (dep && dep !== "privada" && v.partnership_public_authority) w.push("O poder público do convênio continua preenchido, mas a dependência não é privada. Se não há mais convênio, escolha \"Limpar\".");
  if (dep === "privada" && !v.private_school_category) w.push("Dependência privada sem categoria informada.");
  return w;
}
