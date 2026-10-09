// INT.8: escola → turmas → alunos e escola → profissionais (registro administrativo 2026).
// Só leituras com a sessão do usuário (RLS decide); ausência nunca vira zero.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";
import { SkeletonState } from "@/components/sigem/guidance";
import { Input } from "@/components/ui/input";

const db = supabase as unknown as { from: (t: string) => any };

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ok"; rows: T[]; truncated: boolean };

function useRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, key: string): Load<T> {
  const [s, setS] = useState<Load<T>>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setS({ status: "loading" });
    readPages<T>(build, 20000).then(
      (r) => alive && setS(r.error ? { status: "error" } : { status: "ok", rows: r.data ?? [], truncated: r.truncated }),
      () => alive && setS({ status: "error" }),
    );
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

type Episode = { class_id: string; class_label_snapshot: string | null; student_id: string; class_enrollment_episode_endings: { ended_on: string }[] | null };

export function UnitClassesPanel({ schoolId }: { schoolId: string }) {
  const s = useRows<Episode>(
    (f, t) => db.from("class_enrollment_episodes").select("class_id, class_label_snapshot, student_id, class_enrollment_episode_endings(ended_on)").eq("school_id", schoolId).order("id").range(f, t),
    `cls:${schoolId}`,
  );
  const classes = useMemo(() => {
    if (s.status !== "ok") return [];
    const m = new Map<string, { label: string; active: Set<string>; ended: Set<string> }>();
    for (const e of s.rows) {
      const c = m.get(e.class_id) ?? { label: e.class_label_snapshot ?? "Turma sem nome registrado", active: new Set(), ended: new Set() };
      (e.class_enrollment_episode_endings?.length ? c.ended : c.active).add(e.student_id);
      m.set(e.class_id, c);
    }
    return [...m.entries()].map(([id, c]) => ({ id, ...c })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [s]);
  if (s.status === "loading") return <SkeletonState label="Carregando turmas" />;
  if (s.status === "error") return <p className="text-sm text-muted-foreground">Não foi possível ler as turmas, ou sua conta não tem acesso a elas.</p>;
  if (!classes.length) return <p className="text-sm text-muted-foreground">Nenhuma turma com alunos visível para sua conta.</p>;
  const total = new Set(classes.flatMap((c) => [...c.active])).size;
  return (
    <div className="space-y-2">
      <p className="text-sm"><strong>{classes.length}</strong> turmas · <strong>{total}</strong> alunos enturmados hoje</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm"><caption className="sr-only">Lista</caption>
          <thead className="bg-muted text-left"><tr><th scope="col" className="p-2">Turma</th><th scope="col" className="p-2 text-right">Alunos enturmados</th><th scope="col" className="p-2 text-right">Saídas registradas</th></tr></thead>
          <tbody>{classes.map((c) => (
            <tr key={c.id} className="border-t"><td className="p-2">{c.label}</td><td className="p-2 text-right tabular-nums">{c.active.size}</td><td className="p-2 text-right tabular-nums">{c.ended.size}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {s.truncated ? <p className="text-xs text-warning-foreground">Lista parcial: a escola tem mais registros do que o limite de leitura.</p> : null}
    </div>
  );
}

type Staff = { id: string; full_name: string; cargo: string | null; funcao: string | null; vinculo: string | null; grupo: string | null; situacao: string; sheet: string; source_file: string; reference_period: string };

export function UnitStaffPanel({ schoolId }: { schoolId: string }) {
  const s = useRows<Staff>(
    (f, t) => db.from("staff_administrative_records").select("id, full_name, cargo, funcao, vinculo, grupo, situacao, sheet, source_file, reference_period").eq("school_id", schoolId).order("full_name").range(f, t),
    `staff:${schoolId}`,
  );
  const [q, setQ] = useState("");
  if (s.status === "loading") return <SkeletonState label="Carregando profissionais" />;
  if (s.status === "error") return <p className="text-sm text-muted-foreground">Não foi possível ler o quadro de pessoal, ou sua conta não tem acesso a ele.</p>;
  if (!s.rows.length) return <p className="text-sm text-muted-foreground">Nenhum profissional visível para sua conta nesta escola.</p>;
  const term = q.trim().toLocaleLowerCase("pt-BR");
  const rows = term ? s.rows.filter((r) => `${r.full_name} ${r.funcao ?? ""} ${r.cargo ?? ""}`.toLocaleLowerCase("pt-BR").includes(term)) : s.rows;
  const active = s.rows.filter((r) => r.sheet === "Servidores por escola");
  return (
    <div className="space-y-2">
      <p className="text-sm"><strong>{new Set(active.map((r) => r.full_name)).size}</strong> pessoas em atuação · {s.rows.length - active.length} afastadas ou fora da lista</p>
      <Input aria-label="Buscar profissional" placeholder="Buscar por nome, função ou cargo" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm"><caption className="sr-only">Lista</caption>
          <thead className="bg-muted text-left"><tr><th scope="col" className="p-2">Nome</th><th scope="col" className="p-2">Função</th><th scope="col" className="p-2">Cargo</th><th scope="col" className="p-2">Vínculo</th><th scope="col" className="p-2">Situação</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-t"><td className="p-2">{r.full_name}</td><td className="p-2">{r.funcao ?? "—"}</td><td className="p-2">{r.cargo ?? "—"}</td><td className="p-2">{r.vinculo ?? "—"}</td><td className="p-2">{r.situacao}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Fonte: {s.rows[0]!.source_file} (referência {s.rows[0]!.reference_period}). Registro administrativo: não dá acesso ao SIGEM.</p>
    </div>
  );
}
