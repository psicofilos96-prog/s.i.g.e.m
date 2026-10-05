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
import { visitsIn, type VisitRow } from "@/features/school-visits/visit-record";
import { functionalEventsIn, postingsAt, type FunctionalEventRow, type FunctionalLinkRow, type PostingRow } from "@/features/professionals/functional-record";

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
  /** T — escopo explícito: escolas cobertas pela regra. Escola fora da lista ⇒ regra não se aplica. */
  coveredSchoolIds: readonly string[];
  snapshotDate: SnapshotDateRule;
  /** T — célula do snapshot oficial ANTERIOR herdada como "Matrícula do mês anterior". Nada declarado ⇒ sem herança. */
  previousMonthEnrollmentCellId?: string;
  cells: readonly MapCellRule[];
  /** Células cujo estado não-determinado bloqueia a oficialização. Nada declarado ⇒ nada bloqueia. */
  blockingCellIds: readonly string[];
  /** 14.11.2 — tipos de atuação (catálogo homologável 'tipo-de-atuacao') que representam a direção exibida. Nada declarado ⇒ direção sem regra. */
  schoolLeadershipEngagementKindIds?: readonly string[];
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

/** Homologada (ato humano registrado no banco; documento é opcional), vigente no mês e com a escola coberta explicitamente. */
export function isRuleApplicable(rule: MapCompetenceRule | null | undefined, c: { year: number; month: number; schoolId: string }): rule is MapCompetenceRule {
  if (!rule || rule.status !== "homologada") return false;
  if (!Array.isArray(rule.definition?.coveredSchoolIds) || !rule.definition.coveredSchoolIds.includes(c.schoolId)) return false;
  const { from } = competenceWindow(c);
  return rule.validFrom <= from && (rule.validUntil == null || rule.validUntil >= from);
}

