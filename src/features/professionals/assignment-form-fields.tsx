import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field } from "./posting-form-fields";
import {
  ASSIGNMENT_CONTEXT_KINDS,
  FUNCTION_CATALOG,
  assignmentContexts,
  type AssignmentContextKind,
  type AssignmentHoursMode,
} from "./assignment-draft";
import type { FunctionalAllocation } from "./professionals-data";

const selectClass =
  "mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Catálogo demonstrativo de Funções; não congela taxonomia municipal oficial. */
export function FunctionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="max-w-md">
      <Label htmlFor="assignment-function">Função (catálogo demonstrativo)</Label>
      <select
        id="assignment-function"
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecionar função demonstrativa</option>
        {FUNCTION_CATALOG.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        A Função possui identidade própria e não se confunde com o registro da Atribuição. Nenhuma
        função é presumida gratificada nem exige ato de designação de um mesmo tipo.
      </p>
    </div>
  );
}

export function AssignmentContextPicker({
  contextKind,
  context,
  onContextKind,
  onContext,
}: {
  contextKind: AssignmentContextKind;
  context: string;
  onContextKind: (value: AssignmentContextKind) => void;
  onContext: (value: string) => void;
}) {
  const options = assignmentContexts(contextKind);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Tipo de contexto institucional</Label>
        <RadioGroup
          value={contextKind}
          onValueChange={(value) => {
            onContextKind(value as AssignmentContextKind);
            onContext("");
          }}
          className="mt-2 space-y-1"
          aria-label="Tipo de contexto institucional"
        >
          {ASSIGNMENT_CONTEXT_KINDS.map((value) => (
            <Label key={value} className="flex items-center gap-2 font-normal">
              <RadioGroupItem value={value} />
              {value}
            </Label>
          ))}
        </RadioGroup>
      </div>
      <div>
        <Label htmlFor="assignment-context">Unidade / contexto organizacional</Label>
        <select
          id="assignment-context"
          className={selectClass}
          value={context}
          disabled={!options.length}
          onChange={(event) => onContext(event.target.value)}
        >
          <option value="">Selecionar contexto existente</option>
          {options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Unidade Organizacional não é prédio, endereço ou anexo físico. O modelo institucional
          existente é reutilizado.
        </p>
      </div>
    </div>
  );
}

/** Lotação relacionada é referência contextual opcional. */
export function RelatedPostingPicker({
  postings,
  value,
  onChange,
}: {
  postings: FunctionalAllocation[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="max-w-md">
      <Label htmlFor="assignment-posting">Lotação relacionada (opcional)</Label>
      <select
        id="assignment-posting"
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Sem lotação específica relacionada</option>
        {postings.map((posting) => (
          <option key={posting.id} value={posting.id}>
            {posting.status === "Atual" ? "ATUAL" : "HISTÓRICO"} · {posting.place} · {posting.start}{" "}
            — {posting.end ?? "em andamento"}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        Nenhuma lotação é criada ou movimentada a partir desta tela.
      </p>
    </div>
  );
}

export function ContextualHoursField({
  hoursMode,
  hours,
  onHoursMode,
  onHours,
}: {
  hoursMode: AssignmentHoursMode;
  hours: string;
  onHoursMode: (value: AssignmentHoursMode) => void;
  onHours: (value: string) => void;
}) {
  return (
    <div>
      <RadioGroup
        value={hoursMode}
        onValueChange={(value) => onHoursMode(value as AssignmentHoursMode)}
        className="grid gap-2 sm:grid-cols-2"
        aria-label="Situação da carga contextual"
      >
        {(
          [
            ["informada", "Carga contextual da atribuição conhecida"],
            ["nao-informada", "Carga contextual não informada"],
          ] as const
        ).map(([value, label]) => (
          <Label
            key={value}
            className="flex items-center gap-2 border border-border p-3 font-normal"
          >
            <RadioGroupItem value={value} />
            {label}
          </Label>
        ))}
      </RadioGroup>
      {hoursMode === "informada" ? (
        <div className="mt-3 max-w-48">
          <Field
            id="assignment-hours"
            label="Horas contextuais da atribuição"
            value={hours}
            onChange={(value) => onHours(value.replace(/\D/g, ""))}
            type="number"
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Carga contextual da atribuição não informada.
        </p>
      )}
    </div>
  );
}
