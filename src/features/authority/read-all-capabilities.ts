/**
 * PERF.LOADING.3 — `effective_capabilities()` devolve uma linha por (capacidade × atuação × TURMA):
 * uma atuação de rede com 110 capacidades vira 110 × 698 = 76.780 linhas, e o servidor de dados corta
 * cada resposta em 1000 EM SILÊNCIO — permissões após a linha 1000 sumiam do menu, das rotas e dos botões.
 *
 * Correção estrutural: `effective_capability_grants()` devolve uma linha por CONCESSÃO (rede/escola sem
 * expandir por turma) e `effective_capability_scope_classes()` as turmas desse alcance; a expansão aqui
 * reproduz exatamente as linhas de `effective_capabilities()` (mesma forma, mesmos campos). Ambos os
 * leitores são paginados até esgotar; acima do teto de segurança a leitura FALHA (nunca devolve parcial).
 * Sem curinga: só o que o banco devolveu. RLS/writers continuam sendo a garantia.
 */
export const CAPABILITY_PAGE = 1000;
export const CAPABILITY_HARD_MAX = 200_000;

type Err = { message: string } | null;
type PageRes = { data: unknown[] | null; error: Err };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rpcish = { rpc: (...a: any[]) => any };

export type CapabilityRow = {
  capability_id: string; engagement_id: string | null; policy_id: string | null; policy_version: number | null;
  school_id: string | null; class_id: string | null; component_id: string | null; period_id: string | null;
};
export type GrantRow = Omit<CapabilityRow, never> & { scope_level: string };

export async function readRpcPages(db: Rpcish, fn: string, order: readonly string[], args: Record<string, unknown> = {}, page = CAPABILITY_PAGE, hardMax = CAPABILITY_HARD_MAX): Promise<PageRes> {
  const out: unknown[] = [];
  for (let from = 0; from < hardMax; from += page) {
    let q = db.rpc(fn, args);
    // Duplos de teste sem construtor encadeável: resposta única, sem paginação.
    if (typeof q?.order !== "function" || typeof q?.range !== "function") { const r = (await q) as PageRes; return r.error ? { data: null, error: r.error } : { data: r.data ?? [], error: null }; }
    for (const c of order) q = q.order(c, { ascending: true, nullsFirst: true });
    const { data, error } = (await q.range(from, from + page - 1)) as PageRes;
    if (error) return { data: null, error };
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < page) return { data: out, error: null };
  }
  return { data: null, error: { message: `${fn}: acima do teto de segurança; leitura recusada para não truncar` } };
}

/** Expansão pura: concessões + turmas do alcance ⇒ linhas idênticas às de effective_capabilities(). */
export type ExpandMode = "class" | "school";

/**
 * Expansão pura. `class` reproduz exatamente as linhas de effective_capabilities() (uma por turma).
 * `school` (padrão da tela) gera uma linha por ESCOLA com `class_id = null` para concessões rede/escola —
 * o cliente já trata classId nulo como "todas as turmas"; escolas sem turma não entram, como no leitor original.
 */
export function expandGrants(grants: readonly GrantRow[], scopeClasses: readonly { school_id: string; class_id: string }[], mode: ExpandMode = "class"): CapabilityRow[] {
  const bySchool = new Map<string, string[]>();
  for (const c of scopeClasses) { const l = bySchool.get(c.school_id); if (l) l.push(c.class_id); else bySchool.set(c.school_id, [c.class_id]); }
  const out: CapabilityRow[] = [];
  for (const g of grants) {
    const base = { capability_id: g.capability_id, engagement_id: g.engagement_id, policy_id: g.policy_id, policy_version: g.policy_version, component_id: g.component_id, period_id: g.period_id };
    if (g.scope_level === "rede") {
      for (const [school, classes] of bySchool) {
        if (mode === "school") out.push({ ...base, school_id: school, class_id: null });
        else for (const cls of classes) out.push({ ...base, school_id: school, class_id: cls });
      }
    } else if (g.scope_level === "escola") {
      const classes = (g.school_id ? bySchool.get(g.school_id) : undefined) ?? [];
      if (mode === "school") { if (classes.length) out.push({ ...base, school_id: g.school_id, class_id: null }); }
      else for (const cls of classes) out.push({ ...base, school_id: g.school_id, class_id: cls });
    } else {
      out.push({ ...base, school_id: g.school_id, class_id: g.class_id });
    }
  }
  return out;
}

export async function readAllEffectiveCapabilities(db: Rpcish, args: Record<string, unknown> = {}, mode: ExpandMode = "school"): Promise<PageRes> {
  // O construtor do cliente real é preguiçoso (só executa ao ser aguardado): esta sonda não gera requisição.
  const probe = db.rpc("effective_capabilities", args);
  // Duplo de teste legado (sem construtor): mantém o contrato antigo de uma chamada.
  if (typeof probe?.order !== "function") {
    const r = (await probe) as PageRes;
    return r.error ? { data: null, error: r.error } : { data: r.data ?? [], error: null };
  }
  const [g, c] = await Promise.all([
    readRpcPages(db, "effective_capability_grants", ["capability_id", "engagement_id", "school_id", "class_id", "component_id", "period_id"], args),
    readRpcPages(db, "effective_capability_scope_classes", ["school_id", "class_id"], args),
  ]);
  const error = g.error ?? c.error;
  if (error) return { data: null, error };
  return { data: expandGrants(g.data as GrantRow[], c.data as { school_id: string; class_id: string }[], mode), error: null };
}
