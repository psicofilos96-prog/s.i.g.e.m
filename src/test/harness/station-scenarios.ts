/**
 * NTEST.1 — cenários padronizados por estação. Dado de teste, não regra:
 * a fonte das rotas é station-navigation; a fonte das capabilities é a política homologada.
 * `profiles` = tipos do manifesto do harness BO (antigo "69 perfis" = combinações tipo×escopo×pessoa).
 */
import type { SectorStation } from "@/features/authority/station-navigation";

export type StationScenario = Readonly<{
  station: SectorStation | "pedagogico";
  label: string;
  mustReach: string[];
  mustNotReach: string[];
  profiles: string[];
}>;

export const STATION_SCENARIOS: readonly StationScenario[] = [
  { station: "secretaria_escolar", label: "Secretaria", mustReach: ["/secretaria", "/alunos", "/enturmacoes"], mustNotReach: ["/ciece", "/supervisao-escolar"], profiles: ["secretaria-escolar"] },
  { station: "ciece", label: "CIECE", mustReach: ["/ciece", "/censo-escolar", "/qualidade-dos-dados"], mustNotReach: ["/secretaria", "/enturmacoes"], profiles: ["ciece-estatistica", "ciece-auditoria-coordenacao"] },
  { station: "supervisao", label: "Supervisão", mustReach: ["/supervisao-escolar", "/calendario-escolar"], mustNotReach: ["/alunos", "/secretaria"], profiles: [] },
  { station: "avaliacao", label: "Avaliação", mustReach: ["/avaliacao-desempenho"], mustNotReach: ["/alunos", "/secretaria"], profiles: [] },
  { station: "orientacao_pedagogica", label: "OP", mustReach: ["/orientacao", "/planejamento"], mustNotReach: ["/secretaria", "/ciece"], profiles: ["orientacao-pedagogica"] },
  { station: "direcao_escolar", label: "Direção", mustReach: ["/direcao", "/profissionais"], mustNotReach: ["/ciece", "/supervisao-escolar"], profiles: ["direcao-escolar"] },
  { station: "alimentacao", label: "Alimentação", mustReach: ["/alimentacao-escolar"], mustNotReach: ["/alunos", "/secretaria"], profiles: [] },
  { station: "pedagogico", label: "Perfis pedagógicos (pessoa)", mustReach: [], mustNotReach: [], profiles: ["professor", "gestao-pedagogica-da-rede"] },
];
