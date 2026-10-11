/**
 * SIGEM 2.0 A&A Lote 1 — identidade e metodologia declaradas dos programas.
 * Fonte: requisitos do usuário (acervo 2023–2026 descrito, NÃO anexado). Nada aqui é resultado;
 * escala, faixa, meta e descritor ficam `null` (pendente de fonte oficial), nunca presumidos.
 */
export type Grain = "rede" | "escola" | "turma" | "estudante";
export type ScaleKind = "proficiencia" | "indice" | "percentual" | "acertos" | "conceito" | "descritivo" | "taxa";

export type ProgramSpec = {
  key: string; name: string; origin: "interna" | "externa";
  delivery: "registro-na-rede" | "importado-de-fonte-externa" | "misto";
  application: string; correction: string;
  population: string; cycles: string[]; editionsDeclared: string[];
  grains: Grain[]; scaleKind: ScaleKind; scaleKey: string;
  studentLevelLegit: boolean; // só quando a fonte entrega microdado legítimo
  officialScale: null; officialMatrix: null; // sempre pendente até importação oficial
  integrations: string[]; note: string;
};

const P = (s: Omit<ProgramSpec, "officialScale" | "officialMatrix">): ProgramSpec => ({ ...s, officialScale: null, officialMatrix: null });

export const PROGRAM_CATALOG: readonly ProgramSpec[] = [
  P({ key: "saeb-ideb", name: "SAEB/IDEB", origin: "externa", delivery: "importado-de-fonte-externa", application: "INEP", correction: "INEP",
    population: "5º e 9º anos (SAEB); rede/escola (IDEB)", cycles: ["bienal"], editionsDeclared: ["2007–2025 (série)", "2023", "2025"],
    grains: ["rede", "escola"], scaleKind: "proficiencia", scaleKey: "saeb-proficiencia", studentLevelLegit: false,
    integrations: ["escola", "CIECE"], note: "IDEB é índice próprio (escala-chave distinta); nunca somado à proficiência." }),
  P({ key: "avalia-rj", name: "AVALIA RJ — 2º ano", origin: "externa", delivery: "importado-de-fonte-externa", application: "Estado RJ", correction: "Estado RJ",
    population: "2º ano EF", cycles: ["anual"], editionsDeclared: ["2024", "2025"], grains: ["rede", "escola", "turma"], scaleKind: "proficiencia", scaleKey: "avalia-rj",
    studentLevelLegit: true, integrations: ["escola", "turma", "matrícula"], note: "Escala própria; não comparável a SAEB sem declaração." }),
  P({ key: "cnca-caed", name: "CNCA/CAEd — Ciclos I/II/III", origin: "externa", delivery: "misto", application: "Rede municipal", correction: "CAEd",
    population: "Alfabetização (anos iniciais)", cycles: ["Ciclo I", "Ciclo II", "Ciclo III"], editionsDeclared: ["2026"], grains: ["rede", "escola", "turma", "estudante"],
    scaleKind: "proficiencia", scaleKey: "cnca-caed", studentLevelLegit: true, integrations: ["SIA", "turma", "calendário", "matrícula"], note: "Matriz CNCA/CAEd pendente de importação oficial." }),
  P({ key: "saber-ler", name: "Saber Ler — 1º/2º anos", origin: "interna", delivery: "registro-na-rede", application: "Professor regente", correction: "Rede municipal",
    population: "1º e 2º anos EF", cycles: ["semana 4", "semana 8", "semana 12", "semana 16"], editionsDeclared: ["2026"], grains: ["escola", "turma", "estudante"],
    scaleKind: "conceito", scaleKey: "saber-ler-nivel", studentLevelLegit: true, integrations: ["Diário", "SIA", "calendário"], note: "Níveis de leitura só após configuração homologada." }),
  P({ key: "diagnostica-formativa", name: "Diagnóstica/Formativa 1º–9º e TEC", origin: "interna", delivery: "registro-na-rede", application: "Escola", correction: "Rede municipal",
    population: "1º–9º anos EF e TEC", cycles: ["diagnóstica", "formativa"], editionsDeclared: [], grains: ["escola", "turma", "estudante"],
    scaleKind: "acertos", scaleKey: "diag-form-acertos", studentLevelLegit: true, integrations: ["SIA", "Diário", "SIPE"], note: "Acertos por item; percentual só com denominador de itens válidos." }),
  P({ key: "simula-saeb", name: "Simula SAEB — 4º/8º", origin: "interna", delivery: "registro-na-rede", application: "Escola", correction: "Rede municipal",
    population: "4º e 8º anos EF", cycles: ["rodadas"], editionsDeclared: [], grains: ["escola", "turma", "estudante"], scaleKind: "acertos", scaleKey: "simula-saeb-acertos",
    studentLevelLegit: true, integrations: ["SIA"], note: "Simulado não é proficiência SAEB; nunca comparar à escala INEP." }),
  P({ key: "producao-textual", name: "Produção Textual 3º–9º/TEC", origin: "interna", delivery: "registro-na-rede", application: "Professor", correction: "Rede municipal (rubrica)",
    population: "3º–9º anos EF e TEC", cycles: [], editionsDeclared: [], grains: ["escola", "turma", "estudante"], scaleKind: "conceito", scaleKey: "producao-textual-rubrica",
    studentLevelLegit: true, integrations: ["SIA", "Diário"], note: "Rubrica pendente de homologação." }),
  P({ key: "educacao-infantil", name: "Acompanhamento da Educação Infantil", origin: "interna", delivery: "registro-na-rede", application: "Professor", correction: "Não se aplica (descritivo)",
    population: "Educação Infantil", cycles: [], editionsDeclared: [], grains: ["turma", "estudante"], scaleKind: "descritivo", scaleKey: "ei-descritivo",
    studentLevelLegit: true, integrations: ["Diário (parecer)", "SIPE"], note: "Sem nota nem ranking; parecer descritivo é do Diário." }),
  P({ key: "rendimento", name: "Rendimento escolar", origin: "interna", delivery: "registro-na-rede", application: "Secretaria", correction: "Não se aplica",
    population: "Matrículas da rede", cycles: ["anual"], editionsDeclared: [], grains: ["rede", "escola", "turma"], scaleKind: "taxa", scaleKey: "rendimento-taxa",
    studentLevelLegit: false, integrations: ["matrícula", "situação acadêmica", "CIECE"], note: "Derivado da situação oficial; taxa exige denominador." }),
  P({ key: "infrequencia", name: "Infrequência", origin: "interna", delivery: "registro-na-rede", application: "Escola (Diário)", correction: "Não se aplica",
    population: "Estudantes enturmados", cycles: ["mensal"], editionsDeclared: ["2026"], grains: ["rede", "escola", "turma", "estudante"], scaleKind: "taxa", scaleKey: "infrequencia-taxa",
    studentLevelLegit: true, integrations: ["Diário", "calendário", "matrícula"], note: "Aula prevista só da grade/calendário; ausência de registro não é falta." }),
];

