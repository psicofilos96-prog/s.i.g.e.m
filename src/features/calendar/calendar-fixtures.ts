/**
 * Fixture de REFERÊNCIA DE REPRODUÇÃO — Calendário Escolar 2027 (Regular e EJA),
 * transcrita da especificação da Supervisão de Ensino (seed §4.1 + §4.4).
 *
 * Serve para verificar que o motor reproduz exatamente o documento de
 * referência. Os calendários nascem em RASCUNHO, como na origem. Valores
 * específicos de 2027 (CC na sexta, ≥100 dias por semestre…) ficam na
 * `policy` DESTE calendário — não são regras universais do SIGEM.
 */
import type {
  CalendarEventEntry,
  CalendarPeriod,
  CalendarRange,
  CalendarValidationPolicy,
  DayTypeCode,
  InheritedHoliday,
  NetworkCalendar,
} from "./calendar-types";

const FIXTURE_NOTE =
  "Referência de reprodução do calendário 2027 fornecida pela Supervisão (especificação de 24/09/2026).";

export const SIGNATURES_2027 = [
  "Secretária Municipal de Educação",
  "Coordenadora da Supervisão de Ensino",
];

export const inheritedHolidays2027: InheritedHoliday[] = [
  { date: "2027-01-01", name: "Confraternização Universal", sphere: "nacional", type: "FERIADO" },
  { date: "2027-03-19", name: "São José — padroeiro", sphere: "municipal", type: "FERIADO" },
  {
    date: "2027-03-26",
    name: "Sexta-feira Santa",
    sphere: "nacional",
    type: "FERIADO",
    movable: "sexta-santa",
  },
  { date: "2027-04-21", name: "Tiradentes", sphere: "nacional", type: "FERIADO" },
  { date: "2027-04-23", name: "São Jorge", sphere: "estadual", type: "FERIADO" },
  { date: "2027-05-01", name: "Dia do Trabalho", sphere: "nacional", type: "FERIADO" },
  { date: "2027-05-10", name: "Aniversário de Itaperuna", sphere: "municipal", type: "FL" },
  { date: "2027-09-07", name: "Independência do Brasil", sphere: "nacional", type: "FL" },
  {
    date: "2027-10-12",
    name: "Nossa Senhora Aparecida / Dia da Criança",
    sphere: "nacional",
    type: "FERIADO",
  },
  { date: "2027-11-02", name: "Finados", sphere: "nacional", type: "FERIADO" },
  { date: "2027-11-15", name: "Proclamação da República", sphere: "nacional", type: "FERIADO" },
  {
    date: "2027-11-20",
    name: "Dia Nacional de Zumbi e da Consciência Negra",
    sphere: "nacional",
    type: "FERIADO",
  },
  { date: "2027-12-25", name: "Natal", sphere: "nacional", type: "FERIADO" },
];

const policy2027 = (): CalendarValidationPolicy => ({
  minSchoolDays: { value: 200, basis: "LDB, art. 24, I" },
  councilWeekday: 5,
  minDaysPerBlock: 100,
  januaryVacationDays: 30,
  expectedLocalHolidays: [
    { monthDay: "03-19", name: "São José (Feriado Municipal)", type: "FERIADO" },
    { monthDay: "04-23", name: "São Jorge (Feriado Estadual)", type: "FERIADO" },
    { monthDay: "05-10", name: "Aniversário da cidade (Feriado Letivo)", type: "FL" },
  ],
});

function ranges(prefix: string): CalendarRange[] {
  const rows: Array<[DayTypeCode, string, string]> = [
    ["FERIAS", "2027-01-04", "2027-02-02"],
    ["RECESSO", "2027-02-08", "2027-02-08"],
    ["RECESSO", "2027-02-10", "2027-02-12"],
    ["RECESSO", "2027-04-22", "2027-04-22"],
    ["RECESSO", "2027-05-28", "2027-05-28"],
    ["FERIAS", "2027-07-12", "2027-07-23"],
    ["RECESSO", "2027-09-06", "2027-09-06"],
    ["FERIAS", "2027-12-20", "2027-12-24"],
    ["FERIAS", "2027-12-27", "2027-12-31"],
  ];
  return rows.map(([type, start, end], i) => ({ id: `${prefix}-fx-${i + 1}`, type, start, end }));
}

