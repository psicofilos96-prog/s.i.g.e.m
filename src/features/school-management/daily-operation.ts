// SIGEM 2.0 — Direção, Lote 11: operação diária (núcleo puro da experiência).
// Painel de decisões = projeção dos núcleos dos lotes 02–10; alerta só com ação concreta e link à tela dona;
// estados de tela canônicos; filtros persistidos só sem dado pessoal; rascunho protegido por base esperada.
import { scheduleBoard } from "./staff-schedule";
import type { GridBlock } from "@/features/schedules/schedule-conflicts";
import type { Demand } from "./demand-center";
import { currentStep } from "./demand-center";

export type ScreenState = "carregando" | "sem-permissao" | "nao-registrado" | "vazio" | "erro-recuperavel" | "pronto";
/** Estado da tela: permissão antes de dado; erro recuperável nunca vira vazio; ausência de fonte ≠ lista vazia. */
export function screenState(s: { authorized: boolean | null; error: string | null; sourceRead: boolean; rows: number }): ScreenState {
  if (s.authorized === null) return "carregando";
  if (!s.authorized) return "sem-permissao";
  if (s.error) return "erro-recuperavel";
  if (!s.sourceRead) return "nao-registrado";
  return s.rows === 0 ? "vazio" : "pronto";
}

export interface DecisionAlert { key: string; title: string; evidence: string; action: { label: string; to: string } }

/** Alertas acionáveis: turma descoberta (bloco sem pessoa), conflito, demanda aguardando a escola. Sem score nem ranking. */
export function decisionPanel(i: { blocks: GridBlock[]; demands: Demand[]; schoolId: string }) {
  const board = scheduleBoard(i.blocks);
  const alerts: DecisionAlert[] = [];
  const uncovered = [...new Set(i.blocks.filter((b) => board.gaps.includes(b.blockId)).map((b) => b.classId))];
  for (const c of uncovered) alerts.push({ key: `descoberta:${c}`, title: "Turma com aula sem professor", evidence: `blocos sem regente: ${i.blocks.filter((b) => b.classId === c && board.gaps.includes(b.blockId)).map((b) => b.blockId).join(", ")}`, action: { label: "Pedir cobertura", to: "/gestao-escolar" } });
  for (const k of board.conflicts) alerts.push({ key: `conflito:${k.kind}:${k.blockIds.join("-")}`, title: `Conflito de ${k.kind}`, evidence: `${k.day}: ${k.blockIds.join(" × ")}`, action: { label: "Abrir horários", to: "/horarios" } });
  for (const d of i.demands.filter((x) => x.schoolId === i.schoolId)) {
    const s = currentStep(d);
    if (s === "devolucao" || s === "devolutiva") alerts.push({ key: `demanda:${d.id}`, title: s === "devolucao" ? "Demanda devolvida para complementar" : "Resposta aguardando sua confirmação", evidence: d.events.at(-1)!.note ?? "", action: { label: "Abrir demanda", to: "/gestao-escolar" } });
  }
  return alerts;
}

/** Filtros persistentes: só chaves de lista fechada sem texto livre (busca contém nomes de pessoas). */
const PERSISTABLE = new Set(["ano", "periodo", "etapa", "turma", "area", "estado"]);
export function persistableFilters(f: Record<string, string>) {
  return Object.fromEntries(Object.entries(f).filter(([k]) => PERSISTABLE.has(k)));
}

/** Busca autorizada: só sobre o que o reader já devolveu ao usuário; nunca amplia. */
export function authorizedSearch<T extends { label: string; schoolId: string }>(rows: T[], q: string, actorSchoolIds: string[]) {
  const t = q.trim().toLocaleLowerCase("pt-BR");
  if (t.length < 2) return [];
  return rows.filter((r) => actorSchoolIds.includes(r.schoolId) && r.label.toLocaleLowerCase("pt-BR").includes(t));
}

/** Rascunho: salvar só sobre a base lida; sair com alterações avisa sem prometer persistência. */
export function draftGuard(d: { baseVersion: number; currentVersion: number; dirty: boolean }) {
  if (d.currentVersion !== d.baseVersion) return { canSave: false, notice: "Outra pessoa alterou este registro. Recarregue antes de salvar." };
  return { canSave: d.dirty, leaveWarning: d.dirty ? "Há alterações ainda não salvas." : null };
}
