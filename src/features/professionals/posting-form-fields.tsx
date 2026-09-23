import { CheckCircle2, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  POSTING_CONTEXT_KINDS,
  postingDestinations,
  type PostingConflict,
  type PostingContextKind,
  type PostingHoursMode,
} from "./posting-draft";

export function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Destino organizacional: unidade escolar, órgão central, setor administrativo
 * ou outro contexto. Prédio, endereço e anexo físico não são sinônimo de
 * lotação institucional.
 */
export function DestinationPicker({
  contextKind,
  destination,
  onContextKind,
  onDestination,
}: {
  contextKind: PostingContextKind;
  destination: string;
  onContextKind: (value: PostingContextKind) => void;
  onDestination: (value: string) => void;
}) {
  const options = postingDestinations(contextKind);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Tipo de contexto organizacional</Label>
        <Select
          value={contextKind}
          onValueChange={(value) => {
            onContextKind(value as PostingContextKind);
            onDestination("");
          }}
        >
          <SelectTrigger className="mt-1" aria-label="Tipo de contexto organizacional">
            <SelectValue placeholder="Selecionar contexto demonstrativo" />
          </SelectTrigger>
          <SelectContent>
            {POSTING_CONTEXT_KINDS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Unidade / contexto organizacional</Label>
        <Select value={destination} onValueChange={onDestination} disabled={!options.length}>
          <SelectTrigger className="mt-1" aria-label="Unidade ou contexto organizacional">
            <SelectValue placeholder="Selecionar destino existente" />
          </SelectTrigger>
          <SelectContent>
            {options.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Nem toda lotação é uma escola. Prédio, endereço ou anexo físico não determinam a lotação
          institucional.
        </p>
      </div>
    </div>
  );
}

export function DistributedHoursField({
  hoursMode,
  hours,
  onHoursMode,
  onHours,
}: {
  hoursMode: PostingHoursMode;
  hours: string;
  onHoursMode: (value: PostingHoursMode) => void;
  onHours: (value: string) => void;
}) {
  return (
    <div>
      <RadioGroup
        value={hoursMode}
        onValueChange={(value) => onHoursMode(value as PostingHoursMode)}
        className="grid gap-2 sm:grid-cols-2"
      >
        {(
          [
            ["informada", "Carga destinada à lotação conhecida"],
            ["nao-informada", "Distribuição não informada"],
          ] as const
        ).map(([value, label]) => (
          <Label key={value} className="flex items-center gap-2 border border-border p-3 font-normal">
            <RadioGroupItem value={value} />
            {label}
          </Label>
        ))}
      </RadioGroup>
      {hoursMode === "informada" ? (
        <div className="mt-3 max-w-48">
          <Field
            id="distributed-hours"
            label="Horas destinadas a esta lotação"
            value={hours}
            onChange={(value) => onHours(value.replace(/\D/g, ""))}
            type="number"
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Distribuição de carga horária não informada.
        </p>
      )}
    </div>
  );
}

export function ConflictPanel({
  conflicts,
  label = "Compatibilidade e conflitos",
}: {
  conflicts: PostingConflict[];
  label?: string;
}) {
  if (!conflicts.length)
    return (
      <div role="status" className="flex gap-2 border border-border bg-muted/40 p-3">
        <CheckCircle2 className="size-4 shrink-0 text-success" />
        <p className="text-sm">Nenhum conflito óbvio identificado nesta demonstração.</p>
      </div>
    );
  return (
    <ul aria-label={label} className="space-y-2">
      {conflicts.map((conflict) => (
        <li key={conflict.title} className="flex gap-2 border border-border p-3">
          {conflict.level === "forte" ? (
            <CircleAlert className="size-4 shrink-0 text-destructive" />
          ) : conflict.level === "aviso" ? (
            <TriangleAlert className="size-4 shrink-0 text-warning" />
          ) : (
            <Info className="size-4 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {conflict.level === "forte" ? "Conflito forte: " : null}
              {conflict.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{conflict.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
