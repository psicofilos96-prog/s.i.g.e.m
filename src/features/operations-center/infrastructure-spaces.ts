/**
 * Centro de Operações — L03: hierarquia física (migration 0405).
 * escola (cadastro canônico) → prédio/bloco → pavimento → ambiente → instalação/equipamento.
 * Tipos de espaço são configuração versionada; só a ÚLTIMA versão aprovada por pessoa ≠ autor
 * (com decisão) é utilizável. Condições e recursos de acessibilidade admitidos vêm do tipo.
 * Espaço = identidade + versões append-only; a ficha é projeção na data (asOf).
 * Capacidade só com fonte declarada; sem fonte ⇒ null ("não informada"), nunca zero.
 * Condição só com data de avaliação; sem avaliação ⇒ "não avaliada".
 * Este núcleo não conhece nomes de tipo, condição nem recurso: tudo é dado configurado.
 */
export type SpaceLevel = "predio" | "pavimento" | "ambiente" | "instalacao";
export const SPACE_LEVELS: readonly SpaceLevel[] = ["predio", "pavimento", "ambiente", "instalacao"];
export const PARENT_LEVEL: Record<SpaceLevel, SpaceLevel | null> = { predio: null, pavimento: "predio", ambiente: "pavimento", instalacao: "ambiente" };

export interface SpaceTypeVersion {
  id: string; typeKey: string; version: number; level: SpaceLevel; label: string;
  allowedConditions: string[]; accessibilityFeatures: string[]; capacityUnit: string | null; authorPerson: string;
  approval: { approverPerson: string; decisionRef: string } | null;
}
export interface Space { id: string; schoolId: string; parentId: string | null; level: SpaceLevel }
export interface SpaceVersion {
  spaceId: string; version: number; typeVersionId: string; name: string;
  capacity: number | null; capacitySource: string | null; accessibility: string[];
  condition: string | null; conditionAssessedOn: string | null; restrictions: string | null;
  validFrom: string; status: "ativo" | "desativado"; authorPerson: string; reason: string | null;
}

/** Tipo utilizável = última versão do tipo, aprovada por pessoa diferente do autor. */
export function usableType(types: readonly SpaceTypeVersion[], typeVersionId: string): SpaceTypeVersion | null {
  const t = types.find((x) => x.id === typeVersionId);
  if (!t || !t.approval || t.approval.approverPerson === t.authorPerson || !t.approval.decisionRef.trim()) return null;
  const latest = Math.max(...types.filter((x) => x.typeKey === t.typeKey).map((x) => x.version));
  return t.version === latest ? t : null;
}

export function validateSpaceVersion(v: Omit<SpaceVersion, "spaceId" | "version" | "authorPerson">, space: Space, type: SpaceTypeVersion | null, today: string): string[] {
  const p: string[] = [];
  if (!type) p.push("Tipo sem versão aprovada vigente.");
  else {
    if (type.level !== space.level) p.push("Tipo é de outro nível da hierarquia.");
    if (v.condition && !type.allowedConditions.includes(v.condition)) p.push("Condição não configurada no tipo.");
    const bad = v.accessibility.filter((f) => !type.accessibilityFeatures.includes(f));
    if (bad.length) p.push(`Recurso de acessibilidade não configurado: ${bad.join(", ")}.`);
  }
  if ((v.capacity === null) !== (v.capacitySource === null)) p.push("Capacidade exige fonte declarada.");
  if (v.capacity !== null && v.capacity < 0) p.push("Capacidade negativa.");
  if ((v.condition === null) !== (v.conditionAssessedOn === null)) p.push("Condição exige data de avaliação.");
  if (v.conditionAssessedOn && v.conditionAssessedOn > today) p.push("Avaliação no futuro.");
  return p;
}

export function validateParent(level: SpaceLevel, parent: Space | null, schoolId: string): string | null {
  const need = PARENT_LEVEL[level];
  if (need === null) return parent ? "Prédio/bloco fica direto na escola." : null;
  if (!parent) return `Nível ${level} exige pai do nível ${need}.`;
  if (parent.schoolId !== schoolId) return "Pai pertence a outra escola.";
  if (parent.level !== need) return `Pai deve ser ${need}.`;
  return null;
}

/** Versão vigente na data: maior versão com validFrom ≤ asOf. */
export function spaceOn(versions: readonly SpaceVersion[], spaceId: string, asOf: string): SpaceVersion | null {
  return versions.filter((v) => v.spaceId === spaceId && v.validFrom <= asOf).sort((a, b) => b.version - a.version)[0] ?? null;
}

export interface SpaceNode {
  space: Space; current: SpaceVersion | null; children: SpaceNode[];
  capacityLabel: string; conditionLabel: string; issues: string[];
}

/** Árvore de uma escola na data; espaço sem versão vigente aparece como "sem registro", nunca some. */
export function buildTree(schoolId: string, spaces: readonly Space[], versions: readonly SpaceVersion[], asOf: string, includeInactive = false): SpaceNode[] {
  const mine = spaces.filter((s) => s.schoolId === schoolId);
  const node = (s: Space): SpaceNode | null => {
    const cur = spaceOn(versions, s.id, asOf);
    if (cur?.status === "desativado" && !includeInactive) return null;
    const issues: string[] = [];
    const par = s.parentId ? mine.find((x) => x.id === s.parentId) ?? null : null;
    const pe = validateParent(s.level, par, schoolId);
    if (pe) issues.push(pe);
    if (!cur) issues.push("Sem versão vigente nesta data.");
    return {
      space: s, current: cur, issues,
      children: mine.filter((c) => c.parentId === s.id).map(node).filter((n): n is SpaceNode => n !== null),
      capacityLabel: cur?.capacity == null ? "não informada" : `${cur.capacity} (fonte: ${cur.capacitySource})`,
      conditionLabel: cur?.condition == null ? "não avaliada" : `${cur.condition} em ${cur.conditionAssessedOn}`,
    };
  };
  return mine.filter((s) => s.level === "predio").map(node).filter((n): n is SpaceNode => n !== null);
}

/** Capacidade agregada só quando TODOS os filhos ativos têm capacidade; senão null com motivo. */
export function aggregateCapacity(n: SpaceNode): { value: number | null; missing: number } {
  const leaves: SpaceNode[] = [];
  const walk = (x: SpaceNode) => (x.children.length ? x.children.forEach(walk) : leaves.push(x));
  walk(n);
  const missing = leaves.filter((l) => l.current?.capacity == null).length;
  return { value: missing ? null : leaves.reduce((a, l) => a + (l.current!.capacity ?? 0), 0), missing };
}

export const spaceKey = (school: string, purposeRef: string) => `ops-space|${school}|${purposeRef}`;
export const spaceVersionKey = (space: string, expected: number) => `ops-space-v|${space}|${expected}`;
