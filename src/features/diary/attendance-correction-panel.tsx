import { isDiaryCloud } from "./diary-persistence-mode";
import { recordAttendanceInCloud } from "./diary-cloud";
/**
 * 6D.1.4 — Retificação da chamada concluída.
 *
 * Projeta o `resolveAttendanceCorrection`: a tela não decide admissibilidade,
 * capacidade, marcações nem rito. Três momentos: identificar → corrigir →
 * conferir. A granularidade vem do contrato (`AttendanceRectification.changes`
 * é lista), então um mesmo ato pode reunir várias marcações; nenhuma alteração
 * sem diferença real produz nova versão.
 */
import { useMemo, useState } from "react";
import { Check, History, PencilLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatePanel } from "@/components/sigem/patterns";
import { formatAcademicDate } from "@/lib/academic-date";
import { cn } from "@/lib/utils";
import {
  attendanceSlots,
  attendanceStore,
  eligibleStudents,
  type AttendanceMark,
  type AttendanceMarks,
  type AttendanceRecord,
  type AttendanceRectification,
} from "./attendance";
import {
  attendanceCorrectionSubmissionIssues,
  resolveAttendanceCorrection,
} from "./attendance-correction";
import type { AttendanceClosingActor, PeriodAttendanceClosingRecord } from "./attendance-closing-types";
import type { LessonEntry } from "./lesson-records";

type Change = { slotKey: string; studentId: string; from: AttendanceMark | null; to: AttendanceMark };
const changeKey = (slotKey: string, studentId: string) => `${slotKey}::${studentId}`;

export function effectiveChanges(
  record: AttendanceRecord,
  pending: Record<string, AttendanceMark>,
): Change[] {
  return Object.entries(pending).flatMap(([key, to]) => {
    const [slotKey, studentId] = key.split("::") as [string, string];
    const from = record.marks[slotKey]?.[studentId] ?? null;
    return from === to ? [] : [{ slotKey, studentId, from, to }];
  });
}