/** Data da fotografia segundo a regra homologada; sem regra ⇒ null (nunca inventada). */
export function resolveSnapshotDate(rule: MapCompetenceRule | null | undefined, c: { year: number; month: number; schoolId: string }): string | null {
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

export type CellOrigin = "automatico" | "calculado" | "declaracao" | "herdado" | "sem-fonte";

/** Campos D: fonte proprietária ainda inexistente. Não há campo de digitação para eles. */
export const MISSING_SOURCE_FIELDS: readonly { cellId: string; sectionId: string; label: string; owner: string }[] = [
  { cellId: "aee", sectionId: "turmas", label: "Estudantes com deficiência / AEE", owner: "Educação Especial" },
  { cellId: "transporte", sectionId: "turmas", label: "Transporte escolar", owner: "Transporte Escolar" },
  { cellId: "alimentacao", sectionId: "turmas", label: "Alimentação escolar", owner: "Alimentação Escolar" },
  { cellId: "jornada-profissional", sectionId: "pessoal", label: "Jornada/carga horária dos profissionais", owner: "Departamento de Pessoal (Frente E sem fonte)" },
  { cellId: "mediadores", sectionId: "pessoal", label: "Mediadores escolares", owner: "Educação Especial / Inclusão" },
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
  /** T — estado operacional do ano na competência (ledger S1); só "operacional" admite Mapa oficial. */
  yearState?: string | null;
  competence: Competence & { key: string; window: { from: string; to: string } };
  snapshotDate: string | null;
  rule: { id: string; version: number } | null;
  cells: MapCell[];
  declarations: { observations: string; observationsEventId: string | null };
};

/** Vínculo temporal principal → unidade vinculada (institutional_school_links). */
export type SchoolLinkRecord = {
  id: string; logicalLinkId: string; version: number; supersedesId: string | null;
  principalSchoolId: string; linkedSchoolId: string; linkKindId: string; linkKindVersion: number;
  validFrom: string; validUntil: string | null; originatingActRef: string;
};
/** Atuação vigente de tipo declarado, já filtrada no banco por escola, data e homologação do tipo. */
export type LeadershipEngagement = {
  engagementId: string; personId: string; personName: string; engagementKindId: string;
  validFrom: string; validUntil: string | null; originatingActRef: string | null;
};

export type AssemblyInput = {
  competence: Competence;
  rule: MapCompetenceRule | null;
  schools: readonly SchoolUnit[];
  classes: readonly { id: string; name: string }[];
  facts: readonly CanonicalFact[];
  observations: { text: string; eventId: string | null };
  links?: readonly SchoolLinkRecord[];
  /** Resultado da leitura de direção NA DATA DA FOTOGRAFIA; null = leitura não realizada. */
  leadership?: readonly LeadershipEngagement[] | null;
  /** 14.12 — registro funcional; null = fonte não lida (falha ou sem permissão). */
  functional?: { links: readonly FunctionalLinkRow[]; postings: readonly PostingRow[]; events: readonly FunctionalEventRow[] } | null;
  /** 14.13 — Registro Institucional de Visitas; null = fonte não lida. */
  visits?: readonly VisitRow[] | null;
  /** T — estado do ano (S1) na competência; undefined = não lido. */
  yearState?: string | null;
  /** T — versão oficial VIGENTE do mês anterior; null = não existe; undefined = não lida. */
  previousOfficial?: { versionId: string; version: number; competenceKey: string; snapshot: MapSnapshot } | null;
  /** T — atribuições docentes (B4.8) por turma na data; null = não lidas. Lotação nunca entra aqui. */
  teaching?: readonly { classId: string; assignmentId: string; versionId: string; version: number; personId: string | null; componentLabel: string | null; state: string }[] | null;
};

/** T — herança travada: valor vem do snapshot oficial anterior; sem predecessor, ausência explícita (nunca zero). */
export function previousMonthCell(rule: MapCompetenceRule | null, prev: AssemblyInput["previousOfficial"]): MapCell {
  const id = rule?.definition.previousMonthEnrollmentCellId;
  const label = "Matrícula do mês anterior";
  if (!rule || !id) return base({ cellId: "matricula-mes-anterior", sectionId: "movimentacao", label, origin: "herdado", state: "sem-regra", notes: ["A regra da competência não declara qual célula herdar."] });
  if (prev === undefined) return base({ cellId: "matricula-mes-anterior", sectionId: "movimentacao", label, origin: "herdado", state: "indeterminado", notes: ["Mapa oficial anterior não pôde ser lido."] });
  if (prev === null) return base({ cellId: "matricula-mes-anterior", sectionId: "movimentacao", label, origin: "herdado", state: "ausente",
    notes: ["Primeiro Mapa operacional: não há Mapa oficial do mês anterior. Nenhum valor é inventado nem herdado do baseline 2026."] });
  const src = prev.snapshot.cells.find((c) => c.cellId === id);
  return base({
    cellId: "matricula-mes-anterior", sectionId: "movimentacao", label, origin: "herdado",
    state: src?.state === "disponivel" ? "disponivel" : "indeterminado", value: src?.state === "disponivel" ? src.value : null, unit: src?.unit ?? null,
    reference: src?.reference ?? null, source: "statistical_map_versions", recordRefs: [`statistical_map_versions:${prev.versionId}@${prev.version}`],
    notes: [`Herdado e travado do Mapa oficial ${prev.competenceKey} (versão ${prev.version}).`, ...(src?.state === "disponivel" ? [] : ["A célula herdada não estava determinada no Mapa anterior."])],
  });
}

/** Versões vigentes (não superadas) de vínculos válidos na data. */
export function linksAt(links: readonly SchoolLinkRecord[], principal: string, at: string): SchoolLinkRecord[] {
  const superseded = new Set(links.map((l) => l.supersedesId).filter(Boolean));
  return links.filter((l) => !superseded.has(l.id) && l.principalSchoolId === principal && l.validFrom <= at && (l.validUntil == null || l.validUntil >= at))
    .sort((a, b) => a.linkedSchoolId.localeCompare(b.linkedSchoolId));
}

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
  // 14.11.1 — mesmos registros versionados: a versão da data preserva Mapas históricos.
  const yn = (b: boolean | null | undefined) => (b == null ? null : b ? "Sim" : "Não");
  cells.push(autoCell("telefone", "Telefone", version?.phone ?? null, "institutional_school_record_versions"));
  cells.push(autoCell("email", "E-mail", version?.institutionalEmail ?? null, "institutional_school_record_versions"));
  cells.push(autoCell("predio-proprio", "Prédio próprio", yn(version?.ownBuilding), "institutional_school_record_versions"));
  cells.push(autoCell("dificil-acesso", "Difícil acesso", yn(version?.hardAccess), "institutional_school_record_versions"));
  cells.push(autoCell("numero-de-salas", "Número de salas", version?.classroomCount == null ? null : String(version.classroomCount), "institutional_school_record_versions"));

  // Anexos: identidade própria de cada unidade vinculada; endereço vem da versão dela na data.
  const links = at ? linksAt(input.links ?? [], c.schoolId, at) : [];
  const annexParts = links.map((l) => {
    const u = input.schools.find((s) => s.schoolId === l.linkedSchoolId);
    const v = u ? schoolVersionAt(u, at!) : null;
    return { l, v, text: v ? `${v.officialName}${v.address ? ` — ${v.address}` : " — endereço não registrado"} (${l.linkKindId})` : `Unidade ${l.linkedSchoolId} sem versão cadastral na data (${l.linkKindId})` };
  });
  cells.push(base({
    cellId: "anexos", sectionId: "identificacao", label: "Anexos e seus endereços", origin: "automatico",
    state: !at ? "indeterminado" : annexParts.length ? "disponivel" : "ausente",
    value: annexParts.length ? annexParts.map((p) => p.text).join("; ") : null, reference: at ? { at } : null,
    source: "institutional_school_links",
    recordRefs: annexParts.flatMap((p) => [`institutional_school_links:${p.l.id}@${p.l.version}`, ...(p.v ? [`institutional_school_record_versions:${p.v.id}@${p.v.versionNumber}`] : [])]),
    notes: !at ? ["Sem data de fotografia."] : annexParts.length ? [] : ["Nenhum vínculo com unidade anexa vigente na data."],
  }));

  // Direção: atuação vigente de tipo homologado declarado pela regra; nunca por cargo.
  const kinds = applicable?.definition.schoolLeadershipEngagementKindIds ?? [];
  const lead = (input.leadership ?? []).filter((e) => kinds.includes(e.engagementKindId));
  const leadState: CellState = !at ? "indeterminado" : !kinds.length ? "sem-regra" : input.leadership == null ? "indeterminado" : lead.length === 0 ? "ausente" : lead.length === 1 ? "disponivel" : "indeterminado";
  cells.push(base({
    cellId: "direcao", sectionId: "identificacao", label: "Direção", origin: "automatico", state: leadState,
    value: leadState === "disponivel" ? lead[0]!.personName : null, reference: at ? { at } : null, source: "institutional_engagements",
    recordRefs: lead.map((e) => `institutional_engagements:${e.engagementId}`).sort(),
    ruleRef: kinds.length && applicable ? `${applicable.id}@${applicable.version}` : null,
    notes: leadState === "sem-regra" ? ["A regra da competência não declara qual tipo de atuação representa a direção."]
      : leadState === "ausente" ? ["Nenhuma atuação de direção válida na escola na data."]
      : leadState === "indeterminado" && lead.length > 1 ? [`${lead.length} atuações simultâneas; a configuração não determina qual exibir.`]
      : leadState === "disponivel" ? [`Atuação ${lead[0]!.engagementKindId} desde ${lead[0]!.validFrom}${lead[0]!.originatingActRef ? ` (ato ${lead[0]!.originatingActRef})` : ""}.`] : [],
  }));

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

  // A — pessoal: projeção do registro funcional na data/janela da competência (14.12).
  const fr = input.functional;
  if (!at || !fr) {
    for (const [cellId, label] of [["lotacao", "Lotação e vínculo funcional"], ["alteracoes-pessoal", "Alterações funcionais"]] as const)
      cells.push(base({ cellId, sectionId: "pessoal", label, origin: "automatico", state: "indeterminado", source: "professional_postings",
        notes: [!at ? "Sem data de fotografia." : "Registro funcional não pôde ser lido."] }));
  } else {
    const pa = postingsAt(fr.postings, fr.links, c.schoolId, at);
    const line = (p: PostingRow) => { const l = [...fr.links].filter((x) => x.logical_id === p.functional_link_logical_id).sort((a, b) => b.version - a.version)[0];
      return `${l?.functional_registration ?? "matrícula não registrada"} — ${p.function_id ?? "função não registrada"}${p.functional_status_id ? ` (${p.functional_status_id})` : ""}`; };
    cells.push(base({
      cellId: "lotacao", sectionId: "pessoal", label: "Lotação e vínculo funcional", origin: "automatico",
      state: pa.conflicts.length ? "indeterminado" : pa.valid.length ? "disponivel" : pa.undated.length ? "indeterminado" : "ausente",
      value: pa.conflicts.length || !pa.valid.length ? null : pa.valid.map(line).sort().join("; "), reference: { at }, source: "professional_postings + professional_functional_links",
      recordRefs: pa.valid.map((p) => `professional_postings:${p.id}@${p.version}`).sort(),
      notes: [
        ...(pa.conflicts.length ? [`Conflito: vínculo(s) ${pa.conflicts.join(", ")} com mais de uma lotação vigente na escola na data.`] : []),
        ...(pa.undated.length ? [`${pa.undated.length} lotação(ões) sem data de início registrada.`] : []),
        ...(!pa.valid.length && !pa.undated.length && !pa.conflicts.length ? ["Nenhuma lotação vigente na escola na data."] : []),
      ],
    }));
    const ev = functionalEventsIn(fr.events, c.schoolId, window.from, window.to);
    cells.push(base({
      cellId: "alteracoes-pessoal", sectionId: "pessoal", label: "Alterações funcionais", origin: "automatico",
      state: ev.inWindow.length ? "disponivel" : ev.undated.length ? "indeterminado" : "ausente",
      value: ev.inWindow.length ? ev.inWindow.map((e) => `${e.occurred_on} — ${e.event_kind_id}`).sort().join("; ") : null,
      reference: { from: window.from, to: window.to }, source: "professional_functional_events",
      recordRefs: ev.inWindow.map((e) => `professional_functional_events:${e.id}@${e.version}`).sort(),
      notes: ev.undated.length ? [`${ev.undated.length} alteração(ões) sem data registrada.`] : ev.inWindow.length ? [] : ["Nenhuma alteração funcional registrada na competência."],
    }));
  }

  // A — visitas: projeção do Registro Institucional de Visitas na janela da competência (14.13).
  // Sem limite de quantidade: limite de layout do documento é apresentação, não domínio.
  if (!input.visits) {
    cells.push(base({ cellId: "visitas", sectionId: "visitas", label: "Visitas recebidas", origin: "automatico", state: "indeterminado",
      source: "institutional_visit_records", notes: ["Registro Institucional de Visitas não pôde ser lido."] }));
  } else {
    const vs = visitsIn(input.visits, c.schoolId, window.from, window.to);
    cells.push(base({
      cellId: "visitas", sectionId: "visitas", label: "Visitas recebidas", origin: "automatico",
      state: vs.length ? "disponivel" : "ausente",
      value: vs.length ? vs.map((v) => `${v.visited_on} — ${v.visitor_kind_id}`).join("; ") : null,
      reference: { from: window.from, to: window.to }, source: "institutional_visit_records",
      recordRefs: vs.map((v) => `institutional_visit_records:${v.id}@${v.version}`),
      notes: vs.length ? [] : ["Nenhuma visita registrada na competência."],
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

  // T — herança travada do mês anterior.
  cells.push(previousMonthCell(applicable, input.previousOfficial));

  // T — regentes: só atribuição docente real (B4.8) na data; lotação nunca cria regência.
  if (!at || input.teaching == null) {
    cells.push(base({ cellId: "regentes", sectionId: "pessoal", label: "Professores regentes", origin: "automatico", state: "indeterminado", source: "teaching_assignments_at",
      notes: [!at ? "Sem data de fotografia." : "Atribuições docentes não puderam ser lidas."] }));
  } else {
    const vig = input.teaching.filter((t) => t.state === "vigente");
    const name = (id: string) => input.classes.find((k) => k.id === id)?.name ?? id;
    cells.push(base({
      cellId: "regentes", sectionId: "pessoal", label: "Professores regentes", origin: "automatico", state: vig.length ? "disponivel" : "ausente",
      value: vig.length ? vig.map((t) => `${name(t.classId)} — ${t.componentLabel ?? "componente não registrado"}`).sort().join("; ") : null,
      reference: { at }, source: "teaching_assignments_at", recordRefs: vig.map((t) => `teaching_assignment_versions:${t.versionId}@${t.version}`).sort(),
      notes: vig.length ? [] : ["Nenhuma atribuição docente vigente na data. Lotação não é regência."],
    }));
  }

  // D — fonte institucional ausente: exibida, nunca editável.
  for (const f of MISSING_SOURCE_FIELDS)
    cells.push(base({ cellId: f.cellId, sectionId: f.sectionId, label: f.label, origin: "sem-fonte", state: "sem-fonte", source: f.owner, notes: ["Informação ainda sem fonte institucional no SIGEM."] }));

  return {
    schemaVersion: 1,
    yearState: input.yearState ?? null,
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

// ---------------- Oficialização: só a remontagem do servidor tem autoridade ----------------

export type OfficializationCheck = { ok: true; snapshot: MapSnapshot; fingerprint: string } | { ok: false; code: "sem-conferencia" | "divergente-da-conferencia" | "divergente-do-visto" | "fontes-com-falha" | "bloqueada"; detail: string };

/**
 * Recebe SEMPRE a fotografia remontada no servidor. A marca esperada pelo cliente é só um
 * guarda de "o que eu vi"; nunca fornece valores. Qualquer divergência recusa tudo.
 */
export function verifyOfficialization(p: {
  rebuilt: MapSnapshot; rule: MapCompetenceRule | null; conferredFingerprint: string | null;
  clientExpectedFingerprint: string; failedSources: readonly string[];
}): OfficializationCheck {
  if (!p.conferredFingerprint) return { ok: false, code: "sem-conferencia", detail: "É preciso conferir a fotografia antes de oficializar." };
  if (p.failedSources.length) return { ok: false, code: "fontes-com-falha", detail: "Algumas fontes não puderam ser lidas; a oficialização foi recusada." };
  const fp = snapshotFingerprint(p.rebuilt);
  if (fp !== p.conferredFingerprint) return { ok: false, code: "divergente-da-conferencia", detail: "Algum dado mudou depois da conferência. Confira novamente." };
  if (fp !== p.clientExpectedFingerprint) return { ok: false, code: "divergente-do-visto", detail: "A fotografia na tela não é a atual. Recarregue e confira novamente." };
  const blocks = officializationBlocks(p.rebuilt, p.rule);
  if (blocks.length) return { ok: false, code: "bloqueada", detail: blocks.map((b) => b.detail).join(" ") };
  return { ok: true, snapshot: p.rebuilt, fingerprint: fp };
}

// ---------------- Admissibilidade e situação ----------------

export type OfficializationBlock = { code: "sem-regra-homologada" | "sem-data-de-fotografia" | "ano-nao-operacional" | "celula-exigida-nao-determinada"; detail: string };

/** O que bloqueia vem só da regra homologada; ausência de dado não bloqueia por si. */
export function officializationBlocks(s: MapSnapshot, rule: MapCompetenceRule | null): OfficializationBlock[] {
  if (!s.rule || !rule) return [{ code: "sem-regra-homologada", detail: "A competência aguarda regra homologada que cubra esta escola neste mês." }];
  if (s.yearState !== "operacional") return [{ code: "ano-nao-operacional", detail: s.yearState === "historico-importado" ? "Ano histórico (baseline censitário): não há Mapa operacional." : "O ano letivo desta competência ainda não está operacional." }];
  if (!s.snapshotDate) return [{ code: "sem-data-de-fotografia", detail: "A regra não determina a data da fotografia desta competência." }];
  return rule.definition.blockingCellIds
    .map((id) => s.cells.find((c) => c.cellId === id))
    .filter((c): c is MapCell => !!c && c.state !== "disponivel")
    .map((c) => ({ code: "celula-exigida-nao-determinada" as const, detail: `${c.label}: exigida pela regra e sem valor determinado.` }));
}

export type MapEvent = {
  id: string; kind: "observacoes" | "conferencia" | "abertura-correcao"; fingerprint: string | null; recordedAt: string;
  payload: { text?: string; reason?: string; baseVersionId?: string }; personId?: string | null;
};

/**
 * Correção aberta formalmente sobre a versão oficial vigente e ainda não consumida.
 * A abertura nunca altera a versão vigente; se abandonada, o Mapa oficial permanece.
 */
export function openMapCorrection(events: readonly MapEvent[], versions: readonly (MapVersionRow & { correctionEventId?: string | null })[]): MapEvent | null {
  const current = versions.find((v) => !versions.some((w) => w.supersedesId === v.id));
  if (!current) return null;
  const used = new Set(versions.map((v) => v.correctionEventId).filter(Boolean));
  return [...events].filter((e) => e.kind === "abertura-correcao" && e.payload.baseVersionId === current.id && !used.has(e.id))
    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0] ?? null;
}

/** Segregação por PESSOA: quem conferiu a versão não a oficializa, qualquer que seja a atuação. */
export function segregationBlocks(conferencePersonId: string | null | undefined, officializerPersonId: string | null | undefined): boolean {
  return !conferencePersonId || !officializerPersonId || conferencePersonId === officializerPersonId;
}
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
  const corr = current ? openMapCorrection(events, versions) : null;
  if (last && last.kind === "conferencia" && last.fingerprint && !used.has(last.id) && (!current || (corr && last.recordedAt > corr.recordedAt)))
    return { id: "conferido", conferenceEventId: last.id, fingerprint: last.fingerprint, ...(current ? { correctionInProgress: true } : {}) };
  if (current) {
    return { id: "oficializado", currentVersionId: current.id, version: current.version, corrected: current.version > 1, ...(corr ? { correctionInProgress: true } : {}) };
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
