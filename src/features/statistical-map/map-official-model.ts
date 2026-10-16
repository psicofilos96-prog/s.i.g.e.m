/**
 * Modelo do DOCUMENTO OFICIAL do Mapa Estatístico (seções I–VI fiéis ao modelo da rede).
 * Só reorganiza números já lidos: ausência é "—" (nunca zero), subtotais somam apenas linhas lidas
 * e não há estado técnico (Indeterminado, Origem, regra) — isso fica na Conferência.
 */
import { MONTH_NAMES_LOWER } from "@/lib/format-ptbr";
import type { MapCell, MapSnapshot } from "./map-domain";
import { groupByStructure } from "./map-structures";

export const MISSING = "—";
export type Col = { label: string; w: number; align?: "left" | "center" | "right" | undefined };
export type Row = { cells: string[]; style?: "sub" | "total" | undefined };
export type Block =
  | { kind: "fields"; pairs: [string, string][] }
  | { kind: "table"; caption?: string | undefined; subtitle?: string | undefined; groups?: { label: string; span: number }[] | undefined; cols: Col[]; rows: Row[]; empty?: string | undefined }
  | { kind: "note"; text: string };
export type Section = { id: string; title: string; blocks: Block[] };
export type OfficialMapDoc = {
  headerLines: string[]; schoolName: string; competence: string; statusTag: string;
  sections: Section[]; observations: string; signatures: string[]; generatedAt: string; footerNote: string;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const show = (v: number | null | undefined) => (v === null || v === undefined ? MISSING : v.toLocaleString("pt-BR"));
const txt = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? MISSING : String(v).trim());
export function sumKnown(vs: readonly (number | null)[]): number | null { const k = vs.filter((x): x is number => x !== null); return k.length ? k.reduce((a, b) => a + b, 0) : null; }
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const EMPTY_LIST = "Sem registro nominal nesta competência.";

/** Colunas da movimentação estatística, como no modelo da rede. */
export const ETAPA_COLS = ["Creche", "Pré-esc.", "1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano", "7º ano", "8º ano", "9º ano", "EJA I", "EJA II a V", "EJA VI a IX"] as const;
/** Coluna da etapa declarada; null quando não se reconhece (não é presumida). */
export function etapaColumn(etapa: unknown, modalidade?: unknown): number | null {
  const e = norm(etapa); const m = norm(modalidade);
  if (/BERCAR|MATERNAL|CRECHE/.test(e)) return 0;
  if (/PERIODO|PRE.?ESC/.test(e)) return 1;
  const fase = /FASE\s+([IVX]+)\b/.exec(e);
  if (fase || /EJA|ADULTO/.test(m)) {
    const r = fase?.[1]; if (!r) return null;
    const n = ({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 } as Record<string, number>)[r];
    return n === undefined ? null : n === 1 ? 11 : n <= 5 ? 12 : 13;
  }
  const ano = /\b([1-9])\s*[º°O]?\s*ANO\b/.exec(e);
  return ano ? 1 + Number(ano[1]) : null;
}

