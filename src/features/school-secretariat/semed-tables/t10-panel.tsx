import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { attachmentProblem } from "./semed-attachments";
import { T10_KINDS, T10_LEVEL_LABEL, currentFormations, divergenceText, formationProblem, formationText, type T10Formation, type T10Level, type T10Staff, type T10Version } from "./t10-staff";

/** Tabela 10: todos os servidores do cadastro central da escola + formações (ledger) com comprovante restrito. */
const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
const BUCKET = "semed-t10-comprovantes";
const ERR: Record<string, string> = {
  "sem-permissao": "Sem permissão para registrar formação nesta escola.", "base-desatualizada": "Outra pessoa alterou esta formação. Recarregue.",
  "motivo-obrigatorio": "Correção ou retirada exige motivo (mín. 5 caracteres).", "t10-curso-obrigatorio": "Informe o curso ou a área.",
  "t10-servidor-fora-da-escola": "Servidor não pertence a esta escola.", "arquivo-ausente": "Comprovante não foi enviado.",
};
const friendly = (m: string) => { const k = m.replace(/^.*semed:/, ""); return k.startsWith("t10-tabela-bloqueada") ? "Tabela em conferência, enviada ou fechada: formação não pode mudar agora." : ERR[k] ?? "Recusado."; };
const safeName = (n: string) => n.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-120);

type Edit = { staff: T10Staff; f: T10Formation | null; level: T10Level; kind: string; course: string; institution: string; year: string; reason: string };

