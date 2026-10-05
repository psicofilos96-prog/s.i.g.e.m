/**
 * B4.2.5 — Painel SOMENTE LEITURA da resolução curricular por turma/estudante.
 * Sem ações de configurar/homologar/corrigir: writers R5 existem no contrato, mas este painel segue somente leitura.
 * Só renderizado na tela institucional (sessão); nunca mistura laboratório.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { formatAcademicDate as fmt } from "@/lib/academic-date";
import { readAllocationPositions } from "./allocation-curricular-position-source";
import {
  captureKnownAt, positionDisplay, readAxisValueLabels, readClassSummary, readMatrixVersionNames, readStudentNames,
  readStudentResolutions, UNNAMED_STUDENT,
  type ClassSummary, type DescribedState, type PositionDisplay, type StudentResolution,
} from "./curricular-resolution-source";

const tone: Record<DescribedState["kind"], string> = {
  resolvido: "text-foreground", "vinculo-especifico": "text-foreground", "contexto-ok": "text-muted-foreground",
  ausente: "text-muted-foreground", "nao-registrada": "text-muted-foreground", "nao-aplicavel": "text-muted-foreground",
  bloqueada: "text-destructive", inconsistente: "text-destructive", "nao-mapeado": "text-destructive",
};
export function StateText({ s }: { s: DescribedState }) {
  return <span className={tone[s.kind]} data-state={s.id} data-kind={s.kind}>{s.text}</span>;
}

export function ClassCurricularResolutionPanel({ school, validOn, classes }: {
  school: string; validOn: string; classes: readonly { id: string; name: string }[];
}) {
  const [picked, setPicked] = useState("");
  const classId = picked || classes[0]?.id || "";
  // knownAt capturado uma vez por (turma, data): todas as leituras abaixo usam o mesmo instante
  const knownAt = useMemo(() => captureKnownAt(), [classId, validOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = { validOn, knownAt };
  const q = useQuery({
    queryKey: ["b425", school, classId, validOn, knownAt],
    enabled: Boolean(classId),
    queryFn: async () => {
      const summary = await readClassSummary(school, classId, t);
      if (summary.access === "negado") return { summary, students: [] as StudentResolution[], positions: new Map<string, PositionDisplay>(), names: new Map<string, string>(), studentNames: new Map<string, string>() };
      const [students, positions] = await Promise.all([
        readStudentResolutions(school, classId, t),
        readAllocationPositions({ school, classId }, t),
      ]);
      const ids = [...summary.matrices.map((m) => m.matrixVersionId), ...students.map((s) => s.matrixVersionId ?? ""),
        summary.specificLink?.matrixVersionId ?? ""];
      const allAxes = positions.flatMap((p) => p.position?.axes ?? []);
      const [names, studentNames, labels] = await Promise.all([
        readMatrixVersionNames(ids), readStudentNames(students.map((s) => s.studentId)), readAxisValueLabels(allAxes),
      ]);
      const pos = new Map<string, PositionDisplay>();
      for (const p of positions) if (p.position) pos.set(p.allocationId, positionDisplay(p.position.axes, labels));
      return { summary, students, positions: pos, names, studentNames };
    },
  });

  return (
    <section className="space-y-3 rounded-md border border-border p-3" aria-label="Resolução curricular da turma">
      <h3 className="font-medium">Resolução curricular (somente leitura)</h3>
      <p className="text-xs text-muted-foreground">
        Data de referência: {fmt(validOn)}. Sem configuração ou homologação vigente o sistema não conclui qual matriz se aplica — nenhum valor padrão é assumido.
      </p>
      {classes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma turma ativa nesta data.</p> : (
        <div className="space-y-1">
          <Label htmlFor="b425-class">Turma</Label>
          <select id="b425-class" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={classId} onChange={(e) => setPicked(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {q.error && <p role="alert" className="text-sm text-destructive">Leitura interrompida sem conclusão: {(q.error as Error).message}</p>}
      {q.data && <SummaryView summary={q.data.summary} students={q.data.students} positions={q.data.positions} names={q.data.names} studentNames={q.data.studentNames} />}
    </section>
  );
}

export function SummaryView({ summary, students, positions, names, studentNames = new Map() }: {
  summary: ClassSummary; students: StudentResolution[]; positions: Map<string, PositionDisplay>; names: Map<string, string>;
  studentNames?: Map<string, string>;
}) {
  if (summary.access === "negado") {
    return <p role="status" className="text-sm text-muted-foreground">Sua atuação não permite consultar os estudantes desta turma; o resumo não é exibido.</p>;
  }
  const label = (versionId: string | null) => (versionId && names.get(versionId)) || "Matriz sem nome legível";
  const s = summary;
  return (
    <div className="space-y-3 text-sm">
      <p>Situação da turma: <StateText s={s.context} /></p>
      {s.unknownKinds.length > 0 && <p role="alert" className="text-destructive">Resposta com tipo não reconhecido ({s.unknownKinds.join(", ")}); trate como não concluído.</p>}

      {s.specificLink ? (
        <div className="rounded border border-border p-2" data-testid="specific-link">
          <p className="font-medium">Vínculo específico da turma</p>
          <p className="text-xs text-muted-foreground">A matriz pertence à turma por ato específico; não é resolução individual de estudante.</p>
          <p><StateText s={s.specificLink.state} /></p>
          {s.specificLink.state.kind === "vinculo-especifico" && (
            <p>{label(s.specificLink.matrixVersionId)}{s.specificLink.columnKey ? ` · coluna ${s.specificLink.columnKey}` : ""}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2" data-testid="regular-summary">
          <p>Estudantes com matriz resolvida: {s.coverage.resolved} de {s.coverage.total} <span className="text-xs text-muted-foreground">(indicador; não bloqueia nada)</span></p>
          {s.matrices.length > 0 && (
            <ul className="list-disc pl-5" aria-label="Matrizes resolvidas na turma">
              {s.matrices.map((m) => (
                <li key={m.matrixVersionId}>{label(m.matrixVersionId)} — {m.allocationCount} estudante(s)
                  <span className="text-xs text-muted-foreground"> · colunas: {m.columnKeys.join(", ")}</span></li>
              ))}
            </ul>
          )}
          {s.unresolved.length > 0 && (
            <ul className="list-disc pl-5" aria-label="Situações não resolvidas">
              {s.unresolved.map((u) => <li key={u.state.id}><StateText s={u.state} /> — {u.count} estudante(s)</li>)}
            </ul>
          )}
        </div>
      )}

      {students.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-left"><th>Estudante</th><th>Posição curricular registrada</th><th>Resultado</th></tr></thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.allocationId} className="border-t border-border align-top">
                <td>{studentNames.get(st.studentId) ?? <span className="text-muted-foreground">{UNNAMED_STUDENT}</span>}</td>
                <td>{positions.get(st.allocationId)?.labels.join(" · ") || <span className="text-muted-foreground">Não registrada</span>}</td>
                <td>
                  <StateText s={st.state} />
                  {st.state.kind === "resolvido" && <div>{label(st.matrixVersionId)}{st.columnKey ? ` · coluna ${st.columnKey}` : ""}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <details className="text-xs text-muted-foreground">
        <summary>Detalhe técnico (auditoria)</summary>
        <p>Turma {s.classId} · validOn {s.validOn} · knownAt {s.knownAt}</p>
        {s.matrices.map((m) => <p key={m.matrixVersionId}>matriz {m.matrixId} / versão {m.matrixVersionId} / correspondências {m.correspondenceIds.join(", ")}</p>)}
        {s.specificLink?.associationId && <p>associação {s.specificLink.associationId}</p>}
        {students.map((st) => (
          <p key={st.allocationId}>alocação {st.allocationId} · estudante {st.studentId}
            {positions.get(st.allocationId) ? ` · posição ${positions.get(st.allocationId)!.technical}` : ""}</p>
        ))}
      </details>
    </div>
  );
}
