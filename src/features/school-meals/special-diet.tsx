import { DateInput } from "@/components/sigem/date-input";
import { useCallback, useEffect, useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Condições listadas no documento da Alimentação; "Outra" permite descrever. Lista de opções, não limite. */
export const DIET_NEEDS = ["Diabetes", "Intolerância à lactose / APLV", "Doença celíaca", "Alergia alimentar", "Outra"] as const;

type Row = { request_id: string; school_id: string; student_name: string; need: string; report_path: string; report_until: string | null;
  requested_at: string; outcome: string | null; menu_condition: string | null; handling_note: string | null; valid_until: string | null };

const msg = (e: unknown) => {
  const m = (e as Error).message ?? "";
  if (m.includes("secretaria-only")) return "Só a Secretaria da escola pode pedir.";
  if (m.includes("nutricionista-only")) return "Só o setor de Alimentação (nutricionista) decide.";
  if (m.includes("autor-nao-decide")) return "Quem pediu não pode decidir o mesmo pedido.";
  if (m.includes("ja-decidido")) return "Este pedido já foi decidido.";
  if (m.includes("fora-da-escola")) return "O estudante não está matriculado nesta escola.";
  if (m.includes("not-authorized") || m.includes("grant")) return "Sem permissão para ver esta lista.";
  return "Não foi possível concluir. Tente de novo.";
};

async function sha256(f: File) {
  const b = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function Status({ r }: { r: Row }) {
  if (!r.outcome) return <span className="text-warning">Aguardando nutricionista</span>;
  return r.outcome === "deferido" ? <span className="text-success">Deferido — {r.menu_condition}</span> : <span className="text-destructive">Indeferido</span>;
}

async function openReport(path: string) {
  const { data } = await supabase.storage.from("alimentacao-laudos").createSignedUrl(path, 120);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
}

/** Secretaria: pede alimentação especial com laudo anexado. */
export function SpecialDietRequestPanel({ school }: { school: string }) {
  const [q, setQ] = useState(""); const [found, setFound] = useState<{ student_id: string; student_name: string }[]>([]);
  const [student, setStudent] = useState<{ student_id: string; student_name: string } | null>(null);
  const [need, setNeed] = useState<string>(DIET_NEEDS[0]); const [other, setOther] = useState("");
  const [file, setFile] = useState<File | null>(null); const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false); const [note, setNote] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(() => { callRpc<Row[]>("meal_special_diets_at", { _school: school }).then(setRows, () => setRows([])); }, [school]);
  useEffect(load, [load]);

  const send = async () => {
    if (!student || !file) return;
    const text = need === "Outra" ? other.trim() : need;
    if (text.length < 3) { setNote("Descreva a necessidade."); return; }
    setBusy(true); setNote(null);
    try {
      const hash = await sha256(file);
      const path = `${school}/${key}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("alimentacao-laudos").upload(path, file, { upsert: false });
      if (up.error && !/exists/i.test(up.error.message)) throw new Error(up.error.message);
      await callRpc("request_meal_special_diet", { _school: school, _student: student.student_id, _need: text, _path: path, _sha256: hash, _until: until || null, _key: key });
      setNote("Pedido enviado à nutricionista."); setStudent(null); setFile(null); setKey(crypto.randomUUID()); load();
    } catch (e) { setNote(msg(e)); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Alimentação especial</h2>
      <p className="text-sm text-muted-foreground">Envie o laudo. A nutricionista decide e a cozinha recebe a lista.</p>
      {!student ? (
        <div className="space-y-2">
          <div className="flex gap-2"><Input placeholder="Nome do estudante" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="outline" disabled={q.trim().length < 3} onClick={() => callRpc<typeof found>("meal_special_diet_student_search", { _school: school, _q: q }).then(setFound, () => setFound([]))}>Buscar</Button></div>
          {found.map((s) => <button key={s.student_id} className="block w-full rounded border p-2 text-left hover:bg-muted" onClick={() => setStudent(s)}>{s.student_name}</button>)}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-medium">{student.student_name} <button className="text-sm text-primary underline" onClick={() => setStudent(null)}>trocar</button></p>
          <label className="block text-sm">Necessidade
            <select className="mt-1 block w-full rounded border bg-background p-2" value={need} onChange={(e) => setNeed(e.target.value)}>
              {DIET_NEEDS.map((n) => <option key={n}>{n}</option>)}</select></label>
          {need === "Outra" && <Input placeholder="Descreva" value={other} onChange={(e) => setOther(e.target.value)} />}
          <label className="block text-sm">Laudo médico (obrigatório)
            <input className="mt-1 block" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <label className="block text-sm">Laudo válido até (se houver)<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <Button disabled={busy || !file} onClick={() => void send()}>{busy ? "Enviando…" : "Enviar pedido"}</Button>
        </div>
      )}
      {note && <p role="status" className="text-sm">{note}</p>}
      {rows && rows.length > 0 && <ul className="divide-y text-sm">{rows.map((r) => <li key={r.request_id} className="py-2"><b>{r.student_name}</b> — {r.need} · <Status r={r} /></li>)}</ul>}
    </section>
  );
}

/** Nutricionista (setor Alimentação): analisa laudos da rede e decide. */
export function SpecialDietReviewPanel() {
  const [rows, setRows] = useState<Row[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { condition: string; note: string; reason: string }>>({});
  const load = useCallback(() => { callRpc<Row[]>("meal_special_diets_at", { _school: null }).then((r) => { setRows(r); setErr(null); }, (e) => setErr(msg(e))); }, []);
  useEffect(load, [load]);
  const decide = async (r: Row, outcome: "deferido" | "indeferido") => {
    const f = form[r.request_id] ?? { condition: "", note: "", reason: "" };
    if (f.reason.trim().length < 3) { setErr("Escreva o motivo da decisão."); return; }
    if (outcome === "deferido" && !f.condition.trim()) { setErr("Informe o cardápio adaptado."); return; }
    try { await callRpc("decide_meal_special_diet", { _request: r.request_id, _outcome: outcome, _condition: f.condition, _note: f.note, _until: null, _reason: f.reason }); load(); }
    catch (e) { setErr(msg(e)); }
  };
  if (err && !rows) return <p className="text-sm text-muted-foreground">{err}</p>;
  if (!rows) return <p className="text-sm text-muted-foreground">Carregando pedidos…</p>;
  const pending = rows.filter((r) => !r.outcome);
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Alimentação especial — laudos</h2>
      {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum laudo aguardando.</p> : pending.map((r) => {
        const f = form[r.request_id] ?? { condition: "", note: "", reason: "" };
        const set = (k: keyof typeof f, v: string) => setForm({ ...form, [r.request_id]: { ...f, [k]: v } });
        return (
          <div key={r.request_id} className="space-y-2 rounded border p-3">
            <p><b>{r.student_name}</b> — {r.need} <button className="ml-2 text-sm text-primary underline" onClick={() => void openReport(r.report_path)}>ver laudo</button></p>
            <Input placeholder="Cardápio adaptado (ex.: sem lactose)" value={f.condition} onChange={(e) => set("condition", e.target.value)} />
            <Textarea placeholder="Orientação curta para a cozinha" value={f.note} onChange={(e) => set("note", e.target.value)} />
            <Input placeholder="Motivo da decisão" value={f.reason} onChange={(e) => set("reason", e.target.value)} />
            <div className="flex gap-2"><Button onClick={() => void decide(r, "deferido")}>Deferir</Button><Button variant="outline" onClick={() => void decide(r, "indeferido")}>Indeferir</Button></div>
          </div>
        );
      })}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <p className="text-sm text-muted-foreground">Decididos: {rows.length - pending.length}</p>
    </section>
  );
}

/** Cozinha: lista nominal do dia (cada abertura fica registrada). */
export function SpecialDietKitchenList({ school, today }: { school: string; today: string }) {
  const [rows, setRows] = useState<{ student_name: string; class_label: string | null; menu_condition: string; handling_note: string | null }[] | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => { callRpc<typeof rows>("meal_special_diet_kitchen_list", { _school: school, _on: today }).then(setRows, () => setDenied(true)); }, [school, today]);
  if (denied) return null;
  return (
    <section className="space-y-2 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Alimentação especial de hoje</h2>
      {!rows ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum estudante com alimentação especial deferida.</p> :
        <ul className="divide-y text-sm">{rows.map((r, i) => <li key={i} className="py-2"><b>{r.student_name}</b>{r.class_label ? ` · ${r.class_label}` : ""} — {r.menu_condition}{r.handling_note ? <span className="block text-muted-foreground">{r.handling_note}</span> : null}</li>)}</ul>}
    </section>
  );
}
