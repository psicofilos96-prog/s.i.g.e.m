import { PageHeader } from "@/components/sigem/patterns";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { WarningNote } from "@/components/sigem/states";
import { askAssistant } from "./assistant.functions";
import type { Answer } from "./assistant-core";

export function AssistantPanel() {
  const route = useRouterState({ select: (s) => s.location.pathname });
  const ask = useServerFn(askAssistant);
  const [q, setQ] = useState("");
  const [classId, setClassId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<Answer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try { setA(await ask({ data: { question: q, route, classId: classId.trim() || null, schoolId: schoolId.trim() || null } })); }
    catch { setErr("Não foi possível consultar agora. Entre novamente e tente de novo."); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <PageHeader eyebrow="Ajuda" title="Assistente do SIGEM" description="Responde só com o que você já pode consultar e mostra de onde tirou cada informação. Não altera nada." />
      <Textarea aria-label="Sua pergunta" placeholder="Ex.: Onde encontro o calendário? Por que esta turma está sem matriz?" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="Código da turma (opcional)" placeholder="Código da turma (opcional)" value={classId} onChange={(e) => setClassId(e.target.value)} />
        <Input aria-label="Código da escola (opcional)" placeholder="Código da escola (opcional)" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} />
      </div>
      <Button disabled={busy || q.trim().length < 2} onClick={submit}>{busy ? "Consultando…" : "Perguntar"}</Button>
      {err && <WarningNote>{err}</WarningNote>}
      {a && (
        <section aria-live="polite" className="space-y-3 rounded-md border border-border p-4">
          <p className="whitespace-pre-wrap">{a.text}</p>
          {a.citations.length > 0 && (
            <div>
              <h2 className="text-sm font-medium">Fontes</h2>
              <ul className="text-sm">
                {a.citations.map((c) => <li key={c.id}>{c.title}{c.to ? <> — <Link className="underline" to={c.to as never}>abrir</Link></> : null}</li>)}
              </ul>
            </div>
          )}
          {!a.grounded && !a.refused && <p className="text-xs text-muted-foreground">Sem fonte consultável, o assistente não responde por conta própria.</p>}
          {a.denied.length > 0 && <p className="text-xs text-muted-foreground">Algumas informações não estão disponíveis para a sua conta.</p>}
        </section>
      )}
    </div>
  );
}
