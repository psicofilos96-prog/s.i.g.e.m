/** Reclassificação/avanço (LDB art. 23 §1º): cadeia fixa de etapas registradas pela Direção. O despacho não muda a matrícula. */
export const RECLASS_STEPS = ["abertura", "comissao", "avaliacao", "ata", "despacho"] as const;
export type ReclassStep = (typeof RECLASS_STEPS)[number];
export const STEP_LABEL: Record<ReclassStep, string> = {
  abertura: "Abertura do processo", comissao: "Comissão examinadora", avaliacao: "Avaliação diagnóstica",
  ata: "Ata circunstanciada", despacho: "Despacho da Direção",
};
export type StepRow = { process_id: string; seq: number; step: ReclassStep; student_id: string; student_name: string; kind: string; content: string; outcome: string | null; recorded_at: string };
export type Process = { id: string; studentName: string; kind: string; steps: StepRow[]; next: ReclassStep | null };

export function processes(rows: StepRow[]): Process[] {
  const m = new Map<string, StepRow[]>();
  for (const r of rows) m.set(r.process_id, [...(m.get(r.process_id) ?? []), r]);
  return [...m.entries()].map(([id, s]) => {
    const steps = [...s].sort((a, b) => a.seq - b.seq);
    return { id, studentName: steps[0]!.student_name, kind: steps[0]!.kind, steps, next: nextStep(steps.length) };
  });
}
export const nextStep = (done: number): ReclassStep | null => RECLASS_STEPS[done] ?? null;

export function stepProblems(step: ReclassStep, content: string, outcome: string | null): string[] {
  const p: string[] = [];
  if (content.trim().length < 3) p.push("Descreva o registro desta etapa.");
  if (step === "despacho" && outcome !== "deferido" && outcome !== "indeferido") p.push("Escolha deferido ou indeferido.");
  return p;
}
