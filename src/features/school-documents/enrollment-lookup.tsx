/**
 * Secretaria: busca de matrícula na escola e declaração do início efetivo (append-only, motivo obrigatório).
 * A data nunca é inferida da carga técnica; sem declaração a declaração escolar continua não elegível.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { formatDate } from "@/lib/academic-date";
import { documentMessage } from "./document-engine";

export type EnrollmentHit = {
  enrollment_id: string; student_id: string; student_name: string; institutional_identifier: string | null;
  start_on: string | null; start_source: string | null; declaration_head: string | null; class_label: string | null; ended_on: string | null;
};
type R = { data: unknown; error: { message: string } | null };
const rpc = (fn: string, a: Record<string, unknown>) => (supabase.rpc as unknown as (f: string, x: Record<string, unknown>) => Promise<R>)(fn, a);

export function EnrollmentLookup({ school, validOn, onPick }: { school: string; validOn: string; onPick: (studentId: string) => void }) {
  const [q, setQ] = useState(""); const [hits, setHits] = useState<EnrollmentHit[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [declaring, setDeclaring] = useState<EnrollmentHit | null>(null);
  const [start, setStart] = useState(""); const [reason, setReason] = useState(""); const [src, setSrc] = useState("");

  async function search() {
    setMsg(null); setHits(null);
    if (!school.trim()) { setMsg("Informe a escola."); return; }
    if (q.trim().length < 3) { setMsg("Digite ao menos 3 letras do nome ou o identificador."); return; }
    setBusy(true);
    const r = await rpc("secretariat_enrollment_lookup", { _school: school.trim(), _query: q.trim(), _on: validOn });
    setBusy(false);
    if (r.error) { setMsg(documentMessage(new Error(r.error.message))); return; }
    setHits((r.data as EnrollmentHit[]) ?? []);
  }
  async function declare() {
    if (!declaring) return;
    setMsg(null);
    const r = await rpc("secretariat_declare_enrollment_start", { _enrollment: declaring.enrollment_id, _start_on: start || null,
      _expected_head: declaring.declaration_head, _reason: reason, _source_ref: src || null });
    if (r.error) { setMsg(documentMessage(new Error(r.error.message))); return; }
    setMsg("Início da matrícula declarado."); setDeclaring(null); setStart(""); setReason(""); setSrc(""); await search();
  }

  return (
    <section aria-labelledby="busca" className="space-y-3">
      <h2 id="busca" className="font-semibold">Buscar estudante matriculado</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Nome ou identificador<Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} /></label>
        <Button variant="outline" onClick={search} disabled={busy}>{busy ? "Buscando…" : "Buscar"}</Button>
      </div>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
      {hits !== null && hits.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma matrícula vigente encontrada nesta escola.</p> : null}
      {hits && hits.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border" aria-label="Matrículas encontradas">
          {hits.map((h) => (
            <li key={h.enrollment_id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-medium">{h.student_name}</p>
                <p className="text-muted-foreground">{h.class_label ? `Turma ${h.class_label}` : "Sem turma vigente nesta data"} · início:{" "}
                  {h.start_on ? `${formatDate(h.start_on)}${h.start_source === "declaracao-da-secretaria" ? " (declarado pela secretaria)" : ""}` : "não registrado"}
                  {h.ended_on ? ` · encerrada em ${formatDate(h.ended_on)}` : ""}</p>
              </div>
              <div className="flex gap-2">
                {!h.start_on ? <Button size="sm" variant="outline" onClick={() => setDeclaring(h)}>Declarar início</Button> : null}
                <Button size="sm" onClick={() => onPick(h.student_id)}>Usar este estudante</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {declaring ? (
        <div className="space-y-2 rounded-md border border-border p-3" role="group" aria-label="Declarar início da matrícula">
          <p className="text-sm">A carga oficial não trouxe a data de início da matrícula de <strong>{declaring.student_name}</strong>. Declare a data conforme o registro da escola; a declaração fica gravada com seu nome e motivo e não pode ser apagada.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-sm">Data de início<DateInput value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="text-sm">Motivo<Input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <label className="text-sm">Fonte (livro, ficha — opcional)<Input value={src} onChange={(e) => setSrc(e.target.value)} /></label>
          </div>
          <div className="flex gap-2"><Button size="sm" onClick={declare}>Gravar declaração</Button>
            <Button size="sm" variant="outline" onClick={() => setDeclaring(null)}>Cancelar</Button></div>
        </div>
      ) : null}
    </section>
  );
}