type Ev = [
  DayTypeCode,
  string,
  string?,
  boolean?,
  (string | undefined)?,
  CalendarEventEntry["movable"]?,
];
function events(prefix: string, rows: Ev[]): CalendarEventEntry[] {
  return rows.map(([type, date, name, showInHolidays, displayDate, movable]) => ({
    id: `${prefix}-ev-${date}`,
    type,
    date,
    ...(name ? { name } : {}),
    ...(showInHolidays ? { showInHolidays } : {}),
    ...(displayDate ? { displayDate } : {}),
    ...(movable ? { movable } : {}),
  }));
}

const commonHead: Ev[] = [
  ["FERIADO", "2027-01-01", "CONFRATERNIZAÇÃO UNIVERSAL"],
  ["ENCONTRO", "2027-02-03"],
  ["INICIO", "2027-02-04"],
  ["FERIADO", "2027-02-09", "CARNAVAL", true, undefined, "carnaval"],
  ["FERIADO", "2027-03-19", "SÃO JOSÉ (Feriado Municipal)", true],
  ["FERIADO", "2027-03-26", "SEXTA-FEIRA SANTA", true, undefined, "sexta-santa"],
  ["FERIADO", "2027-04-21", "TIRADENTES", true],
  ["FERIADO", "2027-04-23", "SÃO JORGE (Feriado Estadual)", true],
];
const commonTail: Ev[] = [
  ["FL", "2027-05-10", "FERIADO LETIVO (Aniversário da cidade)", true],
  ["CENSO", "2027-05-26"],
  ["FERIADO", "2027-05-27", "CORPUS CHRISTI", true, undefined, "corpus-christi"],
  ["RETORNO", "2027-07-26"],
  ["FL", "2027-09-07", "FERIADO LETIVO (Independência do Brasil)", true],
  ["MESTRE", "2027-10-11", "DIA DO MESTRE / Transferido para o dia 11/10", true, "2027-10-15"],
  ["FERIADO", "2027-10-12", "NOSSA SENHORA APARECIDA / DIA DA CRIANÇA", true],
  ["FERIADO", "2027-11-02", "DIA DE FINADOS", true],
  ["FERIADO", "2027-11-15", "PROCLAMAÇÃO DA REPÚBLICA", true],
  ["TERMINO", "2027-12-17"],
];

const decemberRecess = [20, 21, 22, 23, 24, 27, 28, 29, 30, 31].map((d) => ({
  date: `2027-12-${d}`,
  type: "RECESSO" as const,
}));

const base = {
  year: 2027,
  academicYearId: "ano-2027",
  status: "rascunho" as const,
  inheritedHolidays: inheritedHolidays2027,
  legendHidden: ["PP", "PF", "FERIAS"] as DayTypeCode[],
  signatures: SIGNATURES_2027,
  createdBy: "Supervisão de Ensino",
  createdAt: "2026-09-23T12:00:00.000Z",
  fixtureNote: FIXTURE_NOTE,
};

const regularPeriods: CalendarPeriod[] = [
  {
    id: "per-2027-reg-1",
    order: 1,
    name: "1º Período",
    start: "2027-02-04",
    end: "2027-05-21",
    councilDate: "2027-05-21",
    councilLabel: "Conselho de Classe do 1º Período",
  },
  {
    id: "per-2027-reg-2",
    order: 2,
    name: "2º Período",
    start: "2027-05-24",
    end: "2027-09-10",
    councilDate: "2027-09-10",
    councilLabel: "Conselho de Classe do 2º Período",
  },
  {
    id: "per-2027-reg-3",
    order: 3,
    name: "3º Período",
    start: "2027-09-13",
    end: "2027-12-17",
    councilDate: "2027-12-10",
    councilLabel: "Conselho de Classe do 3º Período",
  },
];

