import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/sigem/patterns";
import { getClassUnitName } from "@/features/classes/classes-data";
import type { FunctionalLink } from "@/features/professionals/professionals-data";
import {
  PEDAGOGICAL_PERIOD_OPTIONS,
  PEDAGOGICAL_PROFESSIONAL_OPTIONS,
  PEDAGOGICAL_UNIT_OPTIONS,
  classesForContext,
  fieldOptionsForClass,
  linkSituationLabel,
  type FieldOption,
} from "./pedagogical-assignment-draft";
import { PEDAGOGICAL_ROLES, type PedagogicalRole } from "./pedagogical-data";
import { getDemonstrationClass } from "@/features/classes/classes-data";

const selectClass =
  "mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Profissional existente. Nenhum dado civil desnecessário é exibido. */
export function ProfessionalPicker({
  id = "pedagogical-professional",
  label = "Profissional existente",
  value,
  onChange,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="max-w-lg">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecionar profissional existente</option>
        {PEDAGOGICAL_PROFESSIONAL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} · {option.situation}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        Identificação mínima: nome, Identificador SIGEM e situação contextual. CPF completo, filiação,
        endereço e dados bancários não são exibidos.
      </p>
    </div>
  );
}

/**
 * Vínculo funcional. Quando há mais de um vínculo, a escolha é explícita —
 * nenhum vínculo é selecionado silenciosamente.
 */
export function FunctionalLinkPicker({
  id = "pedagogical-link",
  links,
  value,
  onChange,
}: {
  id?: string;
  links: FunctionalLink[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>Vínculo funcional pelo qual o profissional atua</Label>
      <select
        id={id}
        className={`${selectClass} max-w-xl`}
        value={value}
        disabled={!links.length}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {links.length > 1
            ? "Selecionar explicitamente o vínculo pertinente"
            : "Selecionar vínculo existente"}
        </option>
        {links.map((link) => (
          <option key={link.id} value={link.id}>
            {linkSituationLabel(link)} · {link.employerContext} ·{" "}
            {link.functionalIdentifier || "sem matrícula funcional"} · {link.cargo} · {link.start} —{" "}
            {link.end ?? "em andamento"}
          </option>
        ))}
      </select>
      {links.length > 1 ? (
        <p role="note" className="mt-2 border border-border bg-muted/40 p-3 text-xs">
          Este profissional possui {links.length} vínculos funcionais. A atuação pertence a um
          vínculo específico e nenhum deles é escolhido automaticamente.
        </p>
      ) : null}
      <ul
        className="mt-3 divide-y divide-border border-y border-border"
        aria-label="Vínculos funcionais disponíveis"
      >
        {links.map((link) => (
          <li key={link.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
            <StatusBadge tone={link.status === "Vigente" ? "success" : "neutral"}>
              {linkSituationLabel(link)}
            </StatusBadge>
            <span>
              {link.employerContext} · {link.functionalIdentifier || "sem matrícula funcional"} ·
              Cargo {link.cargo} · {link.start} — {link.end ?? "em andamento"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AcademicContextPicker({
  unitId,
  periodLabel,
  onUnit,
  onPeriod,
}: {
  unitId: string;
  periodLabel: string;
  onUnit: (value: string) => void;
  onPeriod: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="pedagogical-unit">Unidade existente</Label>
        <select
          id="pedagogical-unit"
          className={selectClass}
          value={unitId}
          onChange={(event) => onUnit(event.target.value)}
        >
          <option value="">Selecionar unidade existente</option>
          {PEDAGOGICAL_UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Unidade não é prédio, anexo ou endereço. Nenhuma unidade é criada aqui.
        </p>
      </div>
      <div>
        <Label htmlFor="pedagogical-period">Período letivo existente</Label>
        <select
          id="pedagogical-period"
          className={selectClass}
          value={periodLabel}
          onChange={(event) => onPeriod(event.target.value)}
        >
          <option value="">Selecionar período letivo existente</option>
          {PEDAGOGICAL_PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Período letivo não é ano civil nem período avaliativo. Nenhum calendário é criado neste
          workspace.
        </p>
      </div>
    </div>
  );
}

export function ClassPicker({
  unitId,
  periodLabel,
  value,
  onChange,
}: {
  unitId: string;
  periodLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = classesForContext(unitId, periodLabel);
  const klass = getDemonstrationClass(value);
  return (
    <div>
      <Label htmlFor="pedagogical-class">Turma existente</Label>
      <select
        id="pedagogical-class"
        className={`${selectClass} max-w-xl`}
        value={value}
        disabled={!options.length}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecionar turma compatível</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} · {option.academicOrganization} · {option.shift}
          </option>
        ))}
      </select>
      {!options.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhuma turma existente para a unidade e o período letivo selecionados.
        </p>
      ) : null}
      {klass ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground" aria-label="Contexto da turma">
          <li>Unidade: {getClassUnitName(klass.unitId)}</li>
          <li>Período letivo: {klass.academicPeriod.label}</li>
          <li>Organização acadêmica: {klass.academicOrganization}</li>
          <li>Turno: {klass.shift}</li>
          <li>Jornada: {klass.journey}</li>
          <li>
            Agrupamentos:{" "}
            {klass.groupings.map((group) => `${group.label} · ${group.kind}`).join("; ")} — nenhuma
            série única é exigida.
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** Componente ou campo derivado da matriz curricular pertinente à turma. */
export function PedagogicalFieldPicker({
  options,
  fieldKind,
  field,
  onChange,
}: {
  options: FieldOption[];
  fieldKind: string;
  field: string;
  onChange: (option: FieldOption) => void;
}) {
  const current = options.findIndex(
    (option) => option.label === field && option.kind === fieldKind,
  );
  return (
    <div>
      <Label htmlFor="pedagogical-field">Componente curricular ou campo pedagógico</Label>
      <select
        id="pedagogical-field"
        className={`${selectClass} max-w-xl`}
        value={current >= 0 ? String(current) : ""}
        onChange={(event) => {
          const option = options[Number(event.target.value)];
          if (option) onChange(option);
        }}
      >
        <option value="">Selecionar estrutura pedagógica pertinente</option>
        {options.map((option, index) => (
          <option key={`${option.kind}-${option.label}`} value={String(index)}>
            {option.kind}: {option.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        A estrutura vem da matriz curricular já modelada. A Educação Infantil utiliza campos de
        experiências e a EJA a estrutura pertinente à fase; nenhuma disciplina convencional é
        forçada e nenhuma matriz nova é criada.
      </p>
    </div>
  );
}

export function PedagogicalRolePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: PedagogicalRole) => void;
}) {
  return (
    <div>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as PedagogicalRole)}
        className="grid gap-2 sm:grid-cols-2"
        aria-label="Papel pedagógico na atuação"
      >
        {PEDAGOGICAL_ROLES.map((role) => (
          <Label key={role} className="flex items-center gap-2 border border-border p-3 font-normal">
            <RadioGroupItem value={role} />
            {role}
          </Label>
        ))}
      </RadioGroup>
      <p className="mt-2 text-xs text-muted-foreground">
        Papéis demonstrativos, não enumeração normativa municipal. Nenhum papel concede
        automaticamente permissões de Diário, frequência ou avaliação.
      </p>
    </div>
  );
}
