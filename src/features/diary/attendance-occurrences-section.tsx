/**
 * 6D.FINAL.6 — ocorrências de frequência na sessão institucional.
 * A seção só apresenta a fonte persistida e coleta o registro; tipos vêm do
 * catálogo homologado e a autorização é revalidada no banco.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDate } from "@/lib/academic-date";
import type { useCloudAttendanceOccurrences } from "./attendance-occurrences-cloud";

const inputCls =
  "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function AttendanceOccurrencesSection({
  source,
  students,
  canRegister,
}: {
  source: ReturnType<typeof useCloudAttendanceOccurrences>;
  students: { id: string; name: string }[];
  canRegister: boolean;
}) {
  const [studentId, setStudentId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const name = (id: string) => students.find((s) => s.id === id)?.name ?? "Estudante sem nome disponível";
  const typeLabel = (id: string) => source.types.find((t) => t.id === id)?.label ?? "Tipo não vigente";

  const submit = async () => {
    if (!studentId || !typeId || !from || !until) {
      setFeedback({ ok: false, text: "Informe estudante, tipo e intervalo de datas." });
      return;
    }
    const result = await source.register({ studentId, typeId, from, until, documentRef });
    setFeedback(result.ok ? { ok: true, text: "Ocorrência registrada." } : { ok: false, text: result.reasons.join(" ") });
  };

  return (
    <section aria-label="Ocorrências de frequência" className="min-w-0 space-y-3 rounded-md border border-border/70 p-4">
      <h2 className="font-display text-lg font-semibold text-foreground">Ocorrências de frequência</h2>
      <p className="text-sm text-muted-foreground">
        Ocorrências do prontuário são apenas referenciadas pela frequência: não se tornam falta, presença, nota nem situação.
      </p>
      {source.occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada para esta turma.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {source.occurrences.map((o) => (
            <li key={o.versionId} className="min-w-0">
              <span className="font-medium text-foreground">{name(o.studentId)}</span> · {typeLabel(o.occurrenceTypeId)} ·{" "}
              {formatAcademicDate(o.from)} a {formatAcademicDate(o.until)}
              {o.documentRef ? ` · documento ${o.documentRef}` : ""}
            </li>
          ))}
        </ul>
      )}
      {!canRegister ? null : source.types.length === 0 ? (
        <StatePanel
          tone="warning"
          title="Registro indisponível"
          description="Nenhum tipo de ocorrência de frequência está homologado e vigente. Nenhum tipo demonstrativo é usado no lugar."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Estudante
            <select className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Selecione</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Tipo homologado
            <select className={inputCls} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">Selecione</option>
              {source.types.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            De
            <DateInput className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Até
            <DateInput className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Referência do documento (quando o tipo exigir)
            <input className={inputCls} value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <Button size="sm" onClick={() => void submit()}>Registrar ocorrência</Button>
          </div>
        </div>
      )}
      {feedback ? (
        <StatePanel tone={feedback.ok ? "success" : "danger"} title={feedback.ok ? "Registrado" : "Não registrado"} description={feedback.text} />
      ) : null}
    </section>
  );
}
