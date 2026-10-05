/**
 * Frente E — reconciliação de jornadas profissionais (puro, sem gravação).
 * A fonte de jornada só REFERENCIA fatos canônicos (pessoa, vínculo, escola, turma); nunca os cria.
 * Jornada ≠ grade ≠ carga contratual ≠ lotação ≠ atuação ≠ regência. Nenhuma norma de carga é
 * aplicada: carga declarada vs. contratual só gera evidência quando ambas existem.
 */
export type ScheduleSourceRow = {
  locator: string;
  personKey: string | null; // fingerprint produzido no pipeline seguro; nunca CPF/matrícula em claro
  linkKey: string | null;
  schoolInep: string | null;
  classExternalId: string | null;
  weekday: number | null; // 1..7
  start: string | null; // HH:MM
  end: string | null;
  declaredWeeklyMinutes: number | null;
};

export type CanonicalRefs = {
  persons: ReadonlySet<string>;
  links: ReadonlyMap<string, { personKey: string; contractualWeeklyMinutes: number | null; schoolIneps: readonly string[] }>;
  schools: ReadonlySet<string>;
  classes: ReadonlyMap<string, string>; // external id → INEP
};

export type EvidenceCode =
  | "pessoa-sem-correspondencia" | "vinculo-sem-correspondencia" | "vinculo-de-outra-pessoa"
  | "escola-sem-correspondencia" | "turma-sem-correspondencia" | "turma-de-outra-escola"
  | "vinculo-sem-lotacao-na-escola" | "horario-incompleto" | "horario-invalido"
  | "sobreposicao" | "carga-divergente-da-contratual" | "fontes-divergentes";

export type Evidence = { locator: string; code: EvidenceCode; ref?: string | undefined };

export type SlotStatus = "confirmado" | "divergente" | "incompleto" | "sem-correspondencia";

export type StagedSlot = {
  locator: string; personKey: string; linkKey: string; schoolId: string; classId: string | null;
  weekday: number; start: string; end: string; status: SlotStatus;
};

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const mask = (k: string | null) => (k ? k.slice(0, 8) : undefined);

export function stageProfessionalSchedules(rows: ScheduleSourceRow[], refs: CanonicalRefs) {
  const evidence: Evidence[] = [];
  const slots: StagedSlot[] = [];
  const rowStatus = new Map<string, SlotStatus>();
  for (const r of rows) {
    const flag = (code: EvidenceCode, ref?: string) => evidence.push({ locator: r.locator, code, ref });
    if (!r.personKey || !refs.persons.has(r.personKey)) { flag("pessoa-sem-correspondencia", mask(r.personKey)); rowStatus.set(r.locator, "sem-correspondencia"); continue; }
    const link = r.linkKey ? refs.links.get(r.linkKey) : undefined;
    if (!link) { flag("vinculo-sem-correspondencia", mask(r.linkKey)); rowStatus.set(r.locator, "sem-correspondencia"); continue; }
    if (link.personKey !== r.personKey) { flag("vinculo-de-outra-pessoa", mask(r.linkKey)); rowStatus.set(r.locator, "sem-correspondencia"); continue; }
    if (!r.schoolInep || !refs.schools.has(r.schoolInep)) { flag("escola-sem-correspondencia"); rowStatus.set(r.locator, "sem-correspondencia"); continue; }
    let classId: string | null = null;
    if (r.classExternalId) {
      const inep = refs.classes.get(r.classExternalId);
      if (!inep) { flag("turma-sem-correspondencia"); rowStatus.set(r.locator, "sem-correspondencia"); continue; }
      if (inep !== r.schoolInep) { flag("turma-de-outra-escola"); rowStatus.set(r.locator, "sem-correspondencia"); continue; }
      classId = r.classExternalId;
    }
    let status: SlotStatus = "confirmado";
    if (!link.schoolIneps.includes(r.schoolInep)) { flag("vinculo-sem-lotacao-na-escola", mask(r.linkKey)); status = "divergente"; }
    if (r.weekday == null || !r.start || !r.end) { flag("horario-incompleto"); rowStatus.set(r.locator, "incompleto"); continue; }
    if (r.weekday < 1 || r.weekday > 7 || !HM.test(r.start) || !HM.test(r.end) || mins(r.end) <= mins(r.start)) { flag("horario-invalido"); rowStatus.set(r.locator, "incompleto"); continue; }
    slots.push({ locator: r.locator, personKey: r.personKey, linkKey: r.linkKey!, schoolId: `inep-${r.schoolInep}`, classId, weekday: r.weekday, start: r.start, end: r.end, status });
    rowStatus.set(r.locator, status);
  }
  // Sobreposição por PESSOA (não por vínculo): a mesma pessoa não está em dois lugares.
  const byPerson = new Map<string, StagedSlot[]>();
  for (const s of slots) (byPerson.get(s.personKey) ?? byPerson.set(s.personKey, []).get(s.personKey)!).push(s);
  for (const list of byPerson.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!, b = list[j]!;
      if (a.weekday === b.weekday && mins(a.start) < mins(b.end) && mins(b.start) < mins(a.end)) {
        for (const s of [a, b]) { s.status = "divergente"; rowStatus.set(s.locator, "divergente"); evidence.push({ locator: s.locator, code: "sobreposicao" }); }
      }
    }
  }
  // Carga: só compara quando a fonte declara e o vínculo tem carga contratual; nenhuma faixa aceitável é presumida.
  const declared = new Map<string, number>();
  for (const r of rows) if (r.linkKey && r.declaredWeeklyMinutes != null) declared.set(r.linkKey, r.declaredWeeklyMinutes);
  for (const [lk, d] of declared) {
    const c = refs.links.get(lk)?.contractualWeeklyMinutes;
    if (c != null && c !== d) evidence.push({ locator: `vinculo:${mask(lk)}`, code: "carga-divergente-da-contratual" });
  }
  const totals: Record<string, Record<SlotStatus, number>> = {};
  for (const r of rows) {
    const k = r.schoolInep ?? "não informado";
    const t = (totals[k] ??= { confirmado: 0, divergente: 0, incompleto: 0, "sem-correspondencia": 0 });
    t[rowStatus.get(r.locator) ?? "sem-correspondencia"]++;
  }
  return { slots, evidence, totalsBySchool: totals };
}

/** Duas fontes para o mesmo vínculo/dia: diferença vira evidência, nunca escolha. */
export function compareScheduleSources(a: StagedSlot[], b: StagedSlot[]): Evidence[] {
  const key = (s: StagedSlot) => `${s.linkKey}|${s.weekday}`;
  const sig = (l: StagedSlot[]) => l.map((s) => `${s.start}-${s.end}@${s.schoolId}`).sort().join(",");
  const group = (l: StagedSlot[]) => { const m = new Map<string, StagedSlot[]>(); for (const s of l) (m.get(key(s)) ?? m.set(key(s), []).get(key(s))!).push(s); return m; };
  const ga = group(a), gb = group(b);
  const out: Evidence[] = [];
  for (const k of new Set([...ga.keys(), ...gb.keys()])) {
    if (sig(ga.get(k) ?? []) !== sig(gb.get(k) ?? [])) out.push({ locator: `dia:${k.split("|")[1]}`, code: "fontes-divergentes", ref: mask(k) });
  }
  return out;
}