const ejaPeriods: CalendarPeriod[] = [
  {
    id: "per-2027-eja-1",
    order: 1,
    name: "1° Período Letivo/1",
    block: "EJA - 1º SEMESTRE",
    start: "2027-02-04",
    end: "2027-04-30",
    councilDate: "2027-04-30",
    councilLabel: "Conselho de Classe do 1º Período/1",
  },
  {
    id: "per-2027-eja-2",
    order: 2,
    name: "2° Período Letivo/1",
    block: "EJA - 1º SEMESTRE",
    start: "2027-05-03",
    end: "2027-07-09",
    councilDate: "2027-07-09",
    councilLabel: "Conselho de Classe do 2º Período/1",
  },
  {
    id: "per-2027-eja-3",
    order: 3,
    name: "1° Período Letivo/2",
    block: "EJA - 2º SEMESTRE",
    start: "2027-07-26",
    end: "2027-10-01",
    councilDate: "2027-10-01",
    councilLabel: "Conselho de Classe do 1º Período/2",
  },
  {
    id: "per-2027-eja-4",
    order: 4,
    name: "2° Período Letivo/2",
    block: "EJA - 2º SEMESTRE",
    start: "2027-10-04",
    end: "2027-12-17",
    councilDate: "2027-12-10",
    councilLabel: "Conselho de Classe do 2º Período/2",
  },
];

export function createCalendarFixtures(): NetworkCalendar[] {
  const regular: NetworkCalendar = {
    ...base,
    id: "cal-rede-2027-regular",
    modality: "regular",
    title: "ENSINO REGULAR / PERÍODO ANUAL",
    layout: "anual",
    observations: "Conselho de Classe Final em 17/12/2027.",
    ranges: ranges("reg"),
    events: events("reg", [
      ...commonHead,
      ["CC", "2027-05-21"],
      ["CC", "2027-09-10"],
      ["CC", "2027-12-10", "Conselho de Classe do 3º Período"],
      ...commonTail,
    ]).sort((a, b) => a.date.localeCompare(b.date)),
    periods: regularPeriods,
    overrides: [
      { date: "2027-12-10", type: "CC" },
      { date: "2027-12-17", type: "TERMINO" },
      ...decemberRecess,
    ],
    policy: policy2027(),
    audit: [
      {
        at: base.createdAt,
        actorId: "sup-ref",
        actorName: "Supervisão de Ensino",
        action: "criado",
        detail: "Calendário 2027 — Ensino Regular.",
      },
    ],
  };
  const eja: NetworkCalendar = {
    ...base,
    id: "cal-rede-2027-eja",
    modality: "eja",
    title: "EJA / CURSO SEMESTRAL – PERÍODOS 1º e 2º",
    layout: "semestral",
    semesterCut: { month: 7, day: 25 },
    ranges: ranges("eja"),
    events: events("eja", [
      ...commonHead,
      ["CC", "2027-04-30"],
      ["CC", "2027-07-09"],
      ["CC", "2027-10-01"],
      ["CC", "2027-12-10"],
      ...commonTail,
    ]).sort((a, b) => a.date.localeCompare(b.date)),
    periods: ejaPeriods,
    overrides: decemberRecess,
    policy: policy2027(),
    audit: [
      {
        at: base.createdAt,
        actorId: "sup-ref",
        actorName: "Supervisão de Ensino",
        action: "criado",
        detail: "Calendário 2027 — EJA.",
      },
    ],
  };
  return [regular, eja];
}

/** Perfis de demonstração — sem autenticação real; a autorização definitiva depende do backend/RBAC. */
export const demoActors = {
  supervisao: {
    id: "act-supervisao",
    name: "Supervisão de Ensino (demonstração)",
    role: "supervisao",
  },
  escola: { id: "act-escola", name: "Direção escolar (demonstração)", role: "escola" },
  professor: { id: "act-professor", name: "Professor(a) (demonstração)", role: "professor" },
} as const;
