/**
 * L08 Permanência — ficha individual do caso (projeção pura, sem tabela).
 * Cada aba lê só a fonte canônica (L02 frequência, L05 alertas, AA eventos, L07 fluxo,
 * GED/DocServ, B3) e exige capacidade própria: mínimo necessário por perfil.
 * Aba não autorizada não aparece nem conta; fonte não lida ≠ vazia; a linha do tempo
 * só compõe itens de abas autorizadas, porque contagem ou título vazariam fato restrito.
 */
export const DOSSIER_TABS = ["visao-geral", "frequencia", "historico", "alertas", "contatos", "barreiras", "planos", "visitas",
  "encaminhamentos", "retorno", "permanencia", "documentos", "linha-do-tempo"] as const;
export type TabId = (typeof DOSSIER_TABS)[number];

/** Capacidade exigida por aba: dado restrito (barreiras, visitas, documentos) tem capacidade própria. */
export const TAB_CAPABILITY: Record<Exclude<TabId, "linha-do-tempo">, string> = {
  "visao-geral": "acompanhar-permanencia", frequencia: "acompanhar-permanencia", historico: "ler-historico-pertinente",
  alertas: "acompanhar-permanencia", contatos: "ler-contatos-do-caso", barreiras: "ler-barreiras-do-caso",
  planos: "acompanhar-permanencia", visitas: "ler-visitas-do-caso", encaminhamentos: "acompanhar-permanencia",
  retorno: "acompanhar-permanencia", permanencia: "acompanhar-permanencia", documentos: "ler-documentos-do-caso",
};
export const TAB_SOURCE: Record<Exclude<TabId, "linha-do-tempo">, string> = {
  "visao-geral": "aa_outreach_cases+permanence_case_numbers", frequencia: "attendance-monitoring(L02)", historico: "student_trajectory_at",
  alertas: "permanence_alerts", contatos: "aa_outreach_events(contato)", barreiras: "aa_intervention_versions",
  planos: "aa_intervention_versions(plano)", visitas: "aa_outreach_events(visita)", encaminhamentos: "aa_outreach_events(encaminhamento)",
  retorno: "aa_outreach_events(retorno)", permanencia: "workflow_events(permanencia)", documentos: "admin_case_events_safe/docserv",
};

export interface Item { id: string; at: string; title: string; fields: Record<string, unknown>; sensitive?: boolean }
export type SourceRead = { kind: "lida"; items: Item[] } | { kind: "nao-lida"; reason: string } | { kind: "recusada" };

export type TabView =
  | { tab: TabId; state: "disponivel"; items: Item[]; source: string }
  | { tab: TabId; state: "vazia"; source: string }
  | { tab: TabId; state: "nao-disponivel"; reason: string; source: string };

/** Campos por perfil: allowlist; sensível só com capacidade específica. */
export interface FieldPolicy { allow: Partial<Record<TabId, readonly string[]>>; sensitiveCapability: string }

const BANNED = /\b(cpf|endere[cç]o|telefone|cid|laudo|diagn[oó]stico)\b/i;

function minimize(it: Item, allow: readonly string[] | undefined, seeSensitive: boolean): Item | null {
  if (it.sensitive && !seeSensitive) return null;
  const fields: Record<string, unknown> = {};
  for (const k of allow ?? []) if (k in it.fields && !BANNED.test(k)) fields[k] = it.fields[k];
  return { id: it.id, at: it.at, title: it.title, fields };
}

export function buildDossier(caps: ReadonlySet<string>, reads: Partial<Record<TabId, SourceRead>>, policy: FieldPolicy):
  { tabs: TabView[]; timeline: Item[] } {
  const seeSensitive = caps.has(policy.sensitiveCapability);
  const tabs: TabView[] = [];
  for (const tab of DOSSIER_TABS) {
    if (tab === "linha-do-tempo") continue;
    if (!caps.has(TAB_CAPABILITY[tab])) continue; // não autorizada: nem aparece
    const source = TAB_SOURCE[tab];
    const r = reads[tab];
    if (!r) { tabs.push({ tab, state: "nao-disponivel", reason: "Fonte não lida.", source }); continue; }
    if (r.kind === "recusada") { tabs.push({ tab, state: "nao-disponivel", reason: "Sem permissão na fonte.", source }); continue; }
    if (r.kind === "nao-lida") { tabs.push({ tab, state: "nao-disponivel", reason: r.reason, source }); continue; }
    const items = r.items.map((i) => minimize(i, policy.allow[tab], seeSensitive)).filter((x): x is Item => x !== null);
    tabs.push(items.length ? { tab, state: "disponivel", items, source } : { tab, state: "vazia", source });
  }
  const timeline = tabs.flatMap((t) => (t.state === "disponivel" ? t.items.map((i) => ({ ...i, id: `${t.tab}:${i.id}` })) : []))
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  if (tabs.length) tabs.push(timeline.length ? { tab: "linha-do-tempo", state: "disponivel", items: timeline, source: "composição das abas autorizadas" }
    : { tab: "linha-do-tempo", state: "vazia", source: "composição das abas autorizadas" });
  return { tabs, timeline };
}

/** Rótulos sem jargão de evasão; nunca "risco" ou "evadido". */
export const TAB_LABEL: Record<TabId, string> = {
  "visao-geral": "Visão geral", frequencia: "Frequência", historico: "Histórico pertinente", alertas: "Alertas", contatos: "Contatos",
  barreiras: "Barreiras", planos: "Planos", visitas: "Visitas", encaminhamentos: "Encaminhamentos", retorno: "Retorno",
  permanencia: "Permanência", documentos: "Documentos", "linha-do-tempo": "Linha do tempo",
};