const mod = (cols: Col[]) => cols;
const PEOPLE: { id: string; title: string; subtitle?: string; cols: Col[] }[] = [
  { id: "A", title: "Pessoal técnico-administrativo", subtitle: "Diretor, diretor adjunto, OP, secretário, aux. de secretaria, coordenador de turno, outros", cols: mod([{ label: "Nº", w: 4, align: "center" }, { label: "Nome", w: 22 }, { label: "Matrícula e QP/MEC", w: 12 }, { label: "Cargo", w: 13 }, { label: "Função", w: 13 }, { label: "Turno", w: 7, align: "center" }, { label: "Adicionais", w: 8, align: "center" }, { label: "Observações", w: 21 }]) },
  { id: "B", title: "Professores regentes", subtitle: "Educação Infantil, Ensino Fundamental e EJA: 1º segmento", cols: [] },
  { id: "C", title: "Professores regentes", subtitle: "Ens. Fund. 2 e EJA: Português, Matemática, História e Geografia, Ciências, Arte, Ed. Física, Língua Estrangeira, Ensino Religioso", cols: [] },
  { id: "D", title: "Professores regentes", subtitle: "Ed. Especial, Ed. Integral, Projetos", cols: [] },
  { id: "E", title: "Mediador escolar", subtitle: "Ordem alfabética", cols: [] },
  { id: "F", title: "Pessoal de apoio", subtitle: "Ordem alfabética", cols: [] },
  { id: "G", title: "Pessoal licenciado", subtitle: "Ordem alfabética", cols: [{ label: "Nº", w: 4, align: "center" }, { label: "Nome", w: 24 }, { label: "Matrícula e QP/MEC", w: 13 }, { label: "Cargo", w: 14 }, { label: "Cód. de afastamento", w: 12 }, { label: "Período", w: 12 }, { label: "Observações", w: 21 }] },
  { id: "H", title: "Pessoal remanejado", subtitle: "Ordem alfabética", cols: [{ label: "Nº", w: 4, align: "center" }, { label: "Nome", w: 24 }, { label: "Matrícula e QP/MEC", w: 13 }, { label: "Cargo", w: 14 }, { label: "Data do remanejamento", w: 12 }, { label: "Local", w: 12 }, { label: "Observações", w: 21 }] },
  { id: "I", title: "Pessoal em férias", subtitle: "Ordem alfabética", cols: [{ label: "Nº", w: 4, align: "center" }, { label: "Nome", w: 24 }, { label: "Matrícula e QP/MEC", w: 13 }, { label: "Cargo", w: 14 }, { label: "Função", w: 12 }, { label: "Período", w: 12 }, { label: "Observações", w: 21 }] },
  { id: "J", title: "Pessoal exonerado", subtitle: "Pessoal exonerado, aposentado e falecido", cols: [{ label: "Nº", w: 4, align: "center" }, { label: "Nome", w: 24 }, { label: "Matrícula e QP/MEC", w: 13 }, { label: "Cargo", w: 14 }, { label: "Função", w: 12 }, { label: "Data", w: 12 }, { label: "Observações", w: 21 }] },
  { id: "K", title: "Pessoal cedido / permuta", subtitle: "Ordem alfabética", cols: [{ label: "Nº", w: 4, align: "center" }, { label: "Nome", w: 24 }, { label: "Matrícula e QP/MEC", w: 13 }, { label: "Cargo", w: 14 }, { label: "Data da permuta", w: 12 }, { label: "Local", w: 12 }, { label: "Observações", w: 21 }] },
];
const TEACH_COLS: Col[] = [{ label: "Nº", w: 4, align: "center" }, { label: "Nome", w: 20 }, { label: "Matrícula e QP/MEC", w: 11 }, { label: "Cargo", w: 12 }, { label: "Função", w: 12 }, { label: "Turma", w: 10 }, { label: "Turno", w: 6, align: "center" }, { label: "Adicionais", w: 7, align: "center" }, { label: "Observações", w: 18 }];
const SUPPORT_COLS: Col[] = PEOPLE[0]!.cols;
export const PEOPLE_CATEGORIES = PEOPLE.map((p) => ({ ...p, cols: p.cols.length ? p.cols : ["F"].includes(p.id) ? SUPPORT_COLS : TEACH_COLS }));

/** Pessoa já lida da fonte da escola, por categoria A–K. Uma linha por pessoa na categoria (não por vínculo). */
export type PersonRow = { category: string; cells: string[] };
export type MovementRow = { group: "A" | "B" | "C" | "D"; cells: string[] };
export type VisitRow = { cargo: string; nome: string; datas: string[] };

function sectionIV(rows: readonly MovementRow[]): Section {
  const base = (tipo: boolean): Col[] => [{ label: "Nº", w: 4, align: "center" }, { label: "Nome", w: 26 }, { label: "ID Censo", w: 11 }, ...(tipo ? [{ label: "Tipo", w: 10 } as Col] : []), { label: "Data", w: 9, align: "center" }, { label: "Escolaridade", w: 12 }, { label: "Observações", w: tipo ? 28 : 38 }];
  const g = [["A", "Alunos recebidos", true], ["B", "Alunos transferidos", false], ["C", "Alunos evadidos", false], ["D", "Matrículas desistentes / canceladas", false]] as const;
  return { id: "IV", title: "IV — Relação de Entrada e Saída de Alunos", blocks: g.map(([id, t, tipo]) => ({
    kind: "table" as const, caption: `${id} — ${t}`, cols: base(tipo), empty: EMPTY_LIST,
    rows: rows.filter((r) => r.group === id).map((r, i) => ({ cells: [String(i + 1), ...r.cells] })),
  })) };
}

