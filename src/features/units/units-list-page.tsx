import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  NOT_INFORMED,
  emptyUnitFilters,
  filterUnitRows,
  unitFilterOptions,
  unitKindText,
  unitListRows,
  useSchoolRegistry,
  type UnitFilters,
} from "@/features/units/school-registry-source";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function UnitsListPage() {
  const registry = useSchoolRegistry();
  const [filters, setFilters] = useState<UnitFilters>(emptyUnitFilters);
  const rows = useMemo(() => (registry.status === "ready" ? unitListRows(registry.units) : []), [registry]);
  const options = useMemo(() => unitFilterOptions(rows), [rows]);
  const shown = useMemo(() => filterUnitRows(rows, filters), [rows, filters]);
  const set = (k: keyof UnitFilters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Unidades escolares"
        description="Consulta oficial do cadastro institucional de unidades da rede, com versão vigente e identificadores."
      />

      {registry.status === "loading" && <p role="status">Carregando unidades do cadastro institucional…</p>}
      {registry.status === "no-session" && (
        <EmptyState title="Acesso restrito" description="Entre no SIGEM para consultar o cadastro institucional de unidades." />
      )}
      {registry.status === "error" && (
        <EmptyState
          title="Não foi possível consultar as unidades"
          description="A consulta ao cadastro institucional falhou ou não foi autorizada. Nenhum dado substituto é exibido."
          action={<Button variant="outline" onClick={registry.reload}>Tentar novamente</Button>}
        />
      )}
      {registry.status === "ready" && rows.length === 0 && (
        <EmptyState title="Nenhuma unidade cadastrada" description="O cadastro institucional ainda não possui unidades registradas." />
      )}

      {registry.status === "ready" && rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <Label htmlFor="units-search">Pesquisar unidades</Label>
              <Input
                id="units-search"
                aria-label="Pesquisar unidades"
                placeholder="Nome ou INEP"
                value={filters.query}
                onChange={(e) => set("query")(e.target.value)}
                className="h-9 w-72"
              />
            </div>
            <FilterSelect id="f-sit" label="Situação" all="Todas" value={filters.situation} options={options.situation} onChange={set("situation")} />
            <FilterSelect id="f-dep" label="Dependência administrativa" all="Todas" value={filters.dependency} options={options.dependency} onChange={set("dependency")} />
            <FilterSelect id="f-loc" label="Localização" all="Todas" value={filters.location} options={options.location} onChange={set("location")} />
            {options.privateCategory.length > 0 && (
              <FilterSelect id="f-cat" label="Categoria (privada)" all="Todas" value={filters.privateCategory} options={options.privateCategory} onChange={set("privateCategory")} />
            )}
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            {shown.length} de {rows.length} unidades
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm" aria-label="Unidades escolares do cadastro institucional">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th scope="col" className="p-2">Nome oficial</th>
                  <th scope="col" className="p-2">INEP</th>
                  <th scope="col" className="p-2">Tipo de unidade</th>
                  <th scope="col" className="p-2">Localização</th>
                  <th scope="col" className="p-2">Situação</th>
                  <th scope="col" className="p-2">Vigência</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.schoolId} className="border-t border-border">
                    <td className="p-2">
                      <Link to="/unidades/$id" params={{ id: r.schoolId }} className="font-medium text-primary hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="p-2 tabular-nums">{r.inep ?? NOT_INFORMED}</td>
                    <td className="p-2">{unitKindText(r)}</td>
                    <td className="p-2">{r.location ?? NOT_INFORMED}</td>
                    <td className="p-2">
                      {r.active == null ? NOT_INFORMED : (
                        <StatusBadge tone={r.active ? "success" : "neutral"}>{r.active ? "Ativa" : "Inativa"}</StatusBadge>
                      )}
                    </td>
                    <td className="p-2">{r.validFrom ? `desde ${formatAcademicDate(r.validFrom)}` : NOT_INFORMED}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect(p: { id: string; label: string; all: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={p.id}>{p.label}</Label>
      <select id={p.id} className={selectClass} value={p.value} onChange={(e) => p.onChange(e.target.value)}>
        <option value="">{p.all}</option>
        {p.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
