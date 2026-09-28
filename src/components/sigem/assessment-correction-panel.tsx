/**
 * 6D.3.2.4 — Correção Focal de Resultado Avaliativo.
 *
 * Pergunta central: "O que precisa ser corrigido neste resultado?"
 * Jornada: vigente → correção → conferência (Antes/Depois) → registro → histórico.
 *
 * - O painel não conhece "nota", "conceito" nem "parecer": naturezas, valores
 *   admissíveis, rito e impedimentos vêm de `resolveAssessmentCorrection`.
 * - "Não registrado" é o `EntryValue` canônico `nao-registrado`, com motivo da
 *   política projetada — nunca apagamento nem `undefined`.
 * - No registro a fonte é relida: se a versão vigente mudou, falha fechada,
 *   sem bifurcação da cadeia.
 * - Histórico derivado de `assessmentEntryHistory`, nunca estado paralelo.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  rectifyAssessmentEntry,
  resolveAssessmentCorrection,
  type AdmissibleAssessmentValues,
  type AssessmentCorrectionInput,
  type AssessmentCorrectionProjection,
} from "@/features/assessment/assessment-correction";
import {
  assessmentEntryHistory,
  currentAssessmentEntryVersion,
  sameAssessmentValue,
  type AssessmentEntryVersion,
} from "@/features/assessment/assessment-entry-versions";
import type { MissingEntryPolicyProjection } from "@/features/assessment/assessment-entry-projection";
import type { EntryValue } from "@/features/assessment/assessment-types";
import { formatDateTime } from "@/lib/academic-date";

export type AssessmentCorrectionFactSource = {
  readVersions: () => readonly AssessmentEntryVersion[];
  append: (version: AssessmentEntryVersion) => void;
};

export type AssessmentCorrectionPanelContext = Omit<
  AssessmentCorrectionInput,
  "baseVersionId" | "versions"
>;

type Phase =
  | { kind: "idle" }
  | { kind: "editing"; baseVersionId: string }
  | { kind: "review"; baseVersionId: string; next: EntryValue }
  | { kind: "conflict" }
  | { kind: "success"; version: number };

const SEMANTIC_LABEL: Record<EntryValue["kind"], string> = {
  numerica: "Valor",
  conceitual: "Escolha na escala",
  descritiva: "Registro descritivo",
  "nao-registrado": "Não registrado",
};

export function correctionValueLabel(
  value: EntryValue,
  admissible: readonly AdmissibleAssessmentValues[],
  storedLabel?: string,
): string {
  if (value.kind === "numerica") return String(value.value).replace(".", ",");
  if (value.kind === "conceitual") {
    const scale = admissible.find((item) => item.kind === "conceitual");
    const option =
      scale && scale.kind === "conceitual"
        ? scale.options.find((item) => item.id === value.optionId)
        : undefined;
    return option?.label ?? storedLabel ?? "Opção sem rótulo declarado";
  }
  if (value.kind === "descritiva") return value.text;
  return value.reason ? `Não registrado · ${value.reason}` : "Não registrado";
}

function parseNumeric(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

export function AssessmentCorrectionPanel({
  studentName,
  instrumentLabel,
  logicalEntryId,
  source,
  context,
  missingEntryPolicy,
  newVersionId,
  now = () => new Date().toISOString(),
}: {
  studentName: string;
  instrumentLabel: string;
  logicalEntryId: string;
  source: AssessmentCorrectionFactSource;
  context: AssessmentCorrectionPanelContext;
  missingEntryPolicy?: MissingEntryPolicyProjection;
  newVersionId: (base: AssessmentEntryVersion) => string;
  now?: () => string;
}) {
  const [revision, setRevision] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [showHistory, setShowHistory] = useState(false);
  const [raw, setRaw] = useState("");
  const [kind, setKind] = useState<EntryValue["kind"] | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [justification, setJustification] = useState("");
  const [satisfied, setSatisfied] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);

  // Fatos relidos a cada reprojeção; nunca promovidos do estado React.
  const versions = useMemo(
    () => source.readVersions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, source],
  );
  const current = currentAssessmentEntryVersion(versions, logicalEntryId);
  const history = assessmentEntryHistory(versions, logicalEntryId);

  const baseId =
    phase.kind === "editing" || phase.kind === "review" ? phase.baseVersionId : current?.id;
  const projection: AssessmentCorrectionProjection | null = baseId
    ? resolveAssessmentCorrection({ ...context, versions, baseVersionId: baseId })
    : null;
  const admissible = projection?.admissibleValues ?? [];
  const valueKinds = (projection?.admissibleValueKinds ?? []).filter((k) => k !== "nao-registrado");
  const allowsMissing = projection?.admissibleValueKinds.includes("nao-registrado") ?? false;
  const activeKind = kind ?? valueKinds.find((k) => k === current?.value.kind) ?? valueKinds[0] ?? null;

  function resetEditor() {
    setRaw(""); setKind(null); setOptionId(null); setReason("");
    setJustification(""); setSatisfied([]); setIssues([]);
  }

  function open() {
    if (!current) return;
    resetEditor();
    if (current.value.kind === "numerica") setRaw(String(current.value.value).replace(".", ","));
    if (current.value.kind === "descritiva") setRaw(current.value.text);
    if (current.value.kind === "conceitual") setOptionId(current.value.optionId);
    setShowHistory(false);
    setPhase({ kind: "editing", baseVersionId: current.id });
  }

  function candidate(): EntryValue | null {
    if (activeKind === "nao-registrado") return reason.trim() ? { kind: "nao-registrado", reason: reason.trim() } : null;
    if (activeKind === "numerica") {
      const n = parseNumeric(raw);
      return n === null ? null : { kind: "numerica", value: n };
    }
    if (activeKind === "conceitual") return optionId ? { kind: "conceitual", optionId } : null;
    if (activeKind === "descritiva") return raw.trim() ? { kind: "descritiva", text: raw } : null;
    return null;
  }

  const next = phase.kind === "editing" ? candidate() : null;
  const unchanged = !!(next && current && sameAssessmentValue(current.value, next));
  const ritualMet = (projection?.requiredRitual ?? []).every((item) =>
    item.code === "justificativa" ? justification.trim().length > 0 : satisfied.includes(item.code),
  );

  function register() {
    if (phase.kind !== "review") return;
    // Relê a fonte: a vigência pode ter mudado noutra sessão.
    const fresh = source.readVersions();
    const freshCurrent = currentAssessmentEntryVersion(fresh, logicalEntryId);
    if (!freshCurrent || freshCurrent.id !== phase.baseVersionId) {
      setPhase({ kind: "conflict" });
      setRevision((r) => r + 1);
      return;
    }
    const attempt = rectifyAssessmentEntry({
      correction: { ...context, versions: fresh, baseVersionId: phase.baseVersionId },
      submission: {
        value: phase.next,
        valueLabel: correctionValueLabel(phase.next, admissible),
        ...(justification.trim() ? { justification } : {}),
        satisfiedRequirementCodes: satisfied,
      },
      versionId: newVersionId(freshCurrent),
      now: now(),
    });
    if (!attempt.registered) {
      setIssues([...attempt.issues]);
      return;
    }
    source.append(attempt.version);
    resetEditor();
    setPhase({ kind: "success", version: attempt.version.version });
    setRevision((r) => r + 1);
  }

  if (!current)
    return (
      <section aria-label="Correção do resultado" className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Não há resultado registrado para corrigir.</p>
      </section>
    );

  const currentLabel = correctionValueLabel(current.value, admissible, current.valueLabel);

  return (
    <section aria-label="Correção do resultado" className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{instrumentLabel}</p>
        <h2 className="text-lg font-semibold text-foreground">{studentName}</h2>
        <p className="text-2xl font-semibold text-foreground" data-testid="resultado-vigente">{currentLabel}</p>
        <p className="text-sm text-muted-foreground">
          Registrado em {formatDateTime(current.recordedAt)} · versão {current.version}
        </p>
      </header>

      {phase.kind === "success" && (
        <div role="status" className="rounded-xl border border-border bg-muted p-3 text-sm">
          Resultado corrigido. O registro anterior permanece no histórico. Versão vigente: {phase.version}.
        </div>
      )}
      {phase.kind === "conflict" && (
        <div role="alert" className="space-y-1 rounded-xl border border-destructive p-3 text-sm">
          <p className="font-medium">Este resultado mudou enquanto você fazia a correção.</p>
          <p>Nenhuma correção foi registrada. Veja o resultado vigente antes de continuar.</p>
        </div>
      )}

      {(phase.kind === "idle" || phase.kind === "success" || phase.kind === "conflict") && (
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={open}>Corrigir resultado</Button>
          <Button variant="outline" className="min-h-11" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
            Ver histórico deste resultado
          </Button>
        </div>
      )}

      {phase.kind === "editing" && projection && !projection.canCorrect && (
        <div role="alert" className="space-y-2 rounded-xl border border-border p-4">
          <p className="font-medium">Este resultado não pode ser corrigido aqui.</p>
          {projection.disclosableReasons.map((item) => (
            <p key={item.code} className="text-sm text-muted-foreground">{item.message}</p>
          ))}
          <Button variant="outline" className="min-h-11" onClick={() => setPhase({ kind: "idle" })}>Voltar</Button>
        </div>
      )}

      {phase.kind === "editing" && projection?.canCorrect && (
        <div className="space-y-4">
          <h3 className="font-semibold">O que precisa ser corrigido?</h3>
          <p className="text-sm">Resultado registrado: <strong>{currentLabel}</strong></p>

          {valueKinds.length + (allowsMissing ? 1 : 0) > 1 && (
            <div role="group" aria-label="Forma do novo resultado" className="flex flex-wrap gap-2">
              {[...valueKinds, ...(allowsMissing ? (["nao-registrado"] as const) : [])].map((k) => (
                <Button key={k} variant={activeKind === k ? "default" : "outline"} className="min-h-11"
                  aria-pressed={activeKind === k} onClick={() => setKind(k)}>
                  {SEMANTIC_LABEL[k]}
                </Button>
              ))}
            </div>
          )}

          {activeKind === "numerica" && (() => {
            const scale = admissible.find((a) => a.kind === "numerica");
            return (
              <label className="block space-y-1 text-sm">
                <span>Novo resultado{scale && scale.kind === "numerica" ? ` (de ${scale.min} a ${scale.max})` : ""}</span>
                <Input inputMode="decimal" className="min-h-11 max-w-40" value={raw} onChange={(e) => setRaw(e.target.value)} />
              </label>
            );
          })()}
          {activeKind === "conceitual" && (() => {
            const scale = admissible.find((a) => a.kind === "conceitual");
            return (
              <div role="radiogroup" aria-label="Novo resultado" className="flex flex-wrap gap-2">
                {scale && scale.kind === "conceitual" && scale.options.map((o) => (
                  <Button key={o.id} role="radio" aria-checked={optionId === o.id} className="min-h-11"
                    variant={optionId === o.id ? "default" : "outline"} onClick={() => setOptionId(o.id)}>
                    {o.label}
                  </Button>
                ))}
              </div>
            );
          })()}
          {activeKind === "descritiva" && (
            <label className="block space-y-1 text-sm">
              <span>Novo registro</span>
              <Textarea rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} />
            </label>
          )}
          {activeKind === "nao-registrado" && (
            <div className="space-y-2 text-sm">
              <p>Motivo do não registro</p>
              <div className="flex flex-wrap gap-2">
                {(missingEntryPolicy?.admissibleReasons ?? []).map((r) => (
                  <Button key={r.id} variant={reason === r.label ? "default" : "outline"} className="min-h-11"
                    aria-pressed={reason === r.label} onClick={() => setReason(r.label)}>
                    {r.label}
                  </Button>
                ))}
              </div>
              {(missingEntryPolicy?.allowsCustomReason ?? true) && (
                <label className="block space-y-1">
                  <span>Descreva o motivo</span>
                  <Input className="min-h-11" value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
              )}
            </div>
          )}

          {projection.requiredRitual.map((item) =>
            item.code === "justificativa" ? (
              <label key={item.code} className="block space-y-1 text-sm">
                <span>{item.label}</span>
                <Textarea aria-label={item.label} rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} />
                <span className="text-xs text-muted-foreground">{item.provenance}</span>
              </label>
            ) : (
              <label key={item.code} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={satisfied.includes(item.code)}
                  onChange={(e) => setSatisfied((s) => e.target.checked ? [...s, item.code] : s.filter((c) => c !== item.code))} />
                {item.label}
              </label>
            ),
          )}

          {unchanged && <p className="text-sm text-muted-foreground">O novo resultado é igual ao registrado.</p>}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={!next || unchanged || !ritualMet}
              onClick={() => next && setPhase({ kind: "review", baseVersionId: phase.baseVersionId, next })}>
              Conferir correção
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setPhase({ kind: "idle" })}>Cancelar</Button>
          </div>
        </div>
      )}

      {phase.kind === "review" && (
        <div className="space-y-4">
          <h3 className="font-semibold">Conferência</h3>
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4">
            <div><dt className="text-sm text-muted-foreground">Antes</dt><dd data-testid="antes">{currentLabel}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Depois</dt><dd data-testid="depois">{correctionValueLabel(phase.next, admissible)}</dd></div>
          </dl>
          {justification.trim() && <p className="text-sm">Justificativa: {justification.trim()}</p>}
          {issues.length > 0 && (
            <ul role="alert" className="list-disc pl-5 text-sm">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" onClick={register}>Registrar correção</Button>
            <Button variant="outline" className="min-h-11" onClick={() => setPhase({ kind: "editing", baseVersionId: phase.baseVersionId })}>
              Voltar à correção
            </Button>
          </div>
        </div>
      )}

      {showHistory && (
        <ol aria-label="Histórico deste resultado" className="space-y-2">
          {[...history].reverse().map((line) => (
            <li key={line.versionId} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-medium">Versão {line.version}{line.current ? " — vigente" : ""}</p>
              <p>{correctionValueLabel(line.value, admissible, line.valueLabel)}</p>
              <p className="text-muted-foreground">{formatDateTime(line.recordedAt)}</p>
              {line.rectification?.justification && <p>Justificativa: {line.rectification.justification}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