function sectionV(people: readonly PersonRow[]): Section {
  return { id: "V", title: "V — Relação de Pessoal e/ou Alteração", blocks: [
    { kind: "note", text: "HE — Hora Extra · SE — Serviço Extra · AJT — Ampliação da Jornada de Trabalho · AD — Adicional Noturno" },
    ...PEOPLE_CATEGORIES.map((c) => ({ kind: "table" as const, caption: `${c.id} — ${c.title}`, subtitle: c.subtitle, cols: c.cols, empty: EMPTY_LIST,
      rows: people.filter((p) => p.category === c.id).map((p, i) => ({ cells: [String(i + 1), ...p.cells] })) })),
  ] };
}

function sectionVI(visits: readonly VisitRow[]): Section {
  const cols: Col[] = [{ label: "Cargo", w: 18 }, { label: "Nome", w: 27 }, ...["I", "II", "III", "IV", "V"].map((n) => ({ label: `Visita ${n}`, w: 11, align: "center" as const }))];
  return { id: "VI", title: "VI — Visitas Recebidas", blocks: [{ kind: "table", cols, empty: "Nenhuma visita registrada nesta competência.",
    rows: visits.map((v) => ({ cells: [txt(v.cargo), txt(v.nome), ...[0, 1, 2, 3, 4].map((i) => txt(v.datas[i]))] })) }] };
}

const SHIFTS = ["turno1", "turno2", "turno3", "integral"] as const;
type Line = { modalidade?: string | null; etapa?: string | null; turma?: string | null; alunos?: number | null; turno1?: number | null; turno2?: number | null; turno3?: number | null; integral?: number | null };
const placeholder = (l: Line) => !(num(l.alunos) ?? 0) && /^[\s\-–—.]*$/.test(l.turma ?? "");
const III_COLS: Col[] = [{ label: "Etapa / período / ano", w: 20 }, { label: "Nome da turma", w: 26 }, { label: "1º turno", w: 10, align: "right" }, { label: "2º turno", w: 10, align: "right" }, { label: "3º turno", w: 10, align: "right" }, { label: "Integral", w: 10, align: "right" }, { label: "Nº de alunos", w: 14, align: "right" }];

function classTable(lines: readonly Line[], caption: string, subtotal: string): { block: Block; totals: (number | null)[] } {
  const rows = lines.filter((l) => !placeholder(l));
  const totals = [...SHIFTS.map((k) => sumKnown(rows.map((r) => num(r[k])))), sumKnown(rows.map((r) => num(r.alunos)))];
  let last = "";
  const body: Row[] = rows.map((r) => { const e = txt(r.etapa); const shown = e === last ? "" : e; last = e;
    const t = txt(r.turma); return { cells: [shown, norm(t) === norm(e) ? MISSING : t, ...SHIFTS.map((k) => show(num(r[k]))), show(num(r.alunos))] }; });
  return { block: { kind: "table", caption, cols: III_COLS, rows: [...body, { cells: [subtotal, "", ...totals.map(show)], style: "sub" }], empty: "Nenhuma turma declarada." }, totals };
}

export type DeclaredSource = {
  headerLines: readonly string[]; schoolName: string; inep: string | null; year: number; month: number;
  identification?: Partial<Record<string, string | null>>;
  movement: { previous_month_enrollment: number | null; transfers_in: number | null; new_students: number | null; transfers_out: number | null; dropouts: number | null; withdrawn_cancelled: number | null; total_ii: number | null; declared_classes?: number | null };
  shifts: { turno1?: number | null; turno2?: number | null; turno3?: number | null; parcial?: number | null; integral?: number | null; total?: number | null } | null;
  classes: readonly Line[]; projects: readonly Line[];
  movements?: readonly MovementRow[]; people?: readonly PersonRow[]; visits?: readonly VisitRow[];
  signatures: readonly string[]; generatedAt: string; observations?: string;
};

export const IDENTIFICATION_FIELDS = ["Nome da escola", "Código INEP", "Endereço", "Distrito", "E-mail da escola", "Localização", "Turnos e horários", "Prédio", "Direção", "Difícil acesso", "Possui anexo", "Nº de salas de aula", "Endereço do anexo", "Telefone de contato"] as const;

