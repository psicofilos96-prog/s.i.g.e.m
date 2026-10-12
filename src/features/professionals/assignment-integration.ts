/**
 * Gestão de Pessoas L20 — Integração das atribuições formalizadas.
 * Perfil Docente recebe só atribuições em VIGÊNCIA (L11) na data: escola,
 * turma, componente, horários e período autorizados. Encerramento/revogação
 * tiram o acesso de escrita a partir da data, mas o histórico (diários,
 * avaliações) permanece legível em modo somente leitura e nunca é apagado.
 * Setores recebem projeções com campos por allowlist; nenhuma projeção concede
 * capacidade — acesso digital continua vindo de atuação × política homologada.
 */

export type AssignmentStatus = "proposta" | "analise" | "validacao" | "formalizacao" | "vigencia" | "encerrada" | "revogada" | "cancelada";

export type FormalizedAssignment = Readonly<{
  id: string; personId: string; linkId: string; schoolId: string; classId: string; componentId: string;
  slots: readonly string[]; validFrom: string; validUntil: string | null;
  status: AssignmentStatus; endedOn: string | null; actRef: string | null;
}>;

export type TeacherContext = Readonly<{
  assignmentId: string; schoolId: string; classId: string; componentId: string; slots: readonly string[];
  period: { from: string; until: string | null }; mode: "escrita" | "somente-leitura-historico";
}>;

const activeOn = (a: FormalizedAssignment, day: string) =>
  a.status === "vigencia" && !!a.actRef && a.validFrom <= day && (a.validUntil === null || a.validUntil >= day);

/** Fim efetivo: o menor entre validUntil e endedOn (encerramento/revogação). */
const effectiveEnd = (a: FormalizedAssignment) =>
  [a.validUntil, a.endedOn].filter((x): x is string => !!x).sort()[0] ?? null;

export function teacherProfile(personId: string, day: string, all: readonly FormalizedAssignment[]): TeacherContext[] {
  return all
    .filter((a) => a.personId === personId)
    .flatMap((a): TeacherContext[] => {
      const base = { assignmentId: a.id, schoolId: a.schoolId, classId: a.classId, componentId: a.componentId, slots: a.slots };
      if (activeOn(a, day)) return [{ ...base, period: { from: a.validFrom, until: a.validUntil }, mode: "escrita" }];
      // histórico só para o que chegou a vigorar (tem ato e começou)
      const ended = (a.status === "encerrada" || a.status === "revogada" || (a.status === "vigencia" && a.validUntil !== null && a.validUntil < day));
      if (ended && a.actRef && a.validFrom <= day) return [{ ...base, period: { from: a.validFrom, until: effectiveEnd(a) }, mode: "somente-leitura-historico" }];
      return [];
    });
}

/** Pode registrar no Diário naquela data/horário? Só dentro do período vigente. */
export function canRecordLesson(ctx: readonly TeacherContext[], classId: string, componentId: string, lessonDay: string, slot: string): boolean {
  return ctx.some((c) => c.mode === "escrita" && c.classId === classId && c.componentId === componentId && c.slots.includes(slot)
    && c.period.from <= lessonDay && (c.period.until === null || c.period.until >= lessonDay));
}

/** Histórico nunca é apagado: registros fora do período ficam legíveis e intactos. */
export function historicalRecordsPreserved<T extends { assignmentId: string }>(records: readonly T[], _ended: FormalizedAssignment): readonly T[] {
  return records; // nenhuma remoção; consumidores só mudam o modo de acesso
}

export type Sector = "direcao" | "secretaria" | "orientacao" | "mediador" | "nei" | "supervisao" | "ciece" | "aa" | "administracao";

/** Allowlist por setor. Nenhum setor recebe vínculo/matrícula funcional; CIECE e A&A só fato atômico sem pessoa. */
export const SECTOR_FIELDS: Readonly<Record<Sector, readonly (keyof FormalizedAssignment)[]>> = {
  direcao: ["id", "personId", "schoolId", "classId", "componentId", "slots", "validFrom", "validUntil", "status"],
  secretaria: ["id", "personId", "schoolId", "classId", "componentId", "validFrom", "validUntil", "status"],
  orientacao: ["personId", "schoolId", "classId", "componentId"],
  mediador: ["personId", "classId", "componentId", "slots"],
  nei: ["personId", "classId", "componentId"],
  supervisao: ["id", "schoolId", "classId", "componentId", "validFrom", "validUntil", "status", "actRef"],
  ciece: ["schoolId", "classId", "componentId", "validFrom", "validUntil"],
  aa: ["schoolId", "classId", "componentId", "validFrom", "validUntil"],
  administracao: ["id", "personId", "linkId", "schoolId", "classId", "componentId", "slots", "validFrom", "validUntil", "status", "endedOn", "actRef"],
};

export type SectorScope = Readonly<{ sector: Sector; schoolIds: readonly string[] | "rede"; classIds?: readonly string[] }>;

export function sectorProjection(scope: SectorScope, day: string, all: readonly FormalizedAssignment[]) {
  const fields = SECTOR_FIELDS[scope.sector];
  return all
    .filter((a) => activeOn(a, day))
    .filter((a) => scope.schoolIds === "rede" || scope.schoolIds.includes(a.schoolId))
    .filter((a) => !scope.classIds || scope.classIds.includes(a.classId))
    .map((a) => Object.fromEntries(fields.map((f) => [f, a[f]])) as Partial<FormalizedAssignment>);
}

export const grantsCapabilities = false as const;
