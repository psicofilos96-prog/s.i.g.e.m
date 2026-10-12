/**
 * L21 — modelo puro da tela de Gestão de Pessoas. Indicadores só de fontes
 * lidas (registro funcional + projeção do quadro docente); fonte não lida ⇒ null.
 * Fixture/protótipo é recusado: `origin` diferente de "institucional" não
 * produz indicador.
 */
import type { PersonPicture } from "./functional-life";
import type { ClassResult } from "@/features/staffing/staffing-model";

export type Origin = "institucional" | "demonstracao";

export type Indicator = Readonly<{ id: string; label: string; value: number | null; note: string | null }>;
export type Alert = Readonly<{ id: string; kind: "exercicio-sem-lotacao" | "aulas-descobertas" | "grade-ilegivel" | "sem-atuacao"; text: string; ref: string }>;

const vigentLinks = (p: PersonPicture) => p.links.filter((l) => l.validity === "vigente");
const vigentPostings = (p: PersonPicture) => p.links.flatMap((l) => l.postings.filter((x) => x.validity === "vigente"));

export function dashboard(origin: Origin, people: readonly PersonPicture[] | null, classes: readonly ClassResult[] | null): { indicators: Indicator[]; alerts: Alert[]; refused: boolean } {
  if (origin !== "institucional") return { indicators: [], alerts: [], refused: true };
  const pp = people;
  const unread = (label: string) => `${label} não pôde ser lido.`;
  const complete = classes !== null && classes.every((c) => c.state === "ok" || c.state === "sem-grade");
  const lessons = classes && complete ? classes.reduce((t, c) => t + c.cells.reduce((u, x) => u + x.lessons, 0), 0) : null;
  const uncovered = classes && complete ? classes.reduce((t, c) => t + c.cells.filter((x) => x.uncoveredMinutes != null && x.uncoveredMinutes > 0).length, 0) : null;
  const indicators: Indicator[] = [
    { id: "pessoas", label: "Pessoas com vínculo na escola", value: pp ? pp.length : null, note: pp ? null : unread("Registro funcional") },
    { id: "vinculos", label: "Vínculos vigentes", value: pp ? pp.reduce((t, p) => t + vigentLinks(p).length, 0) : null, note: pp ? null : unread("Registro funcional") },
    { id: "lotacoes", label: "Lotações vigentes", value: pp ? pp.reduce((t, p) => t + vigentPostings(p).length, 0) : null, note: pp ? null : unread("Registro funcional") },
    { id: "exercicio-sem-lotacao", label: "Exercício sem lotação vigente", value: pp ? pp.reduce((t, p) => t + p.exerciseWithoutPosting.length, 0) : null, note: pp ? "Divergência a conferir, não erro presumido." : unread("Registro funcional") },
    { id: "turmas", label: "Turmas lidas", value: classes ? classes.length : null, note: classes ? null : unread("Quadro docente") },
    { id: "aulas", label: "Aulas ofertadas por semana", value: lessons, note: lessons === null ? "Total não fechado: há turma sem leitura." : null },
    { id: "componentes-descobertos", label: "Componentes com aula descoberta", value: uncovered, note: uncovered === null ? "Total não fechado: há turma sem leitura." : null },
  ];
  const alerts: Alert[] = [
    ...(pp ?? []).flatMap((p) => p.exerciseWithoutPosting.map((l) => ({ id: `esl:${l}`, kind: "exercicio-sem-lotacao" as const, text: "Exercício vigente sem lotação vigente do mesmo vínculo.", ref: p.personId }))),
    ...(pp ?? []).filter((p) => vigentLinks(p).length && !p.engagements.length).map((p) => ({ id: `sa:${p.personId}`, kind: "sem-atuacao" as const, text: "Vínculo vigente sem atuação no SIGEM (sem acesso por esta escola).", ref: p.personId })),
    ...(classes ?? []).filter((c) => c.state === "grade-ilegivel" || c.state === "regencia-ilegivel").map((c) => ({ id: `gi:${c.classId}`, kind: "grade-ilegivel" as const, text: "Grade ou regência da turma não pôde ser lida.", ref: c.classId })),
    ...(classes ?? []).flatMap((c) => c.cells.filter((x) => (x.uncoveredMinutes ?? 0) > 0).map((x) => ({ id: `ad:${c.classId}:${x.componentId}`, kind: "aulas-descobertas" as const, text: `Aulas sem regência em ${x.componentId ?? "componente não informado"}.`, ref: c.classId }))),
  ];
  return { indicators, alerts, refused: false };
}

export type RosterFilter = Readonly<{ text: string; situation: "todos" | "vigente" | "sem-lotacao" | "sem-atuacao" }>;

export function filterRoster(people: readonly PersonPicture[], names: ReadonlyMap<string, string>, f: RosterFilter): PersonPicture[] {
  const q = f.text.trim().toLocaleLowerCase("pt-BR");
  return people.filter((p) => {
    if (q && !(names.get(p.personId) ?? "").toLocaleLowerCase("pt-BR").includes(q)) return false;
    if (f.situation === "vigente") return vigentLinks(p).length > 0;
    if (f.situation === "sem-lotacao") return vigentPostings(p).length === 0;
    if (f.situation === "sem-atuacao") return p.engagements.length === 0;
    return true;
  });
}

export type CoverageCell = Readonly<{ classId: string; label: string; componentId: string | null; lessons: number; state: "integral" | "parcial" | "ausente" | "indeterminada" }>;

export function coverageGrid(classes: readonly ClassResult[]): CoverageCell[] {
  return classes.flatMap((c) => c.cells.map((x): CoverageCell => {
    const state: CoverageCell["state"] = c.state !== "ok" || x.coveredMinutes == null || x.uncoveredMinutes == null ? "indeterminada"
      : x.uncoveredMinutes === 0 ? "integral" : x.coveredMinutes === 0 ? "ausente" : "parcial";
    return { classId: c.classId, label: c.label ?? "Turma sem nome declarado", componentId: x.componentId, lessons: x.lessons, state };
  }));
}
