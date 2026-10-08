import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/sigem/date-input";
import { parseAcademicDate, formatDateTime } from "@/lib/academic-date";

/**
 * B2.2 — Cadastro institucional de estudantes.
 * Estudante = identidade. Nada aqui cria ou exibe matrícula, escola, turma,
 * situação, frequência ou nota. Grava só por `register_student` e
 * `record_student_identity_version`; lê só as tabelas institucionais (sem demos).
 */
type Version = {
  id: string; student_id: string; version: number; supersedes_id: string | null; civil_name: string | null; social_name: string | null;
  birth_date: string | null; sex_value_id: string | null; sex_value_version: number | null; correction_reason: string | null;
  originating_act_ref: string | null; recorded_by_person_id: string | null; recorded_via_engagement_id: string | null; created_at: string;
};
type Ident = { student_id: string; identifier_kind_id: string; identifier_kind_version: number; value: string; originating_act_ref: string | null; created_at: string };
type CatalogValue = { scheme_id: string; value_id: string; version: number; label: string; status: string };

const ERR: Record<string, string> = {
  "student:identifier-in-use": "Este identificador oficial já pertence a outro estudante. Localize o cadastro existente; nada foi gravado.",
  "student:catalog-not-homologated": "O valor escolhido não pertence a um catálogo homologado. Nada foi gravado.",
  "student:name-required": "Informe o nome civil.",
  "student:act-required": "Informe o ato ou a origem do registro.",
  "student:reason-required": "Uma correção exige motivo.",
  "student:no-change": "Nada foi alterado; nenhuma versão foi criada.",
  "student:base-superseded": "Outra pessoa registrou uma versão antes de você. Recarregue e confira.",
  "capability:": "Sua atuação vigente não concede esta operação sobre a identidade do estudante.",
};
const human = (m: string) => ERR[Object.keys(ERR).find((k) => m.includes(k)) ?? ""] ?? "Operação recusada; nada foi gravado.";
const NI = "não informado";
const opt = (s: FormDataEntryValue | null) => { const t = String(s ?? "").trim(); return t === "" ? null : t; };
const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const isHom = (s: string) => s === "homologada" || s === "homologado" || s === "homologated";
const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : NI);

