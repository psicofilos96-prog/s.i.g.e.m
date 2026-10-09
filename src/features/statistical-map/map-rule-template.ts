/**
 * NCIECE.FINAL.2 — modelo-base de rascunho da regra do Mapa a partir do que o acervo define
 * expressamente: data da fotografia = último dia letivo (decisão vigente) e Remanejados como grupo
 * próprio. Recebidos/Transferidos/Evadidos/Desistentes ficam SEM tipos (o acervo não traz
 * semântica institucional explícita) e o Mapa exibe "regra ainda não homologada". Só preenche o
 * editor: registrar é ato humano e homologar exige outra pessoa.
 */
import type { MapCompetenceRuleDefinition } from "./map-domain";

export function mapRuleBaseTemplate(coveredSchoolIds: readonly string[]): MapCompetenceRuleDefinition {
  return {
    coveredSchoolIds: [...coveredSchoolIds],
    snapshotDate: { kind: "ultimo-dia-letivo-do-mes-calendario-oficial" } as MapCompetenceRuleDefinition["snapshotDate"],
    cells: [],
    blockingCellIds: [],
    structureIVGroups: { remanejamentoTypeIds: [] },
  };
}
