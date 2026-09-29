/**
 * 14.10 — Mapa Estatístico: domínio puro (regra de competência, montagem, conferência, situação).
 *
 * Cadeia: fatos canônicos + regras + declarações → versão oficial do Mapa. Nunca o inverso:
 * o CIECE continua calculando a partir dos fatos, e o Mapa não é fonte de indicador.
 *
 * - A data da fotografia vem SÓ da regra homologada (`snapshotDate`), nunca do código.
 * - Células A (automáticas) leem fontes canônicas; células B (calculadas) passam pelo motor
 *   14.2 com a definição declarada na regra; C é só observações; D mostra "sem fonte" e
 *   nunca aceita digitação. Totais nunca são editáveis: não existe campo de entrada para eles.
 * - Ausente, indeterminado, não aplicável, sem regra e zero observado são estados distintos.
 */
import { computeIndicator, IndicatorRegistry, type IndicatorDefinition } from "@/features/ciece/indicator-engine";
import type { CanonicalFact } from "@/features/ciece/canonical-fact-types";
import { projectSchoolDimensions } from "@/features/ciece/school-dimensions";
import { schoolVersionAt, type SchoolUnit } from "@/features/schools/school-registry";

// ---------------- Regra de competência (configuração homologável) ----------------

/** Primitivas de calendário; qual delas vale é escolha da regra, não do código. */
export type SnapshotDateRule =
  | { kind: "dia-do-mes"; day: number }
  | { kind: "ultimo-dia-do-mes" }
  | { kind: "data-declarada-por-competencia"; dates: Readonly<Record<string, string>> };

export type MapCellRule = {
  cellId: string;
  sectionId: string;
  label: string;
  definition: IndicatorDefinition;
  groupBy?: string;
};

export type MapCompetenceRuleDefinition = {
  snapshotDate: SnapshotDateRule;
  cells: readonly MapCellRule[];
  /** Células cujo estado não-determinado bloqueia a oficialização. Nada declarado ⇒ nada bloqueia. */
  blockingCellIds: readonly string[];
};

export type MapCompetenceRule = {
  id: string;
  version: number;
  status: "rascunho" | "homologada";
  homologationActRef: string | null;
  validFrom: string;
  validUntil: string | null;
  definition: MapCompetenceRuleDefinition;
};

export type Competence = { schoolId: string; year: number; month: number };

const pad = (n: number) => String(n).padStart(2, "0");
export const competenceKey = (c: { year: number; month: number }) => `${c.year}-${pad(c.month)}`;
export function competenceWindow(c: { year: number; month: number }): { from: string; to: string } {
  const last = new Date(Date.UTC(c.year, c.month, 0)).getUTCDate();
  return { from: `${c.year}-${pad(c.month)}-01`, to: `${c.year}-${pad(c.month)}-${pad(last)}` };
}

export function isRuleApplicable(rule: MapCompetenceRule | null | undefined, c: { year: number; month: number }): rule is MapCompetenceRule {
  if (!rule || rule.status !== "homologada" || !rule.homologationActRef) return false;
  const { from } = competenceWindow(c);
  return rule.validFrom <= from && (rule.validUntil == null || rule.validUntil >= from);
}

/** Data da fotografia segundo a regra homologada; sem regra ⇒ null (nunca inventada). */
export function resolveSnapshotDate(rule: MapCompetenceRule | null | undefined, c: { year: number; month: number }): string | null {
  if (!isRuleApplicable(rule, c)) return null;
  const w = competenceWindow(c);
  const r = rule.definition.snapshotDate;
  if (r.kind === "ultimo-dia-do-mes") return w.to;
  if (r.kind === "dia-do-mes") {
    const d = `${c.year}-${pad(c.month)}-${pad(r.day)}`;
    return d >= w.from && d <= w.to && r.day >= 1 ? d : null;
  }
  const d = r.dates[competenceKey(c)];
  return d && d >= w.from && d <= w.to ? d : null;
}

