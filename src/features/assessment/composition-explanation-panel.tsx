/**
 * 6D.3.3.3c — "Como este resultado foi formado?"
 *
 * Interface humana da `CompositionExplanationProjection` (6D.3.3.3b).
 * Invariantes:
 * - Nenhuma matemática: não soma, não pondera, não compara valores para
 *   descobrir teto ou arredondamento. Tudo vem dos booleanos e valores
 *   projetados (`cap.applied`, `roundingApplied`, `roundingPolicyConsulted`).
 * - Formatar número (vírgula decimal) é apresentação, nunca cálculo.
 * - `protected` não renderiza nenhum valor, peso, instrumento ou estágio.
 * - IDs técnicos só aparecem no Nível 3 ("Detalhes do cálculo").
 */
import { useId, useState } from "react";
import type {
  CompositionExplanationProjection,
  ExplainedCategory,
  ExplainedCategoryRequirement,
  ExplainedEntryReference,
  ExplainedMissingEntry,
  ExplainedRoundingPolicy,
  ExplainedStage,
} from "./composition-explanation-projection";

export const EXPLANATION_TRIGGER = "Como este resultado foi formado?";
export const EXPLANATION_UNAVAILABLE = "Ainda não é possível explicar a composição deste resultado.";
export const EXPLANATION_PROTECTED = "Os detalhes deste resultado não estão disponíveis para este acesso.";

const num = (n: number) => String(n).replace(".", ",");

function entryTitle(e: ExplainedEntryReference): string {
  return e.resolved ? e.instrumentTitle : "Registro não identificado";
}

function roundingPolicyText(p: ExplainedRoundingPolicy | null): string | null {
  if (!p || !p.known) return null;
  const d = p.decimals === undefined ? "" : ` (${p.decimals} ${p.decimals === 1 ? "casa decimal" : "casas decimais"})`;
  switch (p.mode) {
    case "sem-arredondamento":
      return "sem arredondamento";
    case "meio-acima":
      return `valor mais próximo, metade para cima${d}`;
    case "meio-par":
      return `valor mais próximo, metade para o par${d}`;
    case "truncar":
      return `casas excedentes descartadas${d}`;
    case "passo":
      return p.step === undefined ? null : `em passos de ${num(p.step)}`;
  }
}

function notUsedText(m: ExplainedMissingEntry): string {
  switch (m.reasonKind) {
    case "lancamento-em-aberto":
      return "O registro ainda está em aberto e não foi concluído.";
    case "nao-registrado-sem-regra":
      return m.canonicalReason
        ? `Consta como “Não registrado” (${m.canonicalReason}). A composição não tem regra para considerá-lo.`
        : "Consta como “Não registrado”. A composição não tem regra para considerá-lo.";
    case "origem-nao-admitida":
      return "A origem deste registro não é admitida pela composição.";
  }
}

function requirementText(r: ExplainedCategoryRequirement): string | null {
  switch (r.kind) {
    case "quantidade-minima":
      return `A composição exige ${r.required} ${r.required === 1 ? "registro" : "registros"} nesta parte; há ${r.present}.`;
    case "categoria-sem-lancamento":
      return "Ainda não há registros nesta parte.";
    case "periodo-incompleto":
      return "O período ainda não está completo.";
  }
}

/** Nível 2: só destaca transformações que de fato ocorreram. */
function StageTransformation({ stage, label }: { stage: ExplainedStage; label: string }) {
  if (!stage.roundingApplied) return null;
  return (
    <p className="text-xs">
      {label} — antes do arredondamento: {num(stage.valueBeforeRounding)} · resultado após arredondamento:{" "}
      {num(stage.value)}
    </p>
  );
}

