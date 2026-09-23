import type { ReactNode } from "react";
import { useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * FilterBar / FilterChips — contrato de UI genérico do SIGEM.
 *
 * Os componentes não conhecem nenhum domínio (unidade, escola, etapa,
 * modalidade, situação institucional). Cada tela consumidora fornece a
 * definição dos filtros, os valores atuais e os manipuladores.
 *
 * Arquitetura preparada para filtros resolvidos no servidor: o componente é
 * totalmente controlado e apenas emite intenções de alteração.
 */

/** Valor sentinela para "sem filtro aplicado". */
export const FILTER_ALL = "all";

export type FilterOption = { value: string; label: string };

export type FilterDefinition = {
  id: string;
  label: string;
  /** Rótulo da opção que representa "nenhum filtro". */
  allLabel: string;
  options: FilterOption[];
  /** Quando verdadeiro, o filtro aparece apenas no painel avançado. */
  advanced?: boolean;
  triggerClassName?: string;
};

export type FilterValues = Record<string, string>;

export type FilterBarProps = {
  search?: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder?: string;
  };
  filters: FilterDefinition[];
  values: FilterValues;
  onValueChange: (id: string, value: string) => void;
  onClear: () => void;
  advancedTitle?: string;
  advancedDescription?: string;
  advancedExtra?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  note?: ReactNode;
  label?: string;
};

function activeCount(filters: FilterDefinition[], values: FilterValues) {
  return filters.filter((filter) => (values[filter.id] ?? FILTER_ALL) !== FILTER_ALL).length;
}

export function FilterBar({
  search,
  filters,
  values,
  onValueChange,
  onClear,
  advancedTitle = "Filtros avançados",
  advancedDescription,
  advancedExtra,
  actions,
  summary,
  note,
  label = "Pesquisa e filtros",
}: FilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const inlineFilters = filters.filter((filter) => !filter.advanced);
  const advancedFilters = filters.filter((filter) => filter.advanced);
  const active = activeCount(filters, values);
  const hasAdvancedPanel = advancedFilters.length > 0 || Boolean(advancedExtra);

  return (
    <section aria-label={label} className="border-b border-border/70 pb-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        {search ? (
          <div className="relative min-w-0 flex-1 lg:max-w-2xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              aria-label={search.label}
              placeholder={search.placeholder}
              className="h-10 pl-9 pr-9"
            />
            {search.value ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 size-10"
                onClick={() => search.onChange("")}
                aria-label="Limpar pesquisa"
              >
                <X />
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="grid min-w-0 grid-cols-1 gap-2 min-[28rem]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
          {inlineFilters.map((filter) => (
            <Select
              key={filter.id}
              value={values[filter.id] ?? FILTER_ALL}
              onValueChange={(value) => onValueChange(filter.id, value)}
            >
              <SelectTrigger
                className={filter.triggerClassName ?? "h-10 sm:w-44"}
                aria-label={filter.label}
              >
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{filter.allLabel}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {hasAdvancedPanel ? (
            <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-10">
                  <Filter /> Filtros {active ? `(${active})` : ""}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>{advancedTitle}</SheetTitle>
                  {advancedDescription ? (
                    <SheetDescription>{advancedDescription}</SheetDescription>
                  ) : null}
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  {advancedFilters.map((filter) => (
                    <div key={filter.id} className="space-y-2">
                      <Label htmlFor={`filter-${filter.id}`}>{filter.label}</Label>
                      <Select
                        value={values[filter.id] ?? FILTER_ALL}
                        onValueChange={(value) => onValueChange(filter.id, value)}
                      >
                        <SelectTrigger id={`filter-${filter.id}`} aria-label={filter.label}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FILTER_ALL}>{filter.allLabel}</SelectItem>
                          {filter.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {advancedExtra}
                  <Button variant="outline" onClick={onClear}>
                    Limpar filtros
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : null}
          {actions}
        </div>
      </div>
      <FilterChips
        filters={filters}
        values={values}
        onValueChange={onValueChange}
        onClear={onClear}
      />
      {summary || note ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
          <span className="min-w-0 [overflow-wrap:anywhere]" aria-live="polite">{summary}</span>
          {note ? <span className="min-w-0 [overflow-wrap:anywhere]">{note}</span> : null}
        </div>
      ) : null}
    </section>
  );
}

export function FilterChips({
  filters,
  values,
  onValueChange,
  onClear,
}: {
  filters: FilterDefinition[];
  values: FilterValues;
  onValueChange: (id: string, value: string) => void;
  onClear: () => void;
}) {
  const chips = filters
    .map((filter) => {
      const value = values[filter.id] ?? FILTER_ALL;
      if (value === FILTER_ALL) return null;
      const option = filter.options.find((item) => item.value === value);
      return { filter, value, label: option?.label ?? value };
    })
    .filter((chip): chip is { filter: FilterDefinition; value: string; label: string } =>
      Boolean(chip),
    );

  if (chips.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <li key={chip.filter.id} className="min-w-0 max-w-full">
          <Button
            variant="secondary"
            size="sm"
            className="h-auto min-h-7 max-w-full flex-wrap gap-1.5 px-2 py-1 text-xs"
            onClick={() => onValueChange(chip.filter.id, FILTER_ALL)}
            aria-label={`Remover filtro ${chip.filter.label}: ${chip.label}`}
          >
            <span className="text-muted-foreground">{chip.filter.label}:</span>
            <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{chip.label}</span>
            <X className="size-3" aria-hidden="true" />
          </Button>
        </li>
      ))}
      <li>
        <Button variant="ghost" size="sm" className="h-auto min-h-7 px-2 text-xs" onClick={onClear}>
          Limpar filtros
        </Button>
      </li>
    </ul>
  );
}