export function StudentsAdminSection({ canRegister, canMaintain }: { canRegister: boolean; canMaintain: boolean }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [idents, setIdents] = useState<Ident[]>([]);
  const [catalog, setCatalog] = useState<CatalogValue[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "new" | "edit">("view");
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  const load = useCallback(async () => {
    const [v, i, c] = await Promise.all([
      supabase.from("student_identity_versions").select("*"),
      supabase.from("student_official_identifiers").select("student_id, identifier_kind_id, identifier_kind_version, value, originating_act_ref, created_at"),
      supabase.from("attribute_value_definitions").select("scheme_id, value_id, version, label, status").in("scheme_id", ["sexo-administrativo", "identificador-oficial-do-estudante"]),
    ]);
    if (v.error || i.error || c.error) { setLoadErr(true); return; }
    setLoadErr(false);
    setVersions((v.data ?? []) as unknown as Version[]);
    setIdents((i.data ?? []) as Ident[]);
    setCatalog(((c.data ?? []) as CatalogValue[]).filter((x) => isHom(x.status)));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sexOptions = catalog.filter((c) => c.scheme_id === "sexo-administrativo");
  const kindOptions = catalog.filter((c) => c.scheme_id === "identificador-oficial-do-estudante");
  const kindLabel = (id: string) => kindOptions.find((k) => k.value_id === id)?.label ?? id;
  const sexLabel = (id: string | null, ver: number | null) => (id ? sexOptions.find((s) => s.value_id === id && s.version === ver)?.label ?? id : NI);

  const students = useMemo(() => {
    const by = new Map<string, Version[]>();
    for (const v of versions) by.set(v.student_id, [...(by.get(v.student_id) ?? []), v]);
    return [...by.entries()].map(([id, vs]) => {
      const chain = [...vs].sort((a, b) => a.version - b.version);
      return { id, chain, cur: chain[chain.length - 1]!, ids: idents.filter((x) => x.student_id === id) };
    });
  }, [versions, idents]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return students
      .filter((s) => !t || `${s.cur.civil_name ?? ""} ${s.cur.social_name ?? ""}`.toLowerCase().includes(t) || s.ids.some((x) => x.value === q.trim()))
      .sort((a, b) => (a.cur.civil_name ?? "").localeCompare(b.cur.civil_name ?? "", "pt-BR"));
  }, [students, q]);
  const st = students.find((s) => s.id === sel) ?? null;

  function sexArgs(f: FormData) {
    const raw = opt(f.get("sex"));
    if (!raw) return { v: null, n: null };
    const [v, n] = raw.split("@");
    return { v: v ?? null, n: n ? Number(n) : null };
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sx = sexArgs(f);
    const identifiers = kindOptions.map((k) => ({ kind: k.value_id, version: k.version, value: String(f.get(`id-${k.value_id}`) ?? "").trim() })).filter((x) => x.value);
    const { data, error } = await supabase.rpc("register_student", {
      _civil_name: String(f.get("cname") ?? ""), _social_name: opt(f.get("sname")) as string, _birth_date: (() => { const t = opt(f.get("birth")); return t ? parseAcademicDate(t) ?? t : null; })() as string,
      _sex_value: sx.v as string, _sex_version: sx.n as number, _identifiers: identifiers, _act_ref: String(f.get("act") ?? ""),
    });
    if (error) return setErr(human(error.message));
    setErr(null); await load(); if (data) setSel(data as string); setMode("view");
  }

  async function correct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!st) return;
    const f = new FormData(e.currentTarget);
    const sx = sexArgs(f);
    const { error } = await supabase.rpc("record_student_identity_version", {
      _student: st.id, _base_version_id: st.cur.id, _civil_name: String(f.get("cname") ?? ""), _social_name: opt(f.get("sname")) as string,
      _birth_date: (() => { const t = opt(f.get("birth")); return t ? parseAcademicDate(t) ?? t : null; })() as string, _sex_value: sx.v as string, _sex_version: sx.n as number,
      _correction_reason: String(f.get("reason") ?? ""), _act_ref: opt(f.get("act")) as string,
    });
    if (error) return setErr(human(error.message));
    setErr(null); await load(); setMode("view");
  }

  const sexField = (cur?: Version) => (
    <div className="grid gap-1">
      <Label htmlFor="st-sex">Sexo administrativo</Label>
      {sexOptions.length === 0 ? (
        <p id="st-sex" className="text-sm text-muted-foreground">Indisponível: o catálogo de sexo administrativo ainda não foi homologado.</p>
      ) : (
        <select id="st-sex" name="sex" className={selectCls} defaultValue={cur?.sex_value_id ? `${cur.sex_value_id}@${cur.sex_value_version}` : ""}>
          <option value="">Não informado</option>
          {sexOptions.map((o) => <option key={`${o.value_id}@${o.version}`} value={`${o.value_id}@${o.version}`}>{o.label}</option>)}
        </select>
      )}
    </div>
  );
  const personal = (cur?: Version) => (
    <>
      <div className="grid gap-1"><Label htmlFor="st-cname">Nome civil</Label><Input id="st-cname" name="cname" required defaultValue={cur?.civil_name ?? ""} /></div>
      <div className="grid gap-1"><Label htmlFor="st-sname">Nome social (se declarado)</Label><Input id="st-sname" name="sname" defaultValue={cur?.social_name ?? ""} /></div>
      <div className="grid gap-1"><Label htmlFor="st-birth">Data de nascimento</Label><DateInput id="st-birth" name="birth" defaultValue={cur?.birth_date ?? ""} /></div>
      {sexField(cur)}
    </>
  );

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="students-h">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="students-h" className="font-display text-lg font-semibold text-foreground">Estudantes da rede</h2>
        {canRegister && <Button size="sm" onClick={() => { setMode("new"); setSel(null); setErr(null); }}>Cadastrar estudante</Button>}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">Identidade institucional do estudante. A matrícula na escola e a enturmação são feitas em outro lugar e não são criadas aqui.</p>
      {loadErr && <p className="text-sm text-destructive">Não foi possível ler o cadastro institucional de estudantes. Nenhum estudante demonstrativo é exibido no lugar.</p>}
      {mode === "new" && canRegister && (
        <form onSubmit={create} className="mb-4 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          <h3 className="font-medium sm:col-span-2">Novo estudante</h3>
          <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2"><legend className="mb-1 text-sm font-medium">Dados pessoais</legend>{personal()}</fieldset>
          <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2"><legend className="mb-1 text-sm font-medium">Identificadores oficiais</legend>
            {kindOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">Nenhum tipo de identificador oficial homologado. O estudante pode ser cadastrado sem identificador; nenhum valor é preenchido no lugar.</p>
            ) : kindOptions.map((k) => (
              <div key={k.value_id} className="grid gap-1"><Label htmlFor={`st-id-${k.value_id}`}>{k.label}</Label><Input id={`st-id-${k.value_id}`} name={`id-${k.value_id}`} /></div>
            ))}
          </fieldset>
          <div className="grid gap-1 sm:col-span-2"><Label htmlFor="st-act">Ato ou origem do registro</Label><Input id="st-act" name="act" required /></div>
          {err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{err}</p>}
          <div className="flex gap-2 sm:col-span-2"><Button type="submit">Cadastrar</Button><Button type="button" variant="outline" onClick={() => setMode("view")}>Cancelar</Button></div>
        </form>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Input placeholder="Nome ou identificador oficial exato" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Localizar estudante" className="mb-2" />
          {shown.length === 0 && !loadErr && <p className="text-sm text-muted-foreground">Nenhum estudante encontrado.</p>}
          <ul className="grid max-h-[28rem] gap-1 overflow-y-auto text-sm">
            {shown.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => { setSel(s.id); setMode("view"); setErr(null); }} aria-current={sel === s.id}
                  className={`w-full rounded-md px-2 py-1.5 text-left break-words hover:bg-muted ${sel === s.id ? "bg-muted font-medium" : ""}`}>
                  {s.cur.social_name ?? s.cur.civil_name}
                  <span className="block text-xs text-muted-foreground">{br(s.cur.birth_date)}{s.ids[0] ? ` · ${kindLabel(s.ids[0].identifier_kind_id)} ${s.ids[0].value}` : " · sem identificador oficial"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {st && (
          <div className="min-w-0 space-y-4">
            <div>
              <h3 className="font-medium break-words">{st.cur.social_name ?? st.cur.civil_name}</h3>
              <p className="text-xs text-muted-foreground">Identificação interna: {st.id} · versão {st.cur.version}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <dl className="grid gap-1 text-sm"><dt className="font-medium">Dados pessoais</dt>
                <dd>Nome civil: {st.cur.civil_name ?? NI}</dd><dd>Nome social: {st.cur.social_name ?? NI}</dd>
                <dd>Nascimento: {br(st.cur.birth_date)}</dd><dd>Sexo administrativo: {sexLabel(st.cur.sex_value_id, st.cur.sex_value_version)}</dd></dl>
              <dl className="grid gap-1 text-sm"><dt className="font-medium">Identificadores oficiais</dt>
                {st.ids.length === 0 ? <dd className="text-muted-foreground">Nenhum registrado.</dd> : st.ids.map((x) => <dd key={x.identifier_kind_id}>{kindLabel(x.identifier_kind_id)}: {x.value}</dd>)}</dl>
            </div>
            {canMaintain && mode !== "edit" && <Button size="sm" variant="outline" onClick={() => { setMode("edit"); setErr(null); }}>Corrigir dados</Button>}
            {mode === "edit" && canMaintain && (
              <form onSubmit={correct} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
                <h3 className="font-medium sm:col-span-2">Correção (gera a versão {st.cur.version + 1}; a atual é preservada)</h3>
                {personal(st.cur)}
                <div className="grid gap-1 sm:col-span-2"><Label htmlFor="st-reason">Motivo da correção</Label><Input id="st-reason" name="reason" required /></div>
                <div className="grid gap-1 sm:col-span-2"><Label htmlFor="st-act2">Ato ou documento (se houver)</Label><Input id="st-act2" name="act" /></div>
                {err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{err}</p>}
                <div className="flex gap-2 sm:col-span-2"><Button type="submit">Registrar correção</Button><Button type="button" variant="outline" onClick={() => setMode("view")}>Cancelar</Button></div>
              </form>
            )}
            <div>
              <h4 className="mb-1 text-sm font-medium">Histórico e proveniência</h4>
              <ol className="grid gap-2 text-sm">
                {[...st.chain].reverse().map((v) => (
                  <li key={v.id} className="rounded-md border border-border p-2">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant={v.id === st.cur.id ? "default" : "secondary"}>v{v.version}</Badge>
                      <span>{formatDateTime(v.created_at)}</span></div>
                    <p className="break-words">{v.civil_name ?? NI}{v.social_name ? ` (nome social: ${v.social_name})` : ""} · {br(v.birth_date)}</p>
                    {v.correction_reason && <p className="text-muted-foreground break-words">Motivo: {v.correction_reason}</p>}
                    <p className="text-xs text-muted-foreground break-words">Ato: {v.originating_act_ref ?? NI} · pessoa: {v.recorded_by_person_id ?? NI} · atuação: {v.recorded_via_engagement_id ?? NI}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
