import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/sigem/patterns";
import {
  PROPOSED_EF_DESIGNATION_POLICY as POLICY, simulateDesignations, summarizePreview, type PreviewClass, type PreviewRow,
} from "./class-designation";

const STATUS_TEXT: Record<PreviewRow["status"], string> = {
  proposta: "Proposta calculada",
  "nao-determinavel": "Não determinável",
  "regra-nao-definida": "Regra de designação ainda não definida",
  "nao-aplicavel": "Não aplicável",
};

type Loaded = { classes: PreviewClass[] } | { error: string } | null;

async function loadPreviewClasses(): Promise<PreviewClass[]> {
  const [cls, cat] = await Promise.all([
    supabase.from("institutional_classes").select("id, school_id, academic_year_id, code"),
    supabase.from("class_designation_category_versions").select("class_id, category_id, sequence"),
  ]);
  if (cls.error) throw cls.error;
  if (cat.error) throw cat.error;
  const head = new Map<string, { category: string; seq: number }>();
  for (const r of cat.data ?? []) {
    const h = head.get(r.class_id);
    if (!h || h.seq < r.sequence) head.set(r.class_id, { category: r.category_id, seq: r.sequence });
  }
  return (cls.data ?? []).map((c) => ({
    classId: c.id, schoolId: c.school_id, academicYearId: c.academic_year_id, currentCode: c.code ?? null,
    category: head.get(c.id)?.category ?? null,
    nature: null, // natureza-da-turma ainda sem valor homologado (R4): nunca deduzida
    studentPositions: [],
  }));
}

/** Prévia para o Gabinete: somente leitura, sem gravar designação. */
export function DesignationPreviewPage() {
  const [state, setState] = useState<Loaded>(null);
  const [school, setSchool] = useState<string>("");
  useEffect(() => {
    loadPreviewClasses().then((classes) => setState({ classes }), (e: unknown) => setState({ error: e instanceof Error ? e.message : "Falha ao ler turmas." }));
  }, []);
  const rows = useMemo(() => (state && "classes" in state ? simulateDesignations(state.classes, POLICY) : []), [state]);
  const schools = useMemo(() => [...new Set(rows.map((r) => r.schoolId))].sort(), [rows]);
  const visible = school ? rows.filter((r) => r.schoolId === school) : rows;
  const summary = summarizePreview(visible);

  if (!state) return <p className="p-6 text-muted-foreground">Carregando turmas…</p>;
  if ("error" in state) return <EmptyState title="Não foi possível montar a prévia" description={state.error} />;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Prévia da designação de turmas</h1>
        <p className="text-sm text-muted-foreground">
          Simulação da proposta para o Ensino Fundamental regular (100…900, sem turno no código). É direção de produto do
          proprietário, a apresentar ao Gabinete; não está homologada e nada aqui altera turmas.
        </p>
        <p className="text-sm text-muted-foreground">
          A designação não define a posição curricular de nenhum estudante. Sem categoria de designação registrada, a turma
          aparece como "não determinável" — o nome ou código atual nunca é usado para adivinhar.
        </p>
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Turmas", summary.total], ["Com proposta", summary.proposta], ["Não determináveis", summary.naoDeterminavel],
          ["Regra não definida", summary.regraNaoDefinida], ["Já conformes", summary.jaConforme], ["Divergentes", summary.divergente],
          ["Códigos atuais duplicados", summary.duplicidadesAtuais], ["Para conferência", summary.comConferencia],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-md border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-semibold">{n}</div>
          </div>
        ))}
      </section>

      <label className="flex items-center gap-2 text-sm">
        Escola
        <select className="rounded-md border border-input bg-background px-2 py-1" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Todas</option>
          {schools.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-2">Escola</th><th className="p-2">Ano</th><th className="p-2">Designação atual</th><th className="p-2">Categoria</th><th className="p-2">Proposta</th><th className="p-2">Situação</th><th className="p-2">Observações</th></tr>
          </thead>
          <tbody>
            {visible.slice(0, 500).map((r) => (
              <tr key={r.classId} className="border-t border-border">
                <td className="p-2">{r.schoolId}</td><td className="p-2">{r.academicYearId}</td>
                <td className="p-2">{r.currentCode ?? "não informado"}</td>
                <td className="p-2">{r.category ?? "não registrada"}</td>
                <td className="p-2 font-medium">{r.proposed ?? "—"}</td>
                <td className="p-2">{STATUS_TEXT[r.status]}</td>
                <td className="p-2 text-muted-foreground">{r.notes.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length > 500 && <p className="text-xs text-muted-foreground">Mostrando 500 de {visible.length}; filtre por escola.</p>}
    </div>
  );
}