// ---------------- Layout do Mapa (estrutura do documento, auditoria 14.9) ----------------

export type CellOrigin = "automatico" | "calculado" | "declaracao" | "sem-fonte";

/** Campos D: fonte proprietária ainda inexistente. Não há campo de digitação para eles. */
export const MISSING_SOURCE_FIELDS: readonly { cellId: string; sectionId: string; label: string; owner: string }[] = [
  { cellId: "predio-proprio", sectionId: "identificacao", label: "Prédio próprio", owner: "Cadastro de Unidades (infraestrutura)" },
  { cellId: "dificil-acesso", sectionId: "identificacao", label: "Difícil acesso", owner: "Cadastro de Unidades (classificação)" },
  { cellId: "numero-de-salas", sectionId: "identificacao", label: "Número de salas", owner: "Cadastro de Unidades (infraestrutura)" },
  { cellId: "telefone", sectionId: "identificacao", label: "Telefone", owner: "Cadastro de Unidades (contato)" },
  { cellId: "email", sectionId: "identificacao", label: "E-mail", owner: "Cadastro de Unidades (contato)" },
  { cellId: "anexos", sectionId: "identificacao", label: "Anexos e seus endereços", owner: "Cadastro de Unidades (relação com anexos)" },
  { cellId: "direcao", sectionId: "identificacao", label: "Direção", owner: "Atuações (natureza de direção homologada)" },
  { cellId: "aee", sectionId: "turmas", label: "Estudantes com deficiência / AEE", owner: "Educação Especial" },
  { cellId: "transporte", sectionId: "turmas", label: "Transporte escolar", owner: "Transporte Escolar" },
  { cellId: "alimentacao", sectionId: "turmas", label: "Alimentação escolar", owner: "Alimentação Escolar" },
  { cellId: "lotacao", sectionId: "pessoal", label: "Lotação e vínculo funcional", owner: "Gestão de Pessoal" },
  { cellId: "alteracoes-pessoal", sectionId: "pessoal", label: "Alterações funcionais", owner: "Gestão de Pessoal" },
  { cellId: "visitas", sectionId: "visitas", label: "Visitas recebidas", owner: "Registro Institucional de Visitas" },
];

export const MAP_SECTIONS: readonly { id: string; label: string }[] = [
  { id: "identificacao", label: "Identificação da unidade" },
  { id: "movimentacao", label: "Movimentação estatística" },
  { id: "turmas", label: "Turmas e matrícula" },
  { id: "pessoal", label: "Pessoal" },
  { id: "visitas", label: "Visitas recebidas" },
];

// ---------------- Célula da fotografia ----------------

export type CellState =
  | "disponivel" // valor presente (inclui zero observado)
  | "ausente" // fonte existe, registro sem valor
  | "indeterminado"
  | "nao-aplicavel"
  | "sem-regra" // derivável, mas sem regra/definição homologada
  | "sem-fonte"; // fonte proprietária inexistente no SIGEM

export type MapCell = {
  cellId: string;
  sectionId: string;
  label: string;
  origin: CellOrigin;
  state: CellState;
  value: string | number | null;
  unit: string | null;
  reference: { at?: string; from?: string; to?: string } | null;
  source: string | null;
  recordRefs: string[];
  ruleRef: string | null;
  coverage: { eligible: number; observed: number; complete: boolean } | null;
  notes: string[];
  groups?: { key: string | null; value: number | null; state: string }[];
};

export type MapSnapshot = {
  schemaVersion: 1;
  competence: Competence & { key: string; window: { from: string; to: string } };
  snapshotDate: string | null;
  rule: { id: string; version: number } | null;
  cells: MapCell[];
  declarations: { observations: string; observationsEventId: string | null };
};