function CategoryBlock({ c, showWeight }: { c: ExplainedCategory; showWeight: boolean }) {
  const weightsDiffer = new Set(c.usedEntries.map((u) => u.effectiveWeight)).size > 1;
  return (
    <li className="space-y-1" data-testid={`explanation-category-${c.provenance.categoryId}`}>
      <p className="font-medium break-words">
        {c.label}
        {showWeight && <span className="font-normal text-muted-foreground"> · peso {num(c.weight)}</span>}
      </p>
      <p>Resultado: {c.stage ? num(c.stage.value) : "ainda sem registros suficientes"}</p>
      {c.usedEntries.length > 0 && (
        <>
          <p className="text-muted-foreground">Instrumentos considerados:</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {c.usedEntries.map((u) => (
              <li key={u.provenance.entryVersionId} className="break-words">
                {entryTitle(u)} · {num(u.effectiveValue)}
                {weightsDiffer && ` · peso ${num(u.effectiveWeight)}`}
                {u.resolved && u.corrected && <span className="text-muted-foreground"> · Resultado corrigido</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {c.cap?.applied && (
        <div className="text-xs" data-testid="explanation-cap-applied">
          <p>Resultado antes do limite: {num(c.cap.valueBeforeCap)}</p>
          <p>Limite aplicável: {num(c.cap.maxScore)}</p>
          <p>Resultado após o limite: {num(c.cap.valueAfterCap)}</p>
        </div>
      )}
      {c.stage && <StageTransformation stage={c.stage} label="Nesta parte" />}
    </li>
  );
}

function StageDetails({ label, stage }: { label: string; stage: ExplainedStage | null }) {
  if (!stage) return null;
  const policy = roundingPolicyText(stage.roundingPolicy);
  return (
    <li>
      <span className="font-medium">{label}:</span> resultado antes do arredondamento {num(stage.valueBeforeRounding)} ·
      após arredondamento {num(stage.value)}.{" "}
      {stage.roundingPolicyConsulted
        ? stage.roundingApplied
          ? "A regra de arredondamento alterou o valor."
          : "A regra de arredondamento foi aplicada sem alterar o resultado."
        : "Nenhuma regra de arredondamento foi consultada nesta etapa."}
      {policy && ` Regra: ${policy}.`}
      {stage.roundingPolicy && (
        <span className="block text-muted-foreground">
          Política {stage.roundingPolicy.provenance.roundingPolicyId}
        </span>
      )}
    </li>
  );
}

function AvailableBody({
  p,
  detailsId,
}: {
  p: Extract<CompositionExplanationProjection, { state: "available" }>;
  detailsId: string;
}) {
  const [details, setDetails] = useState(false);
  const categoryWeightsDiffer = new Set(p.categories.map((c) => c.weight)).size > 1;
  const contributing = p.categories.filter((c) => c.usedEntries.length > 0);
  const notUsed = p.categories.flatMap((c) => c.notUsed.map((m) => ({ m, category: c.label })));
  const unmet = p.categories.flatMap((c) =>
    c.unmetRequirements.flatMap((r) => {
      const t = requirementText(r);
      return t ? [{ t, category: c.label }] : [];
    }),
  );
  const hasOutside = notUsed.length > 0 || p.unmatched.length > 0 || p.notApplicable.length > 0 || unmet.length > 0;
  const partial = p.compositionKind === "acumulado-parcial" || !p.complete;
  return (
    <div className="space-y-3">
      {/* Nível 1 — resposta imediata */}
      <div data-testid="explanation-level-1">
        <p className="text-sm font-medium">
          Resultado do período: {p.period ? num(p.period.value) : "ainda não formado"}
          {partial && p.period && " (acumulado parcial)"}
        </p>
        {contributing.length > 0 && (
          <p>Formado a partir de: {contributing.map((c) => c.label).join(", ")}.</p>
        )}
        {partial && <p className="text-muted-foreground">Ainda faltam registros exigidos pela composição.</p>}
        {p.period && <StageTransformation stage={p.period} label="No período" />}
      </div>

      {/* Nível 2 — como cada parte foi formada */}
      {p.categories.length > 0 && (
        <ul className="space-y-3" data-testid="explanation-level-2">
          {p.categories.map((c) => (
            <CategoryBlock key={c.provenance.categoryId} c={c} showWeight={categoryWeightsDiffer} />
          ))}
        </ul>
      )}

      {hasOutside && (
        <section aria-label="O que não entrou neste resultado?" className="space-y-1" data-testid="explanation-outside">
          <p className="font-medium">O que não entrou neste resultado?</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {notUsed.map(({ m, category }) => (
              <li key={`nu-${m.entry.provenance.entryVersionId}`} data-nature="selected-not-used" className="break-words">
                {entryTitle(m.entry)} ({category}): {notUsedText(m)}
              </li>
            ))}
            {unmet.map(({ t, category }, i) => (
              <li key={`req-${i}`} data-nature="unmet-requirement">
                {category}: {t}
              </li>
            ))}
            {p.unmatched.map((e) => (
              <li key={`um-${e.provenance.entryVersionId}`} data-nature="unmatched" className="break-words">
                {entryTitle(e)}: não integra a composição deste resultado.
              </li>
            ))}
          </ul>
          {p.notApplicable.length > 0 && (
            <div data-testid="explanation-not-applicable">
              <p className="text-muted-foreground">Contexto acadêmico:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {p.notApplicable.map((n) => (
                  <li key={n.provenance.instrumentId} data-nature="not-applicable" className="break-words">
                    {n.instrumentTitle}: não se aplica neste período.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Nível 3 — detalhes do cálculo, sob solicitação */}
      <div>
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline"
          aria-expanded={details}
          aria-controls={detailsId}
          onClick={() => setDetails((v) => !v)}
        >
          {details ? "Ocultar detalhes do cálculo" : "Detalhes do cálculo"}
        </button>
        {details && (
          <ul id={detailsId} className="mt-1 space-y-1 text-muted-foreground" data-testid="explanation-level-3">
            {p.categories.map((c) => (
              <li key={c.provenance.categoryId} className="space-y-0.5">
                <span className="font-medium text-foreground">{c.label}</span> · peso da parte {num(c.weight)}
                <ul className="pl-3">
                  {c.usedEntries.map((u) => (
                    <li key={u.provenance.entryVersionId} className="break-words">
                      {entryTitle(u)}: valor considerado {num(u.effectiveValue)} · peso {num(u.effectiveWeight)}
                      {u.resolved && ` · versão ${u.provenance.version}`}
                    </li>
                  ))}
                  {c.cap &&
                    (c.cap.applied ? (
                      <li>
                        Limite aplicável {num(c.cap.maxScore)}: antes {num(c.cap.valueBeforeCap)}, depois{" "}
                        {num(c.cap.valueAfterCap)}.
                      </li>
                    ) : (
                      <li>Limite previsto: {num(c.cap.maxScore)}. Ele não alterou este resultado.</li>
                    ))}
                  <StageDetails label="Resultado da parte" stage={c.stage} />
                </ul>
              </li>
            ))}
            <StageDetails label="Resultado do período" stage={p.period} />
            <li className="break-words">
              Composição {p.provenance.modelId} v{p.provenance.modelVersion} · configuração{" "}
              {p.provenance.configurationId} v{p.provenance.configurationVersion}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

function UnavailableBody({
  p,
  reasonsId,
}: {
  p: Extract<CompositionExplanationProjection, { state: "unavailable" }>;
  reasonsId: string;
}) {
  const [why, setWhy] = useState(false);
  return (
    <div className="space-y-1" data-testid="explanation-unavailable">
      <p>{EXPLANATION_UNAVAILABLE}</p>
      {p.reasons.length > 0 && (
        <>
          <button
            type="button"
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-expanded={why}
            aria-controls={reasonsId}
            onClick={() => setWhy((v) => !v)}
          >
            Por quê?
          </button>
          {why && (
            <ul id={reasonsId} className="list-disc pl-4">
              {p.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function CompositionExplanationPanel({
  projection,
  subjectName,
}: {
  projection: CompositionExplanationProjection;
  /** Contextualiza o nome acessível quando há várias composições na tela. */
  subjectName?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const panelId = `${id}-panel`;
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className="text-left text-xs text-primary underline-offset-2 hover:underline"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={subjectName ? `Como o resultado de ${subjectName} foi formado?` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {EXPLANATION_TRIGGER}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={subjectName ? `Formação do resultado de ${subjectName}` : "Formação do resultado"}
          className="w-full max-w-md space-y-2 rounded-sm bg-muted p-3 text-xs break-words"
          data-testid="composition-explanation"
          data-state={projection.state}
        >
          {projection.state === "available" && <AvailableBody p={projection} detailsId={`${id}-details`} />}
          {projection.state === "unavailable" && <UnavailableBody p={projection} reasonsId={`${id}-why`} />}
          {projection.state === "protected" && <p>{EXPLANATION_PROTECTED}</p>}
        </div>
      )}
    </div>
  );
}
