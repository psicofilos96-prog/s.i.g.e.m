import type { ExpectedLesson } from "./diary-oversight";

/** Bloco publicado da grade (class_schedule_at). Só blocos utilizáveis geram aula prevista. */
export type ScheduleBlock = Readonly<{ class_id: string; weekday: number | null; component_id: string | null; block_state: string | null;
  valid_from: string | null; effective_until: string | null; engagement_ids: string[] | null }>;

/** Expande a grade semanal em aulas previstas por data; casamento com o registro por turma+data+componente.
 * Sem grade publicada ⇒ lista vazia (nada é faltante). Nunca infere aula por carga horária. */
export function expandSchedule(blocks: readonly ScheduleBlock[], from: string, to: string): ExpectedLesson[] {
  const out = new Map<string, ExpectedLesson>();
  const usable = blocks.filter((b) => b.weekday !== null && b.component_id && b.block_state === "utilizavel");
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10); const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    for (const b of usable) {
      if (b.weekday !== wd) continue;
      if (b.valid_from && iso < b.valid_from) continue;
      if (b.effective_until && iso > b.effective_until) continue;
      const k = `${b.class_id}|${iso}|${b.component_id}`;
      if (!out.has(k)) out.set(k, { classId: b.class_id, date: iso, slotId: b.component_id!, teacherEngagementId: b.engagement_ids?.[0] ?? null });
    }
  }
  return [...out.values()];
}