/** Ponto de dado tipado — nenhum é criado aqui; só validado antes de qualquer gravação/agregação. */
export type DataPoint = {
  program: string; edition: string | null; source: string | null; instrument: string | null;
  schoolId: string | null; year: number | null; classId: string | null; studentId: string | null;
  date: string | null; value: number | string | null; numerator?: number | null; denominator?: number | null;
  population: string | null; matrix: string | null; method: string | null; revision: number | null; scaleKey: string | null;
};

export function validateDataPoint(d: DataPoint): string[] {
  const e: string[] = [];
  const spec = PROGRAM_CATALOG.find((p) => p.key === d.program);
  if (!spec) return ["programa-desconhecido"];
  for (const k of ["edition", "source", "instrument", "date", "population", "method"] as const) if (!d[k]) e.push(`${k}-ausente`);
  if (d.year == null) e.push("year-ausente");
  if (d.revision == null || d.revision < 1) e.push("revision-invalida");
  if (d.scaleKey !== spec.scaleKey) e.push("escala-divergente");
  if (d.studentId && !spec.studentLevelLegit) e.push("estudante-nao-legitimo");
  if (d.studentId && !d.classId) e.push("estudante-sem-turma");
  if (d.classId && !d.schoolId) e.push("turma-sem-escola");
  if (spec.scaleKind === "taxa" || spec.scaleKind === "percentual") {
    if (d.denominator == null) e.push("denominador-ausente");
    else if (d.denominator <= 0) e.push("denominador-invalido");
    if (d.numerator != null && d.denominator != null && d.numerator > d.denominator) e.push("numerador-maior");
  }
  if (d.value === null) e.push("valor-ausente"); // ausência registrada à parte, nunca zero
  return e;
}

/** Agregação só dentro da mesma escala; mistura é recusada por extenso. */
export function aggregateMean(points: DataPoint[]): { ok: true; mean: number; n: number; missing: number } | { ok: false; reason: string } {
  const keys = new Set(points.map((p) => `${p.program}|${p.scaleKey}`));
  if (keys.size > 1) return { ok: false, reason: `Escalas diferentes não se misturam: ${[...keys].join(", ")}` };
  const nums = points.map((p) => p.value).filter((v): v is number => typeof v === "number");
  if (!nums.length) return { ok: false, reason: "Sem valores numéricos observados" };
  return { ok: true, mean: nums.reduce((a, b) => a + b, 0) / nums.length, n: nums.length, missing: points.length - nums.length };
}

/** Programa do catálogo já registrado na base? Comparação por nome exato da versão vigente. */
export function registrationState(names: string[]) {
  const set = new Set(names.map((n) => n.trim()));
  return PROGRAM_CATALOG.map((p) => ({ spec: p, registered: set.has(p.name) }));
}
