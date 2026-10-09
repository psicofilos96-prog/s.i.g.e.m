import { RecoveryRetryButton } from "@/components/sigem/recovery-retry-button";
import { SkeletonState } from "@/components/sigem/guidance";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/sigem/patterns";
import { RegistryHero, RegistryToolbar, RegistryList, RegistryCard, CardFact, RegistryEmpty, registryTh, registryTd, registryRow } from "@/components/sigem/registry-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { Plus, PencilLine } from "lucide-react";
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
  const authority = useSessionAuthority();
  const canMaintain = authority.status === "signed-in" && authority.capabilities.some((c) => String((c as { capability?: string }).capability ?? c) === "manter-cadastro-unidade-escolar");
  const composition = useMemo(() => unitComposition(rows), [rows]);
  const set = (k: keyof UnitFilters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <RegistryHero
        eyebrow="Rede Municipal de Itaperuna · Cadastro institucional"
        title="Unidades escolares"
        lede="Cada escola da rede com versão vigente, INEP e situação. Abra uma unidade para ver turmas, estudantes e pessoal."
        count={registry.status === "ready" ? <>{rows.length}<span className="ml-2 align-middle text-sm font-normal text-muted-foreground">unidades</span></> : undefined}
        actions={canMaintain ? (
          <Button asChild size="sm"><Link to="/administracao" search={{ retorno: "/unidades" }}><Plus className="mr-1 h-4 w-4" aria-hidden />Nova escola</Link></Button>
        ) : undefined}
      />
      {registry.status === "ready" && rows.length > 0 && <CompositionStrip items={composition} />}

      {registry.status === "loading" && <SkeletonState label="Carregando unidades do cadastro institucional" />}
      {registry.status === "no-session" && (
        <RegistryEmpty title="Acesso restrito" description="Entre no SIGEM para consultar o cadastro institucional de unidades." />
      )}
      {registry.status === "error" && (
        <RegistryEmpty
          title="Não foi possível consultar as unidades"
          description="A consulta ao cadastro institucional falhou ou não foi autorizada. Nenhum dado substituto é exibido."
          action={<RecoveryRetryButton variant="outline" operation="consultar-unidades" onRetry={registry.reload} />}
        />
      )}
      {registry.status === "ready" && rows.length === 0 && (
        <RegistryEmpty title="Nenhuma unidade cadastrada" description="O cadastro institucional ainda não possui unidades registradas." />
      )}

      {registry.status === "ready" && rows.length > 0 && (
        <>
          <RegistryToolbar
            summary={<>{shown.length} de {rows.length} unidades{shown.length !== rows.length && <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={() => setFilters(emptyUnitFilters)}>Limpar filtros</Button>}</>}
          >
            <div className="grid min-w-0 flex-1 gap-1 sm:max-w-xs">
              <Label htmlFor="units-search">Pesquisar unidades</Label>
              <Input id="units-search" aria-label="Pesquisar unidades" placeholder="Nome ou INEP" value={filters.query} onChange={(e) => set("query")(e.target.value)} className="h-9" />
            </div>
            <FilterSelect id="f-sit" label="Situação" all="Todas" value={filters.situation} options={options.situation} onChange={set("situation")} />
            <FilterSelect id="f-dep" label="Dependência administrativa" all="Todas" value={filters.dependency} options={options.dependency} onChange={set("dependency")} />
            <FilterSelect id="f-loc" label="Localização" all="Todas" value={filters.location} options={options.location} onChange={set("location")} />
            {options.privateCategory.length > 0 && (
              <FilterSelect id="f-cat" label="Categoria (privada)" all="Todas" value={filters.privateCategory} options={options.privateCategory} onChange={set("privateCategory")} />
            )}
          </RegistryToolbar>
          {shown.length === 0 ? (
            <RegistryEmpty title="Nenhuma unidade com esses filtros" description="Mude a pesquisa ou limpe os filtros para ver todas as unidades." action={<Button variant="outline" size="sm" onClick={() => setFilters(emptyUnitFilters)}>Limpar filtros</Button>} />
          ) : (
            <RegistryList
              label="Unidades escolares"
              table={
                <table className="w-full text-sm" aria-label="Unidades escolares do cadastro institucional">
                  <thead>
                    <tr>
                      {["Nome oficial", "INEP", "Tipo de unidade", "Localização", "Situação", "Vigência", ...(canMaintain ? ["Ações"] : [])].map((h) => <th key={h} scope="col" className={registryTh}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.schoolId} className={registryRow}>
                        <td className={registryTd}><Link to="/unidades/$id" params={{ id: r.schoolId }} className="font-medium text-foreground hover:text-primary hover:underline">{r.name}</Link></td>
                        <td className={`${registryTd} font-mono text-xs tabular-nums text-muted-foreground`}>{r.inep ?? NOT_INFORMED}</td>
                        <td className={registryTd}>{unitKindText(r)}</td>
                        <td className={registryTd}>{r.location ?? NOT_INFORMED}</td>
                        <td className={registryTd}><Situation active={r.active} /></td>
                        <td className={`${registryTd} text-muted-foreground`}>{r.validFrom ? `desde ${formatAcademicDate(r.validFrom)}` : NOT_INFORMED}</td>
                        {canMaintain && <td className={registryTd}><EditLink name={r.name} /></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
              cards={shown.map((r) => (
                <RegistryCard key={r.schoolId} title={<Link to="/unidades/$id" params={{ id: r.schoolId }} className="text-foreground hover:text-primary hover:underline">{r.name}</Link>}>
                  <CardFact label="INEP"><span className="tabular-nums">{r.inep ?? NOT_INFORMED}</span></CardFact>
                  <CardFact label="Situação"><Situation active={r.active} /></CardFact>
                  <CardFact label="Tipo">{unitKindText(r)}</CardFact>
                  <CardFact label="Localização">{r.location ?? NOT_INFORMED}</CardFact>
                  {canMaintain && <div className="pt-1"><EditLink name={r.name} /></div>}
                </RegistryCard>
              ))}
            />
          )}
        </>
      )}
    </div>
  );
}

function Situation({ active }: { active: boolean | null | undefined }) {
  if (active == null) return <>{NOT_INFORMED}</>;
  return <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Ativa" : "Inativa"}</StatusBadge>;
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

type CompositionItem = { label: string; value: number; total: number };

/** Composição observada nas linhas lidas; valor ausente nunca é contado como zero de uma categoria. */
export function unitComposition(rows: { active: boolean | null; location: string | null }[]): CompositionItem[] {
  const total = rows.length;
  const items: CompositionItem[] = [{ label: "Ativas", value: rows.filter((r) => r.active === true).length, total }];
  const locs = new Map<string, number>();
  for (const r of rows) if (r.location) locs.set(r.location, (locs.get(r.location) ?? 0) + 1);
  for (const [label, value] of [...locs].sort((a, b) => b[1] - a[1])) items.push({ label, value, total });
  const missing = rows.filter((r) => !r.location).length;
  if (missing > 0) items.push({ label: "Localização não informada", value: missing, total });
  return items;
}

function CompositionStrip({ items }: { items: CompositionItem[] }) {
  return (
    <section aria-label="Composição da rede" className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {items.slice(0, 4).map((it) => (
        <div key={it.label} className="bg-card px-5 py-4">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{it.label}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">{it.value}<span className="ml-1 text-sm font-normal text-muted-foreground">de {it.total}</span></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${it.total ? (it.value / it.total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </section>
  );
}

function EditLink({ name }: { name: string }) {
  return (
    <Link to="/administracao" search={{ retorno: "/unidades" }} aria-label={`Editar ${name}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      <PencilLine className="h-3.5 w-3.5" aria-hidden />Editar
    </Link>
  );
}
