/**
 * 6D.5.1 — Repositório canônico de objetivos curriculares (Matriz de Habilidades).
 *
 * Fonte normativa → Matriz de Habilidades → Diário. O Diário NUNCA guarda cópia
 * própria do currículo: consulta este repositório. Cada objetivo carrega a
 * proveniência da fonte; complementação da rede tem identidade própria e não
 * pode ocupar código nem identificador de objetivo nacional.
 *
 * Persistência real: dependência transversal do Lovable Cloud. Hoje em memória,
 * isolado atrás deste contrato para receber persistência sem tocar consumidores.
 */
import { BNCC_INFANT_ROWS, BNCC_INFANT_SOURCE } from "./bncc-infant-objectives.data";

export type CurriculumSourceRef = {
  sourceId: string;
  label: string;
  authority: string;
  version: string;
  url?: string;
};

export type CurriculumObjective = {
  /** ID técnico estável. BNCC: `bncc:<código>`. */
  id: string;
  code: string;
  /** Texto integral da fonte; nunca resumido nem reescrito. */
  officialText: string;
  /** Campo de Experiências (EI) — identificador aberto. */
  fieldId: string;
  /** Grupo etário curricular (EI01/EI02/EI03) — identificador aberto. */
  ageGroupId: string;
  source: CurriculumSourceRef;
  /** Natureza: nacional ou complementação; complementação referencia sem sobrescrever. */
  nature: "fonte-nacional" | "complementacao-da-rede";
  complementsObjectiveIds?: readonly string[];
};

/** Grupos etários como a BNCC os define. Rótulos são dado, não enumeração fechada. */
export const BNCC_INFANT_AGE_GROUPS = [
  { id: "EI01", label: "Bebês (zero a 1 ano e 6 meses)" },
  { id: "EI02", label: "Crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)" },
  { id: "EI03", label: "Crianças pequenas (4 anos a 5 anos e 11 meses)" },
] as const;

const bnccObjectives: CurriculumObjective[] = BNCC_INFANT_ROWS.map((row) => ({
  id: `bncc:${row.code}`,
  code: row.code,
  officialText: row.officialText,
  fieldId: row.fieldId,
  ageGroupId: row.code.slice(0, 4),
  source: { ...BNCC_INFANT_SOURCE },
  nature: "fonte-nacional",
}));

export type ObjectiveQuery = {
  ageGroupIds?: readonly string[];
  fieldId?: string;
  text?: string;
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function createCurriculumObjectiveRepository(seed: readonly CurriculumObjective[] = bnccObjectives) {
  let objectives = [...seed];
  return {
    list: () => objectives as readonly CurriculumObjective[],
    byId: (id: string) => objectives.find((o) => o.id === id),
    query(q: ObjectiveQuery = {}) {
      const needle = q.text ? normalize(q.text.trim()) : "";
      return objectives.filter(
        (o) =>
          (!q.ageGroupIds?.length || q.ageGroupIds.includes(o.ageGroupId)) &&
          (!q.fieldId || o.fieldId === q.fieldId) &&
          (!needle || normalize(`${o.code} ${o.officialText}`).includes(needle)),
      );
    },
    /** Complementação da rede: identidade própria, nunca substitui objetivo nacional. */
    addComplement(
      input: Omit<CurriculumObjective, "nature">,
    ): { ok: true; value: CurriculumObjective } | { ok: false; reason: string } {
      const national = objectives.filter((o) => o.nature === "fonte-nacional");
      if (input.source.sourceId === "bncc")
        return { ok: false, reason: "Complementação da rede não pode se declarar como texto da BNCC." };
      if (national.some((o) => o.id === input.id || o.code === input.code))
        return { ok: false, reason: "Complementação não pode ocupar identificador ou código de objetivo nacional." };
      if (objectives.some((o) => o.id === input.id))
        return { ok: false, reason: "Já existe objetivo com este identificador." };
      const value: CurriculumObjective = { ...input, nature: "complementacao-da-rede" };
      objectives = [...objectives, value];
      return { ok: true, value };
    },
  };
}

export type CurriculumObjectiveRepository = ReturnType<typeof createCurriculumObjectiveRepository>;

export const curriculumObjectiveRepository = createCurriculumObjectiveRepository();