export type AssemblyInput = {
  competence: Competence;
  rule: MapCompetenceRule | null;
  schools: readonly SchoolUnit[];
  classes: readonly { id: string; name: string }[];
  facts: readonly CanonicalFact[];
  observations: { text: string; eventId: string | null };
};

const base = (o: Partial<MapCell> & Pick<MapCell, "cellId" | "sectionId" | "label" | "origin" | "state">): MapCell => ({
  value: null, unit: null, reference: null, source: null, recordRefs: [], ruleRef: null, coverage: null, notes: [], ...o,
});

export function assembleMapSnapshot(input: AssemblyInput): MapSnapshot {
  const { competence: c, rule } = input;
  const window = competenceWindow(c);
  const at = resolveSnapshotDate(rule, c);
  const applicable = isRuleApplicable(rule, c) ? rule : null;
  const cells: MapCell[] = [];

  // A — identificação pela versão do cadastro vigente NA DATA DA FOTOGRAFIA.
  const unit = input.schools.find((s) => s.schoolId === c.schoolId);
  const version = unit && at ? schoolVersionAt(unit, at) : null;
  const dims = unit && at ? projectSchoolDimensions(input.schools, c.schoolId, at) : null;
  const autoCell = (cellId: string, label: string, v: string | null, src: string) =>
    base({
      cellId, sectionId: "identificacao", label, origin: "automatico",
      state: !at ? "indeterminado" : !unit ? "ausente" : v == null ? "ausente" : "disponivel",
      value: v, reference: at ? { at } : null, source: src,
      recordRefs: version ? [`institutional_school_record_versions:${version.id}@${version.versionNumber}`] : [],
      notes: at ? [] : ["Sem data de fotografia: falta regra de competência homologada."],
    });
  cells.push(autoCell("nome-oficial", "Unidade escolar", version?.officialName ?? null, "institutional_school_record_versions"));
  cells.push(autoCell("inep", "INEP", dims?.schoolInep.value ?? null, "institutional_school_identifiers"));
  cells.push(autoCell("codigo-rede", "Código de rede", dims?.schoolRedeCode.value ?? null, "institutional_school_identifiers"));
  cells.push(autoCell("endereco", "Endereço", dims?.schoolAddress.value ?? null, "institutional_school_record_versions"));
  cells.push(autoCell("distrito", "Distrito", dims?.schoolDistrict.value ?? null, "institutional_school_record_versions"));
  cells.push(autoCell("localizacao", "Localização (urbana/rural)", dims?.schoolLocation.value ?? null, "institutional_school_record_versions"));

  // A — turmas: classificação da oferta e turno vigentes na data (um fato por turma e eixo).
  for (const cls of input.classes) {
    const vig = (f: CanonicalFact) => !!at && !!f.temporal.validFrom && f.temporal.validFrom <= at && (f.temporal.validTo == null || f.temporal.validTo >= at);
    const offering = input.facts.filter((f) => f.factTypeId === "organizacao-da-oferta-da-turma" && f.subject["classId"] === cls.id && vig(f));
    const shift = input.facts.filter((f) => f.factTypeId === "turno-da-turma" && f.subject["classId"] === cls.id && vig(f));
    const cat = (f: CanonicalFact) => (f.payload?.kind === "categorico" ? f.payload.categoryId : null);
    const parts = [...offering.map((f) => `${f.subject["axisSchemeId"]}: ${cat(f) ?? "?"}`), ...shift.map((f) => `turno: ${cat(f) ?? "?"}`)];
    cells.push(base({
      cellId: `turma:${cls.id}`, sectionId: "turmas", label: `Turma ${cls.name}`, origin: "automatico",
      state: !at ? "indeterminado" : parts.length ? "disponivel" : "ausente",
      value: parts.length ? parts.join(" · ") : null, reference: at ? { at } : null,
      source: "class_offering_versions + class_shift_versions",
      recordRefs: [...offering, ...shift].map((f) => `${f.provenance.sourceId}:${f.provenance.recordId}@${f.provenance.recordVersion}`),
      notes: parts.length || !at ? [] : ["Turma sem classificação da oferta nem turno vigentes na data."],
    }));
  }

  // B — células calculadas: só as declaradas pela regra homologada, sempre pelo motor 14.2.
  if (applicable) {
    const registry = new IndicatorRegistry();
    for (const cell of applicable.definition.cells) registry.register(cell.definition);
    for (const cell of applicable.definition.cells) {
      const d = cell.definition;
      const ruleRef = `${d.id}@${d.version}`;
      if (d.status !== "homologada") {
        cells.push(base({ cellId: cell.cellId, sectionId: cell.sectionId, label: cell.label, origin: "calculado", state: "sem-regra", unit: d.unit, ruleRef, notes: ["Definição da célula não homologada."] }));
        continue;
      }
      const reference = d.temporal.kind === "fotografia" ? (at ? { at } : null) : { from: window.from, to: window.to };
      if (!reference) {
        cells.push(base({ cellId: cell.cellId, sectionId: cell.sectionId, label: cell.label, origin: "calculado", state: "indeterminado", unit: d.unit, ruleRef, notes: ["Sem data de fotografia."] }));
        continue;
      }
      const r = computeIndicator(registry, input.facts, { definitionId: d.id, reference, filters: { schoolId: c.schoolId }, ...(cell.groupBy ? { groupBy: cell.groupBy } : {}) });
      if (!r.ok) {
        cells.push(base({ cellId: cell.cellId, sectionId: cell.sectionId, label: cell.label, origin: "calculado", state: "indeterminado", unit: d.unit, reference, ruleRef, notes: [`${r.code}: ${r.detail}`] }));
        continue;
      }
      const total = r.groups.length === 1 && !cell.groupBy ? r.groups[0]! : null;
      const g0 = total ?? null;
      const state: CellState = g0
        ? g0.status === "calculado" ? "disponivel" : g0.status === "populacao-vazia" ? "disponivel" : g0.status === "sem-fatos-disponiveis" ? "ausente" : "indeterminado"
        : r.groups.every((g) => g.status === "calculado" || g.status === "populacao-vazia") ? "disponivel" : "indeterminado";
      const zero = g0?.status === "populacao-vazia" && d.operation.evaluatorId === "contagem";
      cells.push(base({
        cellId: cell.cellId, sectionId: cell.sectionId, label: cell.label, origin: "calculado", state,
        value: g0 ? (zero ? 0 : g0.value) : null, unit: d.unit, reference, source: d.factTypeId, ruleRef,
        recordRefs: r.groups.flatMap((g) => g.factRefs.map((f) => `${f.sourceId}:${f.recordId}${f.recordVersion != null ? `@${f.recordVersion}` : ""}`)).sort(),
        coverage: g0 ? g0.coverage : null,
        notes: [...(g0?.reasons ?? []), ...(zero ? ["Zero observado: população vigente vazia na data."] : [])],
        ...(cell.groupBy ? { groups: r.groups.map((g) => ({ key: g.groupKey, value: g.value, state: g.status })) } : {}),
      }));
    }
  }

  // D — fonte institucional ausente: exibida, nunca editável.
  for (const f of MISSING_SOURCE_FIELDS)
    cells.push(base({ cellId: f.cellId, sectionId: f.sectionId, label: f.label, origin: "sem-fonte", state: "sem-fonte", source: f.owner, notes: ["Informação ainda sem fonte institucional no SIGEM."] }));

  return {
    schemaVersion: 1,
    competence: { ...c, key: competenceKey(c), window },
    snapshotDate: at,
    rule: applicable ? { id: applicable.id, version: applicable.version } : null,
    cells,
    declarations: { observations: input.observations.text, observationsEventId: input.observations.eventId },
  };
}

