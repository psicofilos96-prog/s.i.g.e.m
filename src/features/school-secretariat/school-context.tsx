import { useEffect, useState } from "react";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { supabase } from "@/integrations/supabase/client";
import { readYears, type YearOption } from "@/features/year-transition/year-transition-source";
import { yearStateLabel } from "./secretariat";

export const SECRETARIAT_READ_CAPABILITY = "consultar-matricula-e-movimentacao";
/** Mais recente por escola, só entre as autorizadas. */
export function schoolsForContext(allowed: ReadonlySet<string>, rows: readonly { school_id: string; official_name: string }[]) {
  const m = new Map<string, string>();
  for (const r of rows) if (allowed.has(r.school_id) && !m.has(r.school_id)) m.set(r.school_id, r.official_name);
  return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Escola e ano do escopo da sessão: só escolas que a RLS devolve; uma só ⇒ fixada. Sem identificador técnico na tela. */
export function useSchoolContext() {
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [years, setYears] = useState<YearOption[]>([]);
  const [school, setSchool] = useState(""); const [year, setYear] = useState("");
  const own = useOwnSchoolId();
  useEffect(() => { if (own) setSchool(own); }, [own]);
  useEffect(() => {
    // Só escolas onde a conta tem a capability que as telas da Secretaria exigem; listar todas levava a "Sem permissão nesta escola".
    const allowed = (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>)("school_capability_schools", { _capability: SECRETARIAT_READ_CAPABILITY });
    Promise.all([allowed, supabase.from("institutional_school_record_versions").select("school_id,official_name,version_number").order("version_number", { ascending: false })])
      .then(([a, { data }]) => {
        const ok = new Set(((a.data ?? []) as unknown[]).map((x) => (typeof x === "string" ? x : Object.values(x as object)[0] as string)));
        const list = schoolsForContext(ok, (data ?? []) as { school_id: string; official_name: string }[]);
        setSchools(list); if (list.length === 1) setSchool(list[0]!.id);
      });
    readYears().then((ys) => { setYears(ys); if (ys.length) setYear((ys.find((y) => y.state === "aberto") ?? ys[0]!).id); }).catch(() => setYears([]));
  }, []);
  const schoolName = schools?.find((s) => s.id === school)?.name ?? "";
  const yearLabel = years.find((y) => y.id === year)?.label ?? "";
  return { schools, years, school, setSchool, year, setYear, schoolName, yearLabel, own };
}

export function SchoolContextPicker({ ctx }: { ctx: ReturnType<typeof useSchoolContext> }) {
  const sel = "mt-1 block w-full rounded-md border border-input bg-background p-2";
  return (
    <section aria-label="Escola e ano" className="grid gap-3 sm:grid-cols-2">
      {ctx.own || (ctx.schools && ctx.schools.length === 1) ? <p className="text-sm"><span className="text-muted-foreground">Escola</span><br /><strong>{ctx.schoolName || "Minha escola"}</strong></p> : (
        <label className="text-sm">Escola
          <select className={sel} value={ctx.school} onChange={(e) => ctx.setSchool(e.target.value)}>
            <option value="">{ctx.schools === null ? "Carregando…" : "Escolha a escola"}</option>
            {(ctx.schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>)}
      <label className="text-sm">Ano letivo
        <select className={sel} value={ctx.year} onChange={(e) => ctx.setYear(e.target.value)}>
          <option value="">Escolha o ano</option>
          {ctx.years.map((y) => <option key={y.id} value={y.id}>{y.label} — {yearStateLabel(y.state)}</option>)}
        </select></label>
    </section>
  );
}
