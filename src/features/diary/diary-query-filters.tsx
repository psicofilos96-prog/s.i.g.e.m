import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DiarySearch } from "./diary-data";

export type DiaryFilterOption = {
  key: "unidade" | "turma" | "componente" | "professor" | "estado";
  label: string;
  options: Array<[string, string]>;
};

export function DiaryQueryFilters({
  search,
  onChange,
  secondary = [],
  showQuery = false,
}: {
  search: DiarySearch;
  onChange: (search: DiarySearch) => void;
  secondary?: DiaryFilterOption[];
  showQuery?: boolean;
}) {
  const mobile = useIsMobile();
  const keys = ["q", "de", "ate", ...secondary.map((item) => item.key)] as const;
  const active = keys.filter((key) => Boolean(search[key]));
  const update = (key: (typeof keys)[number], value?: string) =>
    onChange({ ...search, [key]: value || undefined });
  const advanced = (
    <div className="grid gap-3">
      {secondary.map((filter) => (
        <label key={filter.key} className="min-w-0 text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            {filter.label}
          </span>
          <select
            value={search[filter.key] ?? ""}
            onChange={(event) => update(filter.key, event.target.value)}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {filter.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
  return (
    <section className="space-y-3 border-y border-border/70 py-3" aria-label="Filtros da consulta">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto] lg:items-end">
        {showQuery ? (
          <label className="relative min-w-0 sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Buscar registros</span>
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search.q ?? ""}
              onChange={(event) => update("q", event.target.value)}
              placeholder="Buscar conteúdo, turma ou componente"
              className="pl-9"
            />
          </label>
        ) : (
          <div className="hidden lg:block" />
        )}
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">De</span>
          <Input
            type="date"
            value={search.de ?? ""}
            onChange={(event) => update("de", event.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Até</span>
          <Input
            type="date"
            value={search.ate ?? ""}
            onChange={(event) => update("ate", event.target.value)}
          />
        </label>
        {secondary.length ? (
          mobile ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <Filter /> Mais filtros{active.length ? ` (${active.length})` : ""}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filtros da consulta</SheetTitle>
                </SheetHeader>
                <div className="mt-4">{advanced}</div>
              </SheetContent>
            </Sheet>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter /> Mais filtros{active.length ? ` (${active.length})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                {advanced}
              </PopoverContent>
            </Popover>
          )
        ) : null}
      </div>
      {active.length ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
          {active.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => update(key)}
              aria-label={`Remover filtro ${key}`}
            >
              {key}: {search[key]} <X />
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange(
                Object.fromEntries(
                  Object.entries(search).filter(
                    ([key]) => !keys.includes(key as (typeof keys)[number]),
                  ),
                ),
              )
            }
          >
            Limpar filtros
          </Button>
        </div>
      ) : null}
    </section>
  );
}
