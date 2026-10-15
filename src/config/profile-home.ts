/**
 * Início simples: catálogo único de atalhos, em ordem de prioridade.
 * Cada conta vê só os atalhos que `pathAllowed` libera (a autoridade decide, nunca o cargo):
 * os 6 primeiros viram botões grandes; o resto fica em "Mais".
 */
import type { LucideIcon } from "lucide-react";
import {
  BookOpenText, CalendarDays, ClipboardCheck, ClipboardList, FileBarChart2, FileText, GraduationCap,
  HandHeart, LineChart, ListChecks, Map, NotebookPen, School, Soup, Truck, Users, UserPlus, ArrowLeftRight, Eye, BarChart3,
} from "lucide-react";

export type HomeAction = { to: string; label: string; icon: LucideIcon };

export const HOME_MAX_PRIMARY = 6;

export const HOME_ACTIONS: readonly HomeAction[] = [
  // Professor
  { to: "/diario/turmas", label: "Minhas turmas", icon: BookOpenText },
  { to: "/diario/chamadas", label: "Chamada", icon: ClipboardCheck },
  { to: "/diario/registrar", label: "Conteúdo", icon: NotebookPen },
  { to: "/planejamento", label: "Planejamento", icon: ClipboardList },
  { to: "/avaliacoes-do-professor", label: "Prova", icon: FileText },
  { to: "/meus-diarios", label: "Meu diário", icon: BookOpenText },
  // Secretaria
  { to: "/mapa-estatistico", label: "Mapa estatístico", icon: Map },
  { to: "/matriculas", label: "Matricular", icon: UserPlus },
  { to: "/transferencias", label: "Transferir", icon: ArrowLeftRight },
  { to: "/alunos", label: "Alunos", icon: GraduationCap },
  { to: "/turmas", label: "Turmas", icon: School },
  { to: "/documentos-escolares", label: "Documentos", icon: FileText },
  // Direção / OP / Supervisão
  { to: "/gestao-escolar", label: "Minha escola", icon: School },
  { to: "/orientacao", label: "Orientação", icon: Eye },
  { to: "/acompanhamento-planejamento", label: "Planejamentos", icon: ListChecks },
  { to: "/supervisao-escolar", label: "Escolas", icon: Eye },
  { to: "/calendario-escolar", label: "Calendário", icon: CalendarDays },
  // Mediador
  { to: "/mediador", label: "Mediação", icon: HandHeart },
  // CIECE / Avaliação
  { to: "/ciece", label: "Estatística", icon: BarChart3 },
  { to: "/mapa-estatistico-rede", label: "Mapas da rede", icon: Map },
  { to: "/censo-escolar", label: "Censo escolar", icon: FileBarChart2 },
  { to: "/acompanhamento-avaliacao", label: "Avaliações", icon: LineChart },
  { to: "/avaliacao-desempenho", label: "Desempenho", icon: LineChart },
  // Alimentação / Transporte / Pessoas
  { to: "/alimentacao-escolar", label: "Alimentação", icon: Soup },
  { to: "/alimentacao-escolar/cozinha", label: "Cozinhas", icon: Soup },
  { to: "/transporte-escolar", label: "Transporte", icon: Truck },
  { to: "/profissionais", label: "Servidores", icon: Users },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
];

/** Cartão de abertura de cada setor (só apresentação; a autoridade continua decidindo). */
export const SECTOR_HOME_ACTION: Record<string, HomeAction> = {
  secretaria_escolar: { to: "/secretaria", label: "Secretaria", icon: ClipboardList },
  direcao_escolar: { to: "/direcao", label: "Direção", icon: School },
  orientacao_pedagogica: { to: "/orientacao", label: "Orientação", icon: Eye },
  supervisao: { to: "/supervisao-escolar", label: "Escolas", icon: Eye },
  ciece: { to: "/ciece", label: "Estatística", icon: BarChart3 },
  alimentacao: { to: "/alimentacao-escolar", label: "Alimentação", icon: Soup },
  avaliacao: { to: "/avaliacao-desempenho", label: "Desempenho", icon: LineChart },
  inclusao_nei: { to: "/inclusao", label: "Inclusão", icon: HandHeart },
};

/**
 * Atalhos liberados, divididos em principais (até 6) e "Mais".
 * Com setor conhecido, o cartão do setor vem primeiro e os atalhos das rotas do setor vêm antes dos demais.
 */
export function homeActionsFor(
  allowed: (path: string) => boolean,
  sector?: { station: string; routes: readonly string[] } | null,
): { primary: HomeAction[]; more: HomeAction[] } {
  const seen = new Set<string>();
  const head = sector ? SECTOR_HOME_ACTION[sector.station] : undefined;
  const ordered = head ? [head, ...HOME_ACTIONS] : [...HOME_ACTIONS];
  let list = ordered.filter((a) => !seen.has(a.to) && allowed(a.to) && seen.add(a.to));
  if (sector) {
    const own = (to: string) => sector.routes.some((r) => to === r || to.startsWith(`${r}/`));
    list = [...list.filter((a) => own(a.to)), ...list.filter((a) => !own(a.to))];
  }
  return { primary: list.slice(0, HOME_MAX_PRIMARY), more: list.slice(HOME_MAX_PRIMARY) };
}