export function T10Panel({ school, year, editable, onData }: { school: string; year: number; editable: boolean; onData: (s: T10Staff[], f: Map<string, T10Formation[]>) => void }) {
  const [staff, setStaff] = useState<T10Staff[] | null>(null); const [vers, setVers] = useState<T10Version[]>([]);
  const [q, setQ] = useState(""); const [onlyPending, setOnlyPending] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null); const [busy, setBusy] = useState(false); const [seeEvidence, setSeeEvidence] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const [r, v, e] = await Promise.all([rpc("semed_t10_roster", { _school: school }),
      db.from("semed_t10_formation_versions").select("id, formation_id, version, staff_key, level, kind, course, institution, conclusion_year, withdrawn, reason, evidence_path, evidence_name, recorded_at").eq("school_id", school).eq("year", year).order("version"),
      rpc("semed_t10_can_see_evidence", { _school: school })]);
    setStaff(r.error ? [] : (r.data as T10Staff[])); setVers((v.data ?? []) as T10Version[]); setSeeEvidence(e.data === true);
    if (r.error) setMsg("Não foi possível ler o quadro de servidores.");
  }, [school, year]);
  useEffect(() => { void load(); }, [load]);
  const forms = useMemo(() => currentFormations(vers), [vers]);
  useEffect(() => { if (staff) onData(staff, forms); }, [staff, forms, onData]);

  const shown = (staff ?? []).filter((s) => (!q || s.nome.toLowerCase().includes(q.toLowerCase())) && (!onlyPending || !(forms.get(s.staff_key) ?? []).length));
  const start = (s: T10Staff, f: T10Formation | null) => setEdit({ staff: s, f, level: f?.level ?? "superior", kind: f?.kind ?? "licenciatura", course: f?.course ?? "", institution: f?.institution ?? "", year: f?.conclusion_year ? String(f.conclusion_year) : "", reason: "" });

  const save = async (withdraw = false) => {
    if (!edit) return;
    if (!withdraw) { const p = formationProblem(edit.level, edit.kind, edit.course); if (p) { setMsg(p); return; } }
    if ((edit.f || withdraw) && edit.reason.trim().length < 5) { setMsg("Correção ou retirada exige motivo (mín. 5 caracteres)."); return; }
    const file = fileRef.current?.files?.[0];
    if (file) { const p = attachmentProblem(file); if (p) { setMsg(p); return; } }
    setBusy(true);
    let path: string | null = null;
    if (file && !withdraw) {
      path = `${school}/${year}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) { setBusy(false); setMsg("Envio do comprovante recusado."); return; }
    }
    const r = await rpc("semed_t10_record_formation", { _school: school, _year: year, _staff_record_id: edit.staff.staff_record_id, _formation_id: edit.f?.formation_id ?? null,
      _expected_version: edit.f?.version ?? null, _level: edit.level, _kind: edit.kind, _course: edit.course || null, _institution: edit.institution || null,
      _conclusion_year: edit.year ? Number(edit.year) : null, _withdraw: withdraw, _reason: edit.reason || null,
      _evidence_path: path, _evidence_name: file && path ? file.name : null, _evidence_mime: file && path ? file.type : null });
    setBusy(false);
    if (r.error) { setMsg(friendly(r.error.message)); return; }
    setMsg(withdraw ? "Formação retirada (continua no histórico)." : edit.f ? "Correção registrada como nova versão." : "Formação registrada."); setEdit(null); await load();
  };
  const openEvidence = async (p: string) => {
    const s = await supabase.storage.from(BUCKET).createSignedUrl(p, SIGNED_URL_TTL_SECONDS);
    if (s.error || !s.data) { setMsg("Comprovante indisponível para sua conta."); return; }
    window.open(s.data.signedUrl, "_blank", "noopener");
  };

  if (staff === null) return <p className="text-xs text-muted-foreground" role="status">Lendo o quadro de servidores…</p>;
  const pending = staff.filter((s) => !(forms.get(s.staff_key) ?? []).length).length;
  return (
    <section className="space-y-3 rounded-md border p-3" aria-label="Servidores e escolarização">
      <h3 className="text-sm font-semibold">Servidores da unidade ({staff.length} no cadastro central · {pending} sem formação informada)</h3>
      <p className="text-xs text-muted-foreground">Nome, cargo e função vêm do cadastro central de pessoal e não são digitados aqui; divergências devem ser corrigidas na origem. Comprovantes só são vistos por quem preenche na escola e pela rede.</p>
      {staff.length === 0 && <p className="text-sm">Nenhum servidor desta escola no cadastro central de pessoal.</p>}
      {staff.length > 0 && <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Buscar servidor" placeholder="Buscar por nome" className="rounded-md border border-input bg-background p-1 text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="text-xs"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> só sem formação</label>
      </div>}
      <ol className="space-y-2">{shown.map((s) => { const fl = forms.get(s.staff_key) ?? []; return (
        <li key={s.staff_key} className="rounded border p-2 text-xs" data-testid="t10-servidor">
          <div className="flex flex-wrap items-baseline gap-2"><strong className="text-sm">{s.nome}</strong><span>{s.cargo || "sem cargo"}{s.funcao ? ` · ${s.funcao}` : ""}</span>{s.matricula && <span className="text-muted-foreground">mat. {s.matricula}</span>}</div>
          {s.divergencias.length > 0 && <p className="text-destructive">Divergência: {s.divergencias.map(divergenceText).join("; ")}</p>}
          {fl.length === 0 ? <p className="text-muted-foreground">Formação não informada.</p> : <ul>{fl.map((f) => <li key={f.formation_id} className="flex flex-wrap items-center gap-2">
            <span>{T10_LEVEL_LABEL[f.level]}: {formationText(f)}{f.institution ? ` · ${f.institution}` : ""}{f.conclusion_year ? ` · ${f.conclusion_year}` : ""} <span className="text-muted-foreground">(v{f.version})</span></span>
            {f.evidence && (seeEvidence ? <button type="button" className="underline" onClick={() => void openEvidence(f.evidence!.path)}>comprovante</button> : <span className="text-muted-foreground">comprovante registrado</span>)}
            {editable && <Button size="sm" variant="ghost" onClick={() => start(s, f)}>Corrigir</Button>}
            {f.history.length > 1 && <details><summary className="cursor-pointer text-muted-foreground">histórico</summary><ol>{f.history.map((h) => <li key={h.id}>v{h.version} · {new Date(h.recorded_at).toLocaleString("pt-BR")} · {formationText(h)}{h.reason ? ` · motivo: ${h.reason}` : ""}</li>)}</ol></details>}
          </li>)}</ul>}
          {editable && <Button size="sm" variant="outline" className="mt-1" onClick={() => start(s, null)}>Adicionar formação</Button>}
          {edit?.staff.staff_key === s.staff_key && (
            <div className="mt-2 grid gap-2 rounded border p-2 sm:grid-cols-3">
              <label>Nível<br /><select aria-label="Nível" className="rounded border border-input bg-background p-1" value={edit.level} disabled={!!edit.f} onChange={(e) => { const l = e.target.value as T10Level; setEdit({ ...edit, level: l, kind: Object.keys(T10_KINDS[l])[0]! }); }}>
                {(Object.keys(T10_KINDS) as T10Level[]).map((l) => <option key={l} value={l}>{T10_LEVEL_LABEL[l]}</option>)}</select></label>
              <label>Tipo<br /><select aria-label="Tipo" className="rounded border border-input bg-background p-1" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                {Object.entries(T10_KINDS[edit.level]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>Curso/área<br /><input aria-label="Curso ou área" className="w-full rounded border border-input bg-background p-1" maxLength={200} value={edit.course} onChange={(e) => setEdit({ ...edit, course: e.target.value })} /></label>
              <label>Instituição (opcional)<br /><input aria-label="Instituição" className="w-full rounded border border-input bg-background p-1" maxLength={200} value={edit.institution} onChange={(e) => setEdit({ ...edit, institution: e.target.value })} /></label>
              <label>Ano de conclusão (opcional)<br /><input aria-label="Ano de conclusão" type="number" min={1940} max={2100} className="w-full rounded border border-input bg-background p-1" value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value })} /></label>
              <label>Comprovante (PDF/JPG/PNG, opcional)<br /><input ref={fileRef} type="file" aria-label="Comprovante" accept=".pdf,.jpg,.jpeg,.png" /></label>
              {edit.f && <label className="sm:col-span-3">Motivo da correção ou retirada<br /><input aria-label="Motivo" className="w-full rounded border border-input bg-background p-1" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /></label>}
              <div className="flex gap-2 sm:col-span-3"><Button size="sm" disabled={busy} onClick={() => void save()}>{edit.f ? "Salvar correção" : "Registrar formação"}</Button>
                {edit.f && <Button size="sm" variant="outline" disabled={busy} onClick={() => void save(true)}>Retirar formação</Button>}
                <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></div>
            </div>)}
        </li>); })}</ol>
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </section>
  );
}
