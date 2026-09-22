import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter, Plus, Search, X } from "lucide-react";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { UnitsDataGrid, type UnitsViewState } from "@/features/units/units-grid";
import { demonstrationUnits } from "@/features/units/units-data";
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
import { brand } from "@/config/branding";

export const Route = createFileRoute("/unidades")({
  head: () => ({
    meta: [
      { title: `Unidades escolares — ${brand.name}` },
      { name: "description", content: "Consulta demonstrativa de unidades escolares no SIGEM." },
      { property: "og:title", content: `Unidades escolares — ${brand.name}` },
      {
        property: "og:description",
        content: "Experiência operacional demonstrativa para consulta de unidades escolares.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnitsPage,
});

function UnitsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewState, setViewState] = useState<UnitsViewState>("ready");

  const filteredUnits = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return demonstrationUnits
      .filter(
        (unit) =>
          !term ||
          [unit.name, unit.identifier, unit.category, unit.location].some((value) =>
            value.toLocaleLowerCase("pt-BR").includes(term),
          ),
      )
      .filter((unit) => status === "all" || unit.status === status)
      .filter((unit) => category === "all" || unit.category === category)
      .filter((unit) => location === "all" || unit.location === location)
      .sort((a, b) =>
        sortDirection === "asc"
          ? a.name.localeCompare(b.name, "pt-BR")
          : b.name.localeCompare(a.name, "pt-BR"),
      );
  }, [category, location, query, sortDirection, status]);

  const activeFilters = [status !== "all", category !== "all", location !== "all"].filter(
    Boolean,
  ).length;
  const clearFilters = () => {
    setStatus("all");
    setCategory("all");
    setLocation("all");
    setQuery("");
    setViewState("ready");
  };

  return (
    <div className="space-y-4 pb-4">
      <OperationalPageHeader
        title="Unidades escolares"
        description="Consulte e acompanhe as unidades atendidas pelo SIGEM."
        actions={
          <Button size="sm" disabled title="Disponível em uma etapa futura">
            <Plus /> Nova unidade
          </Button>
        }
      />

      <section aria-label="Pesquisa e filtros" className="border-b border-border pb-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Pesquisar unidades"
              placeholder="Pesquisar por nome, identificação ou contexto"
              className="h-9 pl-9 pr-9"
            />
            {query ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 size-9"
                onClick={() => setQuery("")}
                aria-label="Limpar pesquisa"
              >
                <X />
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 sm:w-40" aria-label="Filtrar por situação">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="Em atividade">Em atividade</SelectItem>
                <SelectItem value="Em revisão">Em revisão</SelectItem>
                <SelectItem value="Cadastro incompleto">Cadastro incompleto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 sm:w-44" aria-label="Filtrar por categoria">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="Unidade escolar">Unidade escolar</SelectItem>
                <SelectItem value="Centro educacional">Centro educacional</SelectItem>
                <SelectItem value="Núcleo educacional">Núcleo educacional</SelectItem>
              </SelectContent>
            </Select>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-9">
                  <Filter /> Filtros {activeFilters ? `(${activeFilters})` : ""}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filtros avançados</SheetTitle>
                  <SheetDescription>
                    Controles provisórios para validar uma consulta operacional escalável.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <Label>Localização / contexto</Label>
                    <Select value={location} onValueChange={setLocation}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os contextos</SelectItem>
                        <SelectItem value="Contexto urbano">Contexto urbano</SelectItem>
                        <SelectItem value="Contexto rural">Contexto rural</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado da interface</Label>
                    <Select
                      value={viewState}
                      onValueChange={(value) => setViewState(value as UnitsViewState)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ready">Dados disponíveis</SelectItem>
                        <SelectItem value="loading">Carregamento</SelectItem>
                        <SelectItem value="empty">Sem resultados</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                        <SelectItem value="permission">Acesso negado</SelectItem>
                        <SelectItem value="stale">Dados desatualizados</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Apenas para validar estados; não representa uma regra do sistema.
                    </p>
                  </div>
                  <Button variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            {activeFilters || query ? (
              <Button variant="ghost" className="h-9" onClick={clearFilters}>
                Limpar
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span aria-live="polite">
            <strong className="font-semibold text-foreground">{filteredUnits.length}</strong>{" "}
            resultados demonstrativos {selected.length ? `· ${selected.length} selecionados` : ""}
          </span>
          <span>Filtros e categorias são provisórios</span>
        </div>
      </section>

      <UnitsDataGrid
        units={filteredUnits}
        state={viewState}
        selected={selected}
        onSelectedChange={setSelected}
        sortDirection={sortDirection}
        onSort={() => setSortDirection((value) => (value === "asc" ? "desc" : "asc"))}
      />
    </div>
  );
}
