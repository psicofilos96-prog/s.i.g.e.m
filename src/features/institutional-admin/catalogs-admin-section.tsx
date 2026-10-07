import { SkeletonState } from "@/components/sigem/guidance";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  humanCatalogError, loadCatalog, recordCatalogValue, type CatalogValue,
} from "./institutional-catalog-source";

/**
 * B2.6 — Catálogos Institucionais. Mostra esquemas, valores, versões, situação,
 * vigência e ato de homologação. Sem valores pré-definidos: catálogo vazio é exibido como tal.
 */
const fmt = (d: string | null) => (d ? formatAcademicDate(d) : "sem data");
const errText = (e: unknown) => humanCatalogError(String((e as { message?: string })?.message ?? e));

function Field({ label, name, defaultValue, type = "text", required }: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={`cat-${name}`} className="text-xs">{label}</Label>
      <Input id={`cat-${name}`} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}
function StatusField({ defaultValue = "rascunho" }: { defaultValue?: string }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor="cat-status" className="text-xs">Situação</Label>
      <select id="cat-status" name="status" defaultValue={defaultValue} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
        <option value="rascunho">Rascunho</option>
        <option value="homologada">Homologada</option>
      </select>
    </div>
  );
}
const str = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v || null; };

export function CatalogsAdminSection({ canMaintain }: { canMaintain: boolean }) {
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ["inst-catalog"], queryFn: loadCatalog });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try {
      await recordCatalogValue({ schemeId: String(f.get("scheme")).trim(), valueId: String(f.get("value")).trim(), baseVersion: null,
        label: String(f.get("label")), status: f.get("status") === "homologada" ? "homologada" : "rascunho",
        validFrom: str(f, "from"), actRef: str(f, "act"), reason: null });
      setCreating(false); setErr(null); await qc.invalidateQueries({ queryKey: ["inst-catalog"] });
    } catch (x) { setErr(errText(x)); }
  }
  const schemes = catalog.data ?? [];
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm" aria-label="Catálogos Institucionais">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Catálogos Institucionais</h2>
          <p className="text-xs text-muted-foreground">Valores versionados por esquema. Só valores homologados podem ser usados na turma.</p>
        </div>
        {canMaintain ? <Button size="sm" variant="outline" onClick={() => setCreating((v) => !v)}>Cadastrar valor</Button> : null}
      </header>
      {creating ? (
        <form onSubmit={create} className="mb-3 grid gap-2 rounded-md border border-border p-3" aria-label="Novo valor de catálogo">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Esquema (identificador)" name="scheme" required />
            <Field label="Valor (identificador permanente)" name="value" required />
            <Field label="Rótulo" name="label" required />
            <StatusField />
            <Field label="Vigência — início (opcional)" name="from" type="date" />
            <Field label="Ato de homologação" name="act" />
          </div>
          {err ? <p role="alert" className="text-sm text-destructive">{err}</p> : null}
          <div><Button type="submit" size="sm">Registrar</Button></div>
        </form>
      ) : null}
      {catalog.isLoading ? <SkeletonState label="Carregando catálogos" /> : null}
      {catalog.error ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar os catálogos.</p> : null}
      {catalog.data && schemes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhum valor institucional cadastrado. Nenhum valor é criado automaticamente.
        </p>
      ) : null}
      <div className="grid gap-3">
        {schemes.map((s) => (
          <div key={s.schemeId} className="rounded-md border border-border p-3">
            <h3 className="mb-2 text-sm font-medium">Esquema <code className="text-xs">{s.schemeId}</code></h3>
            <ul className="grid gap-2">
              {s.values.map((v) => <ValueRow key={v.valueId} v={v} canMaintain={canMaintain} />)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ValueRow({ v, canMaintain }: { v: CatalogValue; canMaintain: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const l = v.latest;
  async function version(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try {
      await recordCatalogValue({ schemeId: v.schemeId, valueId: v.valueId, baseVersion: l.version, label: String(f.get("label")),
        status: f.get("status") === "homologada" ? "homologada" : "rascunho", validFrom: str(f, "from"), actRef: str(f, "act"), reason: str(f, "reason") });
      setOpen(false); setErr(null); await qc.invalidateQueries({ queryKey: ["inst-catalog"] });
    } catch (x) { setErr(errText(x)); }
  }
  return (
    <li className="rounded border border-border/60 p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{l.label}</span>
        <code className="text-xs text-muted-foreground">{v.valueId}</code>
        <Badge variant={l.status === "homologada" ? "secondary" : "outline"}>{l.status === "homologada" ? "Homologada" : "Rascunho"}</Badge>
        <span className="text-xs text-muted-foreground">Versão {l.version} · vigência desde {fmt(l.validFrom)}{l.homologationActRef ? ` · ato ${l.homologationActRef}` : ""}</span>
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((x) => !x)}>Histórico</Button>
          {canMaintain ? <Button size="sm" variant="outline" onClick={() => setOpen((x) => !x)}>Nova versão</Button> : null}
        </span>
      </div>
      {showHistory ? (
        <ol className="mt-2 grid gap-1 text-xs text-muted-foreground" aria-label={`Histórico de ${v.valueId}`}>
          {[...v.versions].reverse().map((h) => (
            <li key={h.version}>Versão {h.version}: {h.label} · {h.status} · desde {fmt(h.validFrom)}{h.homologationActRef ? ` · ato ${h.homologationActRef}` : ""}{h.changeReason ? ` · ${h.changeReason}` : ""}</li>
          ))}
        </ol>
      ) : null}
      {open ? (
        <form onSubmit={version} className="mt-2 grid gap-2 sm:grid-cols-3" aria-label={`Nova versão de ${v.valueId}`}>
          <Field label="Rótulo" name="label" defaultValue={l.label} required />
          <StatusField defaultValue={l.status} />
          <Field label="Vigência — início" name="from" type="date" defaultValue={l.validFrom ?? ""} />
          <Field label="Ato de homologação" name="act" defaultValue={l.homologationActRef ?? ""} />
          <Field label="Motivo" name="reason" required />
          <div className="flex items-end"><Button type="submit" size="sm">Registrar versão</Button></div>
          {err ? <p role="alert" className="text-sm text-destructive sm:col-span-3">{err}</p> : null}
        </form>
      ) : null}
    </li>
  );
}