function movementMatrix(src: DeclaredSource): Block[] {
  const m = src.movement;
  const valid = src.classes.filter((l) => !placeholder(l));
  const perCol = ETAPA_COLS.map((_, i) => valid.filter((l) => etapaColumn(l.etapa, l.modalidade) === i));
  const special = valid.filter((l) => /MULTISSERIAD|CORRECAO|ACELERA|TEC\b/.test(norm(l.turma) + " " + norm(l.modalidade)));
  const blank = ETAPA_COLS.map(() => MISSING);
  const line = (label: string, total: number | null, per?: string[]): Row => ({ cells: [label, ...(per ?? blank), show(total)] });
  const cols: Col[] = [{ label: "", w: 22 }, ...ETAPA_COLS.map((l) => ({ label: l, w: 5.4, align: "right" as const })), { label: "Total", w: 6.4, align: "right" }];
  const groups = [{ label: "", span: 1 }, { label: "Ed. Infantil", span: 2 }, { label: "Ensino Fundamental", span: 9 }, { label: "EJA", span: 3 }, { label: "", span: 1 }];
  const s = src.shifts ?? {};
  return [
    { kind: "table", groups, cols, rows: [
      line("Matrícula do mês anterior", m.previous_month_enrollment), line("Transferências recebidas", m.transfers_in), line("Alunos novos", m.new_students),
      line("Transferências expedidas", m.transfers_out), line("Evadidos", m.dropouts), line("Desistentes / cancelados", m.withdrawn_cancelled),
      { ...line("Total", m.total_ii, perCol.map((ls) => show(sumKnown(ls.map((l) => num(l.alunos)))))), style: "total" },
      line("Nº de turmas", m.declared_classes ?? null, perCol.map((ls) => (ls.length ? String(ls.length) : MISSING))),
      line("Turmas de AC, CF e Multi.", special.length ? new Set(special.map((l) => norm(l.turma))).size : null),
      line("Professor regente", null),
    ] },
    { kind: "note", text: "AC — Aceleração · CF — Correção de Fluxo · Multi — Multisseriada. Movimentação por ano/etapa sai quando a escola informa; sem informação, o campo fica com —." },
    { kind: "table", caption: "Total de alunos na escola por turno", cols: [{ label: "", w: 30 }, ...["1º turno", "2º turno", "3º turno", "Parcial", "Integral", "Total de alunos"].map((l) => ({ label: l, w: 11.6, align: "right" as const }))],
      rows: [{ cells: ["Total de alunos na escola", show(num(s.turno1)), show(num(s.turno2)), show(num(s.turno3)), show(num(s.parcial)), show(num(s.integral)), show(num(s.total))], style: "total" }] },
  ];
}

export function buildFromDeclared(src: DeclaredSource): OfficialMapDoc {
  const comp = `${MONTH_NAMES_LOWER[src.month - 1] ?? src.month}/${src.year}`;
  const id = { "Nome da escola": src.schoolName, "Código INEP": src.inep, ...src.identification };
  const byMod = new Map<string, Line[]>();
  for (const c of src.classes) { const k = txt(c.modalidade) === MISSING ? "Modalidade não informada" : txt(c.modalidade); byMod.set(k, [...(byMod.get(k) ?? []), c]); }
  const mods = [...byMod.entries()].map(([k, ls]) => classTable(ls, k, `Subtotal — ${k.toLowerCase()}`));
  const geral = [0, 1, 2, 3, 4].map((i) => sumKnown(mods.map((x) => x.totals[i] ?? null)));
  const proj = classTable(src.projects, "Projetos e atendimentos", "Total de alunos em projetos");
  return {
    headerLines: [...src.headerLines], schoolName: src.schoolName, competence: comp, statusTag: "Mapa declarado pela escola · referência 2026",
    sections: [
      { id: "I", title: "I — Identificação da Unidade", blocks: [{ kind: "fields", pairs: IDENTIFICATION_FIELDS.map((f) => [f, txt((id as Record<string, unknown>)[f])]) }] },
      { id: "II", title: "II — Movimentação Estatística", blocks: movementMatrix(src) },
      { id: "III", title: "III — Matrícula por Etapa / Turno", blocks: [
        ...(mods.length ? mods.map((x) => x.block) : [{ kind: "table" as const, cols: III_COLS, rows: [], empty: "Nenhuma turma declarada." }]),
        { kind: "table", caption: "Total de alunos na escola", cols: [{ label: "", w: 46 }, ...["1º turno", "2º turno", "3º turno", "Integral", "Nº de alunos"].map((l, i) => ({ label: l, w: i === 4 ? 14 : 10, align: "right" as const }))], rows: [{ cells: ["Soma das turmas acima", ...geral.map(show)], style: "total" }] },
        proj.block,
        { kind: "note", text: "Alunos em projetos e atendimentos complementares não entram no total geral, para não contar a mesma pessoa duas vezes." },
      ] },
      sectionIV(src.movements ?? []), sectionV(src.people ?? []), sectionVI(src.visits ?? []),
    ],
    observations: src.observations ?? "", signatures: [...src.signatures], generatedAt: src.generatedAt,
    footerNote: "Números como declarados pela escola. Assinaturas manuais.",
  };
}

