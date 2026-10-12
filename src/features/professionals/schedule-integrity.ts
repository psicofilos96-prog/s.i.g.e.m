/**
 * Gestão de Pessoas L13 — Integração com horários oficiais.
 * Reusa `findConflicts` (NHOR.2) sobre blocos REGISTRADOS e acrescenta:
 * pessoa em duas escolas ao mesmo tempo, jornada excedida, componente
 * conflitante, indisponibilidade (afastamento) e aula sem cobertura.
 * Cada achado traz evidência (IDs) e orientação de resolução apontando a etapa
 * competente; nada é corrigido automaticamente.
 */
import { findConflicts, type GridBlock } from "@/features/schedules/schedule-conflicts";

export type OfficialBlock = GridBlock & Readonly<{ schoolId: string; componentId: string | null; minutes: number }>;
export type Unavailability = Readonly<{ personId: string; from: string; until: string | null; leaveId: string; operationalImpact: "total" | "parcial" | "sem-impacto" }>;

export type FindingKind =
  | "duas-escolas-mesmo-horario" | "pessoa-mesmo-horario" | "turma-mesmo-horario" | "componente-conflitante"
  | "jornada-excedida" | "jornada-indeterminada" | "aula-durante-indisponibilidade" | "aula-sem-cobertura";

export type Finding = Readonly<{ kind: FindingKind; subject: string; evidence: readonly string[]; guidance: string }>;

export const GUIDANCE: Readonly<Record<FindingKind, string>> = {
  "duas-escolas-mesmo-horario": "Conferir os dois horários com as Direções e propor ajuste de grade ou de atribuição (etapa de proposta).",
  "pessoa-mesmo-horario": "Rever a atribuição de um dos blocos pela etapa de proposta/análise.",
  "turma-mesmo-horario": "Corrigir a grade da turma em Horários (writer da grade).",
  "componente-conflitante": "O bloco tem componente diferente da regência; conferir grade e atribuição.",
  "jornada-excedida": "Comparar a carga em horário com a jornada contratual; propor redistribuição.",
  "jornada-indeterminada": "Registrar a jornada contratual ou a regra de duração para permitir a verificação.",
  "aula-durante-indisponibilidade": "Abrir processo de substituição a partir do afastamento registrado.",
  "aula-sem-cobertura": "Propor atribuição ou substituição para o bloco descoberto.",
};

const f = (kind: FindingKind, subject: string, evidence: readonly string[]): Finding => ({ kind, subject, evidence, guidance: GUIDANCE[kind] });

export type IntegrityInput = Readonly<{
  blocks: readonly OfficialBlock[];
  regencyComponent: (personId: string, classId: string) => string | null | undefined; // undefined = sem regência
  contractualMinutes: (personId: string) => number | null;
  unavailability: readonly Unavailability[];
  weekOf: string; // data de referência para afastamentos
}>;

export function scheduleFindings(i: IntegrityInput): Finding[] {
  const out: Finding[] = [];
  const byId = new Map(i.blocks.map((b) => [b.blockId, b]));
  for (const c of findConflicts(i.blocks)) {
    if (c.kind === "turma") out.push(f("turma-mesmo-horario", c.key, c.blockIds));
    if (c.kind === "pessoa") {
      const [a, b] = c.blockIds.map((id) => byId.get(id)!);
      out.push(f(a!.schoolId !== b!.schoolId ? "duas-escolas-mesmo-horario" : "pessoa-mesmo-horario", c.key, c.blockIds));
    }
  }
  const minutes = new Map<string, { sum: number; ids: string[] }>();
  for (const b of i.blocks) {
    if (b.personIds.length === 0) { out.push(f("aula-sem-cobertura", b.classId, [b.blockId])); continue; }
    for (const p of b.personIds) {
      const reg = i.regencyComponent(p, b.classId);
      if (b.componentId && reg !== undefined && reg !== null && reg !== b.componentId) out.push(f("componente-conflitante", p, [b.blockId]));
      const m = minutes.get(p) ?? { sum: 0, ids: [] };
      m.sum += b.minutes; m.ids.push(b.blockId); minutes.set(p, m);
      const un = i.unavailability.find((u) => u.personId === p && u.operationalImpact === "total" && u.from <= i.weekOf && (u.until === null || u.until >= i.weekOf));
      if (un) out.push(f("aula-durante-indisponibilidade", p, [b.blockId, un.leaveId]));
    }
  }
  for (const [p, m] of minutes) {
    const c = i.contractualMinutes(p);
    if (c === null) out.push(f("jornada-indeterminada", p, m.ids));
    else if (m.sum > c) out.push(f("jornada-excedida", p, m.ids));
  }
  return out;
}

/** Resumo por tipo; nenhuma ação automática é oferecida. */
export const summarize = (fs: readonly Finding[]) => fs.reduce<Record<string, number>>((a, x) => ({ ...a, [x.kind]: (a[x.kind] ?? 0) + 1 }), {});
