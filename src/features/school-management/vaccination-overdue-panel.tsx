import { useQuery } from "@tanstack/react-query";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { vaccinationLetterPdf } from "./vaccination-letter-pdf";
import { loadSchoolLogo } from "./school-logo-data";

type Row = { student_id: string; student_name: string; declared_on: string; due_on: string };
const br = (d: string) => d.split("-").reverse().join("/");

/** Estudantes com declaração vacinal pendente e prazo vencido, conforme registrado pela Secretaria. */
export function VaccinationOverduePanel({ school, schoolName, today }: { school: string; schoolName: string; today: string }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const q = useQuery({ queryKey: ["direcao-vaccination-overdue", s?.user.id, s?.sessionRevision, school], enabled: !!s, retry: false,
    queryFn: () => callRpc<Row[]>("direcao_vaccination_overdue", { _school: school }) });
  if (!s) return null;
  const letter = async (r: Row) => {
    const logo = await loadSchoolLogo(school);
    const blob = vaccinationLetterPdf({ schoolName, studentName: r.student_name, declaredOn: r.declared_on, dueOn: r.due_on, today }, logo);
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  };
  return (
    <section aria-label="Vacinação com prazo vencido" className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Vacinação com prazo vencido</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : q.isError ? <p className="text-sm text-destructive">{userErrorText(q.error as Error)}</p>
        : !q.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma pendência vacinal vencida registrada pela Secretaria.</p>
        : <ul className="divide-y text-sm">{q.data.map((r) => (
            <li key={r.student_id} className="flex justify-between gap-2 py-1">
              <span>{r.student_name}</span>
              <span className="flex items-center gap-2 text-muted-foreground">venceu em {br(r.due_on)}
                <button type="button" className="text-xs text-primary underline" onClick={() => void letter(r)}>Ofício</button></span>
            </li>))}</ul>}
      <p className="text-xs text-muted-foreground">A situação vacinal é registrada pela Secretaria; a regularização também é feita lá.</p>
    </section>
  );
}
