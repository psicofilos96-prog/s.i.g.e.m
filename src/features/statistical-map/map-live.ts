/**
 * Mapa VIVO: projeção pura dos registros da escola (turmas, enturmações, entradas/saídas,
 * atuações docentes, quadro de pessoal e visitas) para o documento oficial I–VI.
 * Nada é gravado; ausência é "—" e cada pessoa aparece uma vez por categoria.
 */
import { buildFromDeclared, type MovementRow, type OfficialMapDoc, type PersonRow, type VisitRow } from "./map-official-model";

export type LiveClass = { class_id: string; class_name: string | null; stage_label: string | null; shift_label: string | null; students: number | null };
export type LiveMovement = { grp: string; student_name: string | null; census_id: string | null; kind: string | null; happened_on: string | null; class_label: string | null };
export type LiveStaff = { source: string; person_key: string; full_name: string | null; registration: string | null; cargo: string | null; funcao: string | null; grupo: string | null; situacao: string | null; classes: string | null; observacao: string | null };
export type LiveVisit = { visitor_kind_id: string | null; declared_identification: string | null; visited_on: string };
export type LiveMapData = {
  schoolName: string; inep: string | null; year: number; month: number; referenceDate: string;
  identification: Record<string, string | null>;
  classes: LiveClass[]; previousTotal: number | null; movements: LiveMovement[]; staff: LiveStaff[]; visits: LiveVisit[];
  failed: string[];
};

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const t = (s: unknown) => (s === null || s === undefined || String(s).trim() === "" ? "—" : String(s).trim());
const br = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

export function modalityOf(stage: string | null): string {
  const s = norm(stage);
  if (/BERCAR|MATERNAL|CRECHE|PERIODO|PRE.?ESC|INFANTIL/.test(s)) return "Educação Infantil";
  if (/EJA|FASE|ADULTO/.test(s)) return "EJA";
  const a = /\b([1-9])\s*[º°O]?\s*ANO\b/.exec(s);
  if (a) return Number(a[1]) <= 5 ? "Ensino Fundamental 1" : "Ensino Fundamental 2";
  return "Modalidade não informada";
}
export function shiftKey(label: string | null): "turno1" | "turno2" | "turno3" | "integral" | null {
  const s = norm(label);
  if (/INTEGR/.test(s)) return "integral";
  if (/MANH|MATUT|1/.test(s)) return "turno1";
  if (/TARD|VESP|2/.test(s)) return "turno2";
  if (/NOIT|NOTUR|3/.test(s)) return "turno3";
  return null;
}

/** Categoria A–K pelo padrão do sistema (situação prevalece sobre função). */
export function staffCategory(p: Pick<LiveStaff, "source" | "funcao" | "grupo" | "situacao" | "cargo">): string {
  const sit = norm(p.situacao); const f = norm(`${p.funcao ?? ""} ${p.grupo ?? ""}`); const all = `${f} ${norm(p.cargo)}`;
  if (/LICEN|AFAST/.test(sit)) return "G";
  if (/REMANEJ/.test(sit)) return "H";
  if (/FERIAS/.test(sit)) return "I";
  if (/EXONER|APOSENT|FALEC|DESLIG/.test(sit)) return "J";
  if (/CEDID|PERMUT/.test(sit)) return "K";
  if (/MEDIADOR|CUIDADOR/.test(f)) return "E";
  if (/DIRET|DIRIGENTE|ORIENTADOR|\bOP\b|SECRETAR|COORDENADOR|AGENTE ADMIN|AUXILIAR ADMIN|AUX\. DE SECRET|AUXILIAR DE SECRET|TECNICO-ADMIN/.test(f)) return "A";
  if (/ESPECIAL|INTEGRAL|OFICINEIR|PROJETO|AEE/.test(all)) return p.source === "atuacao" || /PROF|OFICINEIR/.test(all) ? "D" : "F";
  if (p.source === "atuacao" || /PROFESSOR|REGENTE|DOCENTE/.test(f)) {
    if (/MATEMAT|PORTUG|HIST|GEOGR|CIENC|ARTE|EDUCACAO FISICA|ED\. FISICA|INGL|ESTRANG|RELIGI|6º|7º|8º|9º|6 ANO|7 ANO|8 ANO|9 ANO|6O ANO|7O ANO|8O ANO|9O ANO/.test(all)) return "C";
    return "B";
  }
  return "F";
}

function personCells(cat: string, p: LiveStaff): string[] {
  const obs = t(p.observacao === null ? null : p.observacao);
  if (["G", "H", "I", "J", "K"].includes(cat)) return [t(p.full_name), t(p.registration), t(p.cargo), cat === "I" ? t(p.funcao) : t(p.situacao), "—", obs];
  if (["A", "F"].includes(cat)) return [t(p.full_name), t(p.registration), t(p.cargo), t(p.funcao), "—", "—", obs];
  return [t(p.full_name), t(p.registration), t(p.cargo), t(p.funcao), t(p.classes), "—", "—", obs];
}