// ---------------- Marca da fotografia (conferência ↔ oficialização) ----------------

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
/** Marca determinística de todo o conteúdo que será oficializado (valores + proveniência + declarações). */
export function snapshotFingerprint(s: MapSnapshot): string {
  const str = canonical(s);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `mapa-v1-${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}-${str.length}`;
}

// ---------------- Admissibilidade e situação ----------------

export type OfficializationBlock = { code: "sem-regra-homologada" | "sem-data-de-fotografia" | "celula-exigida-nao-determinada"; detail: string };

/** O que bloqueia vem só da regra homologada; ausência de dado não bloqueia por si. */
export function officializationBlocks(s: MapSnapshot, rule: MapCompetenceRule | null): OfficializationBlock[] {
  if (!s.rule || !rule) return [{ code: "sem-regra-homologada", detail: "Não há regra de competência homologada para este mês." }];
  if (!s.snapshotDate) return [{ code: "sem-data-de-fotografia", detail: "A regra não determina a data da fotografia desta competência." }];
  return rule.definition.blockingCellIds
    .map((id) => s.cells.find((c) => c.cellId === id))
    .filter((c): c is MapCell => !!c && c.state !== "disponivel")
    .map((c) => ({ code: "celula-exigida-nao-determinada" as const, detail: `${c.label}: exigida pela regra e sem valor determinado.` }));
}

