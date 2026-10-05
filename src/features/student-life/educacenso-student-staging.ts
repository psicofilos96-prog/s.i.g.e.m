/**
 * Frente F — reconciliação de alunos/matrículas/participações (puro, sem gravação).
 * Pessoa ≠ matrícula ≠ participação ≠ posição ≠ movimento. Nada é criado por inferência:
 * aluno só existe se a fonte de ALUNOS o declara; turma só se já canônica; posição/fase só se declarada.
 * Chaves pessoais chegam como fingerprint do pipeline seguro; nunca CPF/nome em claro.
 */
export type StudentSourceRow = {
  locator: string;
  personKey: string | null; // fingerprint (CPF/ID INEP) — pipeline seguro
  inepStudentId: string | null; // external identifier, nunca PK
  schoolInep: string | null;
  classExternalId: string | null;
  situationRaw: string | null; // valor literal da fonte
  positionAxis: string | null; // etapa/fase declarada (multietapa/EJA); nunca do nome da turma
  movementKind: string | null; // declarado pela fonte (catálogo aberto)
  movementDate: string | null; // YYYY-MM-DD
};

export type StudentRefs = {
  schools: ReadonlySet<string>;
  classes: ReadonlyMap<string, { schoolInep: string; multiStage: boolean }>;
  situationCatalog: ReadonlySet<string>; // valores homologados aceitos como fato
};

export type StudentEvidenceCode =
  | "pessoa-sem-chave" | "inep-aluno-duplicado" | "escola-sem-correspondencia"
  | "turma-sem-correspondencia" | "turma-de-outra-escola" | "aluno-sem-turma"
  | "situacao-fora-do-catalogo" | "posicao-ausente-em-multietapa"
  | "movimento-sem-data" | "data-invalida" | "fontes-divergentes";

export type StudentEvidence = { locator: string; code: StudentEvidenceCode; ref?: string | undefined };

export type StagedParticipation = {
  personKey: string; schoolId: string; classId: string;
  situation: string | null; positionAxis: string | null; locator: string;
};
export type StagedMovement = { personKey: string; kind: string; date: string; fromClassId: string | null; toClassId: string; locator: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const mask = (k: string | null) => (k ? k.slice(0, 8) : undefined);

export function stageStudents(rows: StudentSourceRow[], refs: StudentRefs) {
  const evidence: StudentEvidence[] = [];
  const persons = new Set<string>();
  const enrollments = new Set<string>(); // pessoa|escola
  const participations: StagedParticipation[] = [];
  const movements: StagedMovement[] = [];
  const inepOwner = new Map<string, string>();
  const lastClass = new Map<string, string>();

  for (const r of rows) {
    const flag = (code: StudentEvidenceCode, ref?: string) => evidence.push({ locator: r.locator, code, ref });
    if (!r.personKey) { flag("pessoa-sem-chave"); continue; }
    if (r.inepStudentId) {
      const owner = inepOwner.get(r.inepStudentId);
      if (owner && owner !== r.personKey) { flag("inep-aluno-duplicado", mask(r.inepStudentId)); continue; }
      inepOwner.set(r.inepStudentId, r.personKey);
    }
    if (!r.schoolInep || !refs.schools.has(r.schoolInep)) { flag("escola-sem-correspondencia"); continue; }
    persons.add(r.personKey);
    enrollments.add(`${r.personKey}|${r.schoolInep}`);
    if (!r.classExternalId) { flag("aluno-sem-turma", mask(r.personKey)); continue; }
    const cls = refs.classes.get(r.classExternalId);
    if (!cls) { flag("turma-sem-correspondencia"); continue; }
    if (cls.schoolInep !== r.schoolInep) { flag("turma-de-outra-escola"); continue; }
    let situation: string | null = null;
    if (r.situationRaw != null && r.situationRaw.trim() !== "") {
      const v = r.situationRaw.trim();
      if (refs.situationCatalog.has(v)) situation = v; else flag("situacao-fora-do-catalogo");
    }
    const position = r.positionAxis?.trim() || null;
    if (cls.multiStage && !position) flag("posicao-ausente-em-multietapa");
    if (r.movementKind) {
      if (!r.movementDate) { flag("movimento-sem-data"); continue; }
      if (!DATE.test(r.movementDate)) { flag("data-invalida"); continue; }
      movements.push({ personKey: r.personKey, kind: r.movementKind, date: r.movementDate, fromClassId: lastClass.get(r.personKey) ?? null, toClassId: r.classExternalId, locator: r.locator });
    }
    const key = `${r.personKey}|${r.classExternalId}`;
    if (!participations.some((p) => `${p.personKey}|${p.classId}` === key)) {
      participations.push({ personKey: r.personKey, schoolId: `inep-${r.schoolInep}`, classId: r.classExternalId, situation, positionAxis: position, locator: r.locator });
    }
    lastClass.set(r.personKey, r.classExternalId);
  }

  const classesWithStudents = new Set(participations.map((p) => p.classId));
  const emptyClasses = [...refs.classes.keys()].filter((c) => !classesWithStudents.has(c));
  const bySchool: Record<string, number> = {};
  for (const p of participations) bySchool[p.schoolId] = (bySchool[p.schoolId] ?? 0) + 1;
  return {
    participations, movements, evidence, emptyClasses,
    counts: { persons: persons.size, enrollments: enrollments.size, participations: participations.length, movements: movements.length, participationsBySchool: bySchool },
  };
}

/** Duas fontes de alunos: diferenças de turma por pessoa viram evidência, nunca escolha. */
export function compareStudentSources(a: StagedParticipation[], b: StagedParticipation[]): StudentEvidence[] {
  const index = (l: StagedParticipation[]) => {
    const m = new Map<string, string[]>();
    for (const p of l) (m.get(p.personKey) ?? m.set(p.personKey, []).get(p.personKey)!).push(p.classId);
    return m;
  };
  const ia = index(a), ib = index(b);
  const out: StudentEvidence[] = [];
  for (const k of new Set([...ia.keys(), ...ib.keys()])) {
    if ((ia.get(k) ?? []).sort().join() !== (ib.get(k) ?? []).sort().join()) out.push({ locator: "comparacao", code: "fontes-divergentes", ref: mask(k) });
  }
  return out;
}