/** Uma linha por pessoa: quem tem atuação docente real no SIGEM não se repete pelo quadro. */
export function peopleRows(staff: readonly LiveStaff[]): PersonRow[] {
  const teachers = new Set(staff.filter((s) => s.source === "atuacao").map((s) => norm(s.full_name)));
  const seen = new Set<string>();
  const rows: (PersonRow & { name: string })[] = [];
  for (const s of staff) {
    const cat = staffCategory(s);
    const n = norm(s.full_name);
    if (s.source !== "atuacao" && teachers.has(n) && !["G", "H", "I", "J", "K"].includes(cat)) continue;
    const key = `${cat}|${n}`;
    if (!n || seen.has(key)) continue;
    seen.add(key);
    rows.push({ category: cat, cells: personCells(cat, s), name: n });
  }
  return rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map(({ category, cells }) => ({ category, cells }));
}

export function movementRows(ms: readonly LiveMovement[]): MovementRow[] {
  return ms.filter((m) => ["A", "B", "C", "D"].includes(m.grp)).map((m) => ({
    group: m.grp as MovementRow["group"],
    cells: m.grp === "A" ? [t(m.student_name), t(m.census_id), t(m.kind), br(m.happened_on), t(m.class_label), "—"] : [t(m.student_name), t(m.census_id), br(m.happened_on), t(m.class_label), t(m.kind)],
  }));
}

const VISITOR: Record<string, string> = { supervisao: "Supervisão Escolar", "supervisor-escolar": "Supervisão Escolar", "orientacao-pedagogica": "Orientação Pedagógica", nei: "NEI", ciece: "CIECE" };
export function visitRows(vs: readonly LiveVisit[]): VisitRow[] {
  const by = new Map<string, VisitRow>();
  for (const v of [...vs].sort((a, b) => a.visited_on.localeCompare(b.visited_on))) {
    const cargo = VISITOR[v.visitor_kind_id ?? ""] ?? t(v.visitor_kind_id?.replace(/-/g, " "));
    const k = `${cargo}|${norm(v.declared_identification)}`;
    const r = by.get(k) ?? { cargo, nome: t(v.declared_identification), datas: [] };
    if (r.datas.length < 5) r.datas.push(br(v.visited_on));
    by.set(k, r);
  }
  return [...by.values()];
}

export function buildLiveDoc(d: LiveMapData, o: { headerLines: readonly string[]; signatures: readonly string[]; generatedAt: string }): OfficialMapDoc {
  const classes = d.classes.map((c) => {
    const k = shiftKey(c.shift_label); const n = c.students;
    return { modalidade: modalityOf(c.stage_label), etapa: c.stage_label, turma: c.class_name, alunos: n, turno1: k === "turno1" ? n : null, turno2: k === "turno2" ? n : null, turno3: k === "turno3" ? n : null, integral: k === "integral" ? n : null };
  }).sort((a, b) => (a.modalidade ?? "").localeCompare(b.modalidade ?? "") || (a.etapa ?? "").localeCompare(b.etapa ?? "", "pt-BR", { numeric: true }) || (a.turma ?? "").localeCompare(b.turma ?? "", "pt-BR", { numeric: true }));
  const sum = (k: "turno1" | "turno2" | "turno3" | "integral") => { const v = classes.map((c) => c[k]).filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const total = classes.length ? classes.reduce((a, c) => a + (c.alunos ?? 0), 0) : null;
  const cnt = (g: string) => d.movements.filter((m) => m.grp === g).length;
  const integral = sum("integral");
  const doc = buildFromDeclared({
    headerLines: o.headerLines, schoolName: d.schoolName, inep: d.inep, year: d.year, month: d.month, identification: d.identification,
    movement: { previous_month_enrollment: d.previousTotal, transfers_in: null, new_students: cnt("A"), transfers_out: cnt("B"), dropouts: cnt("C"), withdrawn_cancelled: cnt("D"), total_ii: total, declared_classes: classes.length || null },
    shifts: { turno1: sum("turno1"), turno2: sum("turno2"), turno3: sum("turno3"), integral, parcial: total !== null ? total - (integral ?? 0) : null, total },
    classes, projects: [], movements: movementRows(d.movements), people: peopleRows(d.staff), visits: visitRows(d.visits),
    signatures: o.signatures, generatedAt: o.generatedAt,
  });
  return { ...doc, statusTag: `Mapa do SIGEM · registros até ${br(d.referenceDate)}`, footerNote: "Montado a partir dos registros da escola no SIGEM. Assinaturas manuais." };
}