export type MapEvent = { id: string; kind: "observacoes" | "conferencia"; fingerprint: string | null; recordedAt: string; payload: { text?: string } };
export type MapVersionRow = { id: string; version: number; supersedesId: string | null; conferenceEventId: string; fingerprint: string; recordedAt: string };

export type MapStatus =
  | { id: "nao-aberto" }
  | { id: "em-preparacao" }
  | { id: "conferido"; conferenceEventId: string; fingerprint: string }
  | { id: "oficializado"; currentVersionId: string; version: number; corrected: boolean };

/**
 * Situação é projeção do ledger (eventos + versões), nunca campo persistido.
 * "Conferido" só vale se a conferência é o último evento e ainda não gerou versão.
 * Uma nova conferência após a oficialização significa correção em preparação.
 */
export function projectMapStatus(opened: boolean, events: readonly MapEvent[], versions: readonly MapVersionRow[]): MapStatus & { correctionInProgress?: boolean } {
  if (!opened) return { id: "nao-aberto" };
  const ordered = [...events].sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : a.id.localeCompare(b.id)));
  const last = ordered[ordered.length - 1];
  const used = new Set(versions.map((v) => v.conferenceEventId));
  const current = versions.find((v) => !versions.some((w) => w.supersedesId === v.id)) ?? null;
  if (last && last.kind === "conferencia" && last.fingerprint && !used.has(last.id))
    return { id: "conferido", conferenceEventId: last.id, fingerprint: last.fingerprint, ...(current ? { correctionInProgress: true } : {}) };
  if (current) {
    const afterVersion = ordered.some((e) => e.recordedAt > current.recordedAt);
    return { id: "oficializado", currentVersionId: current.id, version: current.version, corrected: current.version > 1, ...(afterVersion ? { correctionInProgress: true } : {}) };
  }
  return { id: "em-preparacao" };
}

export function latestObservations(events: readonly MapEvent[]): { text: string; eventId: string | null } {
  const obs = events.filter((e) => e.kind === "observacoes").sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
  return obs ? { text: obs.payload.text ?? "", eventId: obs.id } : { text: "", eventId: null };
}

/** Capacidades do Mapa (auditoria: nenhuma existente representava estes atos). */
export const MAP_CAPABILITIES = {
  consult: "consultar-mapa-estatistico",
  prepare: "preparar-mapa-estatistico",
  confer: "conferir-mapa-estatistico",
  officialize: "oficializar-mapa-estatistico",
  correct: "corrigir-mapa-estatistico",
  history: "consultar-historico-mapa-estatistico",
} as const;
