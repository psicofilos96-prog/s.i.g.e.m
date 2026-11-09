import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callRpc } from "@/lib/rpc-call";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { OwnSchoolName } from "@/features/authority/own-school-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/sigem/patterns";
import { visitsIn, type VisitRow } from "./visit-record";
import { VISITOR_KIND_DEFAULTS, visitorKindLabel } from "./visitor-kinds";

const today = () => new Date().toLocaleDateString("sv-SE");
const fmt = (d: string) => d.split("-").reverse().join("/");

export function VisitBookPage() {
  const school = useOwnSchoolId();
  if (!school) {
    return <EmptyState title="Livro de visitas da escola" description="Esta tela é usada pela conta da Secretaria ou da Direção de uma escola." />;
  }
  return <VisitBook school={school} />;
}

function VisitBook({ school }: { school: string }) {
  const qc = useQueryClient();
  const key = ["school-visits-book", school];
  const q = useQuery({ queryKey: key, queryFn: () => callRpc<VisitRow[]>("school_visits_book", { _school: school }) });
  const [form, setForm] = useState({ date: today(), kind: VISITOR_KIND_DEFAULTS[0]!.id, name: "", origin: "" });
  const [annul, setAnnul] = useState<{ row: VisitRow; reason: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (a: { logical: string | null; base: string | null; annul: boolean; reason: string | null; row?: VisitRow }) =>
      callRpc<string>("record_school_visit", {
        _logical: a.logical, _base: a.base, _school: school,
        _visited_on: a.row ? a.row.visited_on : form.date,
        _kind: a.row ? a.row.visitor_kind_id : form.kind,
        _identification: a.row ? a.row.declared_identification : form.name,
        _origin: a.row ? a.row.origin_organization : form.origin,
        _annul: a.annul, _correction_reason: a.reason,
      }),
    onSuccess: () => { setErr(null); setAnnul(null); setForm((f) => ({ ...f, name: "", origin: "" })); void qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => setErr(e.message || "Não foi possível gravar a visita."),
  });

  const rows = visitsIn(q.data ?? [], school, "0000-01-01", "9999-12-31").reverse();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Livro de visitas da escola</h1>
        <p className="text-sm text-muted-foreground"><OwnSchoolName schoolId={school} /> · as visitas registradas aqui aparecem na Seção VI (Visitas recebidas) do Mapa Estatístico do mês.</p>
      </header>

      <form
        className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2"
        onSubmit={(e) => { e.preventDefault(); save.mutate({ logical: null, base: null, annul: false, reason: null }); }}
      >
        <div className="space-y-1"><Label htmlFor="v-date">Data da visita</Label>
          <Input id="v-date" type="date" max={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
        <div className="space-y-1"><Label htmlFor="v-kind">Quem visitou (cargo/setor)</Label>
          <select id="v-kind" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {VISITOR_KIND_DEFAULTS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Padrão do sistema</p></div>
        <div className="space-y-1"><Label htmlFor="v-name">Nome do visitante</Label>
          <Input id="v-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="space-y-1"><Label htmlFor="v-origin">Órgão ou instituição (opcional)</Label>
          <Input id="v-origin" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={save.isPending || !form.name.trim()}>{save.isPending ? "Gravando…" : "Registrar visita"}</Button>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="font-serif text-lg">Visitas registradas</h2>
        {q.isPending ? <p className="text-sm text-muted-foreground">Carregando visitas…</p>
          : q.isError ? <div className="space-y-2"><p className="text-sm text-destructive">Não foi possível ler as visitas.</p><Button variant="outline" size="sm" onClick={() => void q.refetch()}>Tentar novamente</Button></div>
          : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro.</p>
          : (
            <ul className="divide-y rounded-lg border bg-card">
              {rows.map((r) => (
                <li key={r.logical_id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div><p className="font-medium">{fmt(r.visited_on)} · {visitorKindLabel(r.visitor_kind_id)}</p>
                    <p className="text-muted-foreground">{r.declared_identification}{r.origin_organization ? ` — ${r.origin_organization}` : ""}</p></div>
                  {annul?.row.logical_id === r.logical_id ? (
                    <div className="flex items-center gap-2">
                      <Input aria-label="Motivo da anulação" placeholder="Motivo" value={annul.reason} onChange={(e) => setAnnul({ row: r, reason: e.target.value })} />
                      <Button size="sm" variant="destructive" disabled={!annul.reason.trim() || save.isPending}
                        onClick={() => save.mutate({ logical: r.logical_id, base: r.id, annul: true, reason: annul.reason, row: r })}>Anular</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAnnul(null)}>Cancelar</Button>
                    </div>
                  ) : <Button size="sm" variant="outline" onClick={() => setAnnul({ row: r, reason: "" })}>Anular registro</Button>}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