/** Mapa calculado pelo SIGEM (fotografia). Célula sem valor sai como —; estados técnicos ficam na Conferência. */
export function buildFromSnapshot(s: MapSnapshot, o: { headerLines: readonly string[]; schoolName: string; official: boolean; revision: number | null; signatures: readonly string[]; generatedAt: string }): OfficialMapDoc {
  const comp = `${MONTH_NAMES_LOWER[s.competence.month - 1] ?? s.competence.month}/${s.competence.year}`;
  const val = (c: MapCell) => (c.state === "disponivel" && c.value !== null && c.value !== undefined ? `${typeof c.value === "number" ? c.value.toLocaleString("pt-BR") : String(c.value)}${c.unit ? ` ${c.unit}` : ""}` : MISSING);
  const g = new Map<string, readonly MapCell[]>(groupByStructure(s.cells).map((x) => [x.id, x.cells] as const));
  const indicator = (cells: readonly MapCell[], caption?: string): Block => ({ kind: "table", caption, cols: [{ label: "Indicador", w: 70 }, { label: "Quantidade", w: 30, align: "right" }], rows: cells.filter((c) => !c.groups?.length).map((c) => ({ cells: [c.label, val(c)] })), empty: "Sem dado apurado nesta competência." });
  const classCells = (g.get("III") ?? []).filter((c) => c.groups?.length);
  const classRows: Row[] = classCells.flatMap((c) => (c.groups ?? []).map((x) => ({ cells: [txt(x.key), show(num(Number(x.value)))] })));
  const names = (id: string) => (g.get(id) ?? []).filter((c) => !c.groups?.length);
  return {
    headerLines: [...o.headerLines], schoolName: o.schoolName, competence: comp,
    statusTag: o.official ? `Mapa aprovado · revisão ${o.revision ?? 1}` : "Rascunho · não oficial",
    sections: [
      { id: "I", title: "I — Identificação da Unidade", blocks: [{ kind: "fields", pairs: [["Nome da escola", o.schoolName], ["Competência", comp], ["Data de referência", txt(s.snapshotDate)], ...names("I").map((c) => [c.label, val(c)] as [string, string])] }] },
      { id: "II", title: "II — Movimentação Estatística", blocks: [indicator(names("II"))] },
      { id: "III", title: "III — Matrícula por Etapa / Turno", blocks: [indicator(names("III")), { kind: "table", caption: "Alunos por turma", cols: [{ label: "Turma", w: 70 }, { label: "Nº de alunos", w: 30, align: "right" }], rows: classRows, empty: "Sem turmas apuradas nesta competência." }] },
      { ...sectionIV([]), blocks: [indicator(names("IV"), "Resumo da competência"), ...sectionIV([]).blocks] },
      { ...sectionV([]), blocks: [indicator(names("V"), "Resumo da competência"), ...sectionV([]).blocks] },
      { ...sectionVI([]), blocks: [indicator(names("VI"), "Resumo da competência"), ...sectionVI([]).blocks] },
    ],
    observations: s.declarations.observations ?? "", signatures: [...o.signatures], generatedAt: o.generatedAt,
    footerNote: o.official ? "Fotografia aprovada desta competência. Assinaturas manuais." : "Fotografia dinâmica, não oficial. Assinaturas manuais.",
  };
}
