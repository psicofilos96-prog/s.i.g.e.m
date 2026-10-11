// SIGEM 2.0 — Direção Escolar, Lote 01: arquitetura e perfis (núcleo puro, sem banco próprio).
// Autoridade = capacidade efetiva vigente na ESCOLA (has_capability/effective_capabilities); cargo é só rótulo.
// Diretor = designação formal vigente (DP); adjunto = delegação explícita, nunca herda poder exclusivo;
// equipe gestora = competências declaradas. Sem grant ⇒ nada (fail-closed).

export type ActionLevel = "visualizar" | "solicitar" | "editar" | "validar" | "homologar";
const ORDER: ActionLevel[] = ["visualizar", "solicitar", "editar", "validar", "homologar"];

export interface Grant {
  id: string; schoolId: string; kind: "designacao-diretor" | "delegacao-adjunto" | "competencia-equipe";
  capabilities: { area: string; level: ActionLevel }[];
  validFrom: string; validTo: string | null; revokedOn: string | null;
  delegatedFromGrantId?: string; // obrigatório para adjunto
}

/** Poderes que só a designação formal do diretor carrega (especificação: assinatura do Diretor Geral, Caderno Negro). */
export const EXCLUSIVE_DIRECTOR_AREAS = ["assinatura-diretor-geral", "ocorrencias-caderno-negro"] as const;

const active = (g: Grant, on: string) => g.validFrom <= on && (g.validTo == null || on <= g.validTo) && (g.revokedOn == null || on < g.revokedOn);

/** Nível efetivo numa área, na escola e data; delegação vale só enquanto a designação de origem vale e nunca excede seu nível. */
export function effectiveLevel(grants: Grant[], schoolId: string, area: string, on: string): ActionLevel | null {
  let best = -1;
  for (const g of grants) {
    if (g.schoolId !== schoolId || !active(g, on)) continue;
    if (g.kind === "delegacao-adjunto") {
      if ((EXCLUSIVE_DIRECTOR_AREAS as readonly string[]).includes(area)) continue;
      const origin = grants.find((o) => o.id === g.delegatedFromGrantId && o.kind === "designacao-diretor" && o.schoolId === schoolId);
      if (!origin || !active(origin, on)) continue;
      const cap = g.capabilities.find((c) => c.area === area);
      const max = origin.capabilities.find((c) => c.area === area);
      if (!cap || !max) continue;
      best = Math.max(best, Math.min(ORDER.indexOf(cap.level), ORDER.indexOf(max.level)));
      continue;
    }
    const cap = g.capabilities.find((c) => c.area === area);
    if (cap) best = Math.max(best, ORDER.indexOf(cap.level));
  }
  return best < 0 ? null : ORDER[best]!;
}

export function can(grants: Grant[], schoolId: string, area: string, level: ActionLevel, on: string) {
  const l = effectiveLevel(grants, schoolId, area, on);
  return l != null && ORDER.indexOf(l) >= ORDER.indexOf(level);
}

/** Mudança de direção: nova designação só com a anterior encerrada (nunca substituição silenciosa). */
export function designationConflict(grants: Grant[], schoolId: string, from: string) {
  const open = grants.find((g) => g.kind === "designacao-diretor" && g.schoolId === schoolId && active(g, from));
  return open ? { code: "direcao:designacao-vigente", currentGrantId: open.id } : null;
}

/** Histórico de quem dirigiu a escola: só das designações registradas, em ordem; nada antes do primeiro registro. */
export function directorHistory(grants: Grant[], schoolId: string) {
  return grants.filter((g) => g.kind === "designacao-diretor" && g.schoolId === schoolId)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .map((g) => ({ grantId: g.id, from: g.validFrom, to: g.revokedOn ?? g.validTo }));
}

/** Documento sensível: exige capacidade específica declarada; hierarquia não abre conteúdo. */
export function sensitiveDocumentAccess(grants: Grant[], schoolId: string, doc: { sensitivity: "comum" | "restrito-orientacao" | "saude" | "ocorrencia" }, on: string) {
  const area = doc.sensitivity === "comum" ? "documentos-escola" : `documentos-${doc.sensitivity}`;
  return can(grants, schoolId, area, "visualizar", on) ? "conteudo" : "suprimido";
}

/** Navegação por grupos (especificação OP/Direção): grupo aparece só com alguma área visível; escola e ano sempre explícitos. */
export const NAV_GROUPS = [
  { group: "Painel", items: [{ area: "painel-direcao", path: "/gestao-escolar" }] },
  { group: "Pedagógico", items: [{ area: "rendimento-frequencia", path: "/gestao-escolar" }, { area: "aprovacoes-op", path: "/gestao-escolar" }, { area: "conselho-classe", path: "/conselho-de-classe" }] },
  { group: "Estudantes", items: [{ area: "perfil-aluno", path: "/secretaria" }, { area: "ocorrencias-caderno-negro", path: "/gestao-escolar" }, { area: "reclassificacao", path: "/gestao-escolar" }] },
  { group: "Secretaria (leitura)", items: [{ area: "mapa-estatistico", path: "/mapa-estatistico" }, { area: "vagas", path: "/secretaria/vagas" }] },
  { group: "Operação", items: [{ area: "alimentacao", path: "/alimentacao" }, { area: "transporte", path: "/transporte" }, { area: "infraestrutura", path: "/infraestrutura" }] },
  { group: "Documentos", items: [{ area: "documentos-escola", path: "/central-de-documentos" }, { area: "assinatura-diretor-geral", path: "/central-de-documentos" }] },
] as const;

export function navigationFor(grants: Grant[], ctx: { schoolId: string | null; year: number | null; on: string }) {
  if (!ctx.schoolId || ctx.year == null) return { ok: false as const, code: "direcao:escola-ou-ano-nao-selecionado" };
  const groups = NAV_GROUPS.map((g) => ({ group: g.group, items: g.items.filter((i) => can(grants, ctx.schoolId!, i.area, "visualizar", ctx.on)) }))
    .filter((g) => g.items.length > 0);
  return { ok: true as const, groups };
}