export function AttendanceCorrectionPanel({
  entry,
  record,
  actor,
  operatingProfessionalId,
  closings,
}: {
  entry: LessonEntry;
  record: AttendanceRecord;
  actor: AttendanceClosingActor;
  operatingProfessionalId: string;
  closings: readonly PeriodAttendanceClosingRecord[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "review">("select");
  const [pending, setPending] = useState<Record<string, AttendanceMark>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const resolution = useMemo(
    () => resolveAttendanceCorrection({ entry, record, actor, operatingProfessionalId, closings }),
    [entry, record, actor, operatingProfessionalId, closings],
  );
  const slots = attendanceSlots(entry);
  const students = eligibleStudents(entry);
  const nameOf = (id: string) => students.find((s) => s.student.id === id)?.student.personName ?? id;
  const slotOf = (key: string) => slots.find((s) => s.key === key);
  const changes = effectiveChanges(record, pending);
  const history = attendanceStore.history(entry.id);
  const version = record.version ?? 1;

  const reset = () => {
    setPending({});
    setFocus(null);
    setJustification("");
    setStep("select");
  };

  const submit = () => {
    if (!resolution.admissible || !changes.length) return;
    const issues = changes.flatMap((c) =>
      attendanceCorrectionSubmissionIssues(resolution, { mark: c.to, justification }),
    );
    if (issues.length) return;
    const next: AttendanceMarks = Object.fromEntries(
      Object.entries(record.marks).map(([k, v]) => [k, { ...v }]),
    );
    for (const c of changes) next[c.slotKey] = { ...(next[c.slotKey] ?? {}), [c.studentId]: c.to };
    const rectification: AttendanceRectification = {
      at: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      ...(resolution.requirements.some((r) => r.code === "justificativa")
        ? { justification: justification.trim() }
        : {}),
      ...(resolution.effect.affectedClosing
        ? { closingReference: resolution.effect.affectedClosing.closingId }
        : {}),
      changes,
    };
    if (isDiaryCloud()) {
      // O banco recalcula a diferença, exige regra homologada e revalida a base.
      void recordAttendanceInCloud(entry.id, next, justification.trim()).then((saved) => {
        setDone(saved.ok ? "Correção registrada na base institucional. A chamada anterior foi preservada no histórico." : saved.message);
        if (saved.ok) {
          reset();
          setOpen(false);
        }
      });
      return;
    }
    attendanceStore.rectify(entry.id, next, rectification);
    setDone(
      changes.length === 1
        ? "Correção registrada. A chamada original foi preservada no histórico."
        : `${changes.length} correções registradas. A chamada original foi preservada no histórico.`,
    );
    reset();
    setOpen(false);
  };

  const historyBlock =
    version > 1 || history.length ? (
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          <History className="mr-1 inline size-3.5" aria-hidden />
          Histórico desta chamada · versão vigente {version}
        </summary>
        <ul className="mt-2 space-y-1">
          {history.map((h) => (
            <li key={h.version ?? 1}>Versão {h.version ?? 1} preservada</li>
          ))}
          {record.rectification ? (
            <li>
              Versão {version}: {record.rectification.changes
                .map((c) => `${nameOf(c.studentId)} ${c.from ?? "sem marcação"} → ${c.to}`)
                .join("; ")}
              {record.rectification.justification
                ? ` · Justificativa: ${record.rectification.justification}`
                : ""}
            </li>
          ) : null}
        </ul>
      </details>
    ) : null;

  if (!open)
    return (
      <section aria-label="Correção da chamada" className="space-y-2">
        {done ? (
          <p role="status" className="text-sm font-medium text-foreground">
            <Check className="mr-1 inline size-4" aria-hidden />
            {done}
          </p>
        ) : null}
        <Button variant="outline" className="min-h-11" onClick={() => { setDone(null); setOpen(true); }}>
          <PencilLine /> Corrigir chamada
        </Button>
        {historyBlock}
      </section>
    );

  if (!resolution.admissible)
    return (
      <section aria-label="Correção da chamada" className="space-y-2">
        <StatePanel
          tone="warning"
          title="Esta chamada não pode ser corrigida aqui"
          description={resolution.impediments.map((i) => i.message).join(" ")}
        />
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Por quê?</summary>
          <ul className="mt-1 list-disc pl-4">
            {resolution.impediments.map((i) => (
              <li key={i.code}>{i.provenance}</li>
            ))}
          </ul>
        </details>
        <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
          Fechar
        </Button>
      </section>
    );

  const needsJustification = resolution.requirements.some((r) => r.code === "justificativa");
  const canReview = changes.length > 0 && (!needsJustification || justification.trim().length > 0);

  return (
    <section aria-label="Correção da chamada" className="surface-panel space-y-3 p-3">
      <header>
        <h2 className="text-base font-semibold text-foreground">Corrigir chamada concluída</h2>
        <p className="text-xs text-muted-foreground">
          {step === "select"
            ? `Marcações oficiais da versão ${version}. Toque em quem precisa de correção.`
            : "Confira antes de registrar."}
        </p>
      </header>

      {step === "select" ? (
        <>
          {slots.map((slot) => (
            <div key={slot.key} className="space-y-1">
              {slots.length > 1 ? (
                <p className="text-xs font-medium text-muted-foreground">
                  {slot.label} · {slot.time}
                </p>
              ) : null}
              <ul className="divide-y rounded-md border">
                {students.map((s, index) => {
                  const key = changeKey(slot.key, s.student.id);
                  const official = record.marks[slot.key]?.[s.student.id] ?? null;
                  const chosen = pending[key];
                  const changed = chosen && chosen !== official;
                  const focused = focus === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        aria-expanded={focused}
                        onClick={() => setFocus(focused ? null : key)}
                        className={cn(
                          "flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring",
                          changed && "bg-accent/40",
                        )}
                      >
                        <span className="w-6 text-muted-foreground">{index + 1}</span>
                        <span className="flex-1 font-medium text-foreground">{s.student.personName}</span>
                        <span className="text-xs text-muted-foreground">
                          {changed ? `${official ?? "Sem marcação"} → ${chosen}` : official ?? "Sem marcação"}
                        </span>
                      </button>
                      {focused ? (
                        <div className="space-y-2 bg-muted/40 px-3 py-2">
                          <p className="text-sm">
                            Registrado: <strong>{official ?? "Sem marcação"}</strong>
                          </p>
                          <div role="group" aria-label="Alterar para" className="flex gap-2">
                            {resolution.admissibleMarks.map((mark) => (
                              <Button
                                key={mark}
                                size="sm"
                                className="min-h-11 min-w-24"
                                variant={(chosen ?? official) === mark ? "default" : "outline"}
                                aria-pressed={(chosen ?? official) === mark}
                                onClick={() =>
                                  setPending((cur) => {
                                    const next = { ...cur };
                                    if (mark === official) delete next[key];
                                    else next[key] = mark;
                                    return next;
                                  })
                                }
                              >
                                {mark}
                              </Button>
                            ))}
                          </div>
                          {!changed ? (
                            <p className="text-xs text-muted-foreground">
                              Escolher a mesma marcação não altera nada.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {resolution.requirements.map((req) =>
            req.code === "justificativa" ? (
              <label key={req.code} className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">{req.label}</span>
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                />
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Por que é pedida?</summary>
                  {req.provenance}
                </details>
              </label>
            ) : (
              <p key={req.code} className="text-sm">
                {req.label}
              </p>
            ),
          )}

          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={!canReview} onClick={() => setStep("review")}>
              Conferir correção
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => { reset(); setOpen(false); }}>
              <X /> Cancelar
            </Button>
          </div>
          {!changes.length ? (
            <p className="text-xs text-muted-foreground">Nenhuma marcação diferente da oficial.</p>
          ) : null}
        </>
      ) : (
        <>
          <ul className="space-y-2">
            {changes.map((c) => {
              const slot = slotOf(c.slotKey);
              return (
                <li key={changeKey(c.slotKey, c.studentId)} className="rounded-md border p-3">
                  <p className="font-semibold text-foreground">{nameOf(c.studentId)}</p>
                  <p className="text-sm">
                    {c.from ?? "Sem marcação"} → <strong>{c.to}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.field} · {formatAcademicDate(entry.date)}
                    {slot ? ` · ${slot.time}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
          {needsJustification ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Justificativa: </span>
              {justification.trim()}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            A chamada passa à versão {resolution.effect.nextVersion}; a versão {version} continua no
            histórico.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" onClick={submit}>
              <Check /> Registrar correção
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setStep("select")}>
              Voltar
            </Button>
          </div>
        </>
      )}
      {historyBlock}
    </section>
  );
}
