/** Papéis e fontes da formatação antiga; lida como herança por `calendar-layout.ts`. */
import type { CalendarTextRole } from "./calendar-types";

export const TEXT_ROLES: Array<{ role: CalendarTextRole; label: string; selectors: string[] }> = [
  { role: "cabecalho", label: "Cabeçalho (linhas institucionais)", selectors: [".cd-linha1", ".cd-linha2", ".cd-linha3"] },
  { role: "titulo", label: "Título do calendário", selectors: [".cd-linha4"] },
  { role: "gradeCabecalho", label: "Cabeçalho da grade (dias 1 a 31)", selectors: [".cd-grade thead th"] },
  { role: "meses", label: "Nomes dos meses", selectors: [".cd-grade td.cd-mes"] },
  { role: "dias", label: "Dias da grade", selectors: [".cd-grade td.cd-dia", ".cd-grade td.cd-ferias"] },
  { role: "totais", label: "Totais e faixas", selectors: [".cd-grade td.cd-total", ".cd-grade tr.cd-faixa td"] },
  { role: "legenda", label: "Legenda", selectors: [".cd-rodape h4", ".cd-legenda-linha > :last-child", ".cd-chip"] },
  { role: "feriados", label: "Feriados", selectors: [".cd-feriado-linha", ".cd-feriado-nome"] },
  { role: "periodos", label: "Períodos e total", selectors: [".cd-periodos", ".cd-periodos .cd-periodo-linha"] },
  { role: "conselhos", label: "Conselhos de Classe", selectors: [".cd-conselhos", ".cd-conselho-linha", ".cd-conselho-linha b"] },
  { role: "informacoes", label: "Informações adicionais", selectors: [".cd-info-linha", ".cd-info-linha span"] },
  { role: "assinaturas", label: "Assinaturas", selectors: [".cd-assinatura-rotulo"] },
];

export const FONT_OPTIONS = [
  { value: "", label: "Padrão do modelo" },
  { value: "Calibri, Carlito, sans-serif", label: "Calibri" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Courier New', monospace", label: "Courier New" },
];
