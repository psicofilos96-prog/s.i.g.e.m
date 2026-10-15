import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LESSON_RESOURCE_OPTIONS = ["Lousa", "Projetor", "Livro didático", "Vídeo", "Atividade impressa", "Outro"] as const;

/** Recursos da aula: cada gravação é nova versão (append-only); vale a mais recente. */
export function LessonResources({ lessonRef }: { lessonRef: string | null }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lesson-resources", lessonRef],
    enabled: !!lessonRef,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_resource_records")
        .select("resources,recorded_at").eq("lesson_ref", lessonRef!).order("recorded_at", { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0]?.resources ?? [];
    },
  });
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSel(q.data ?? []); setMsg(null); }, [q.data, lessonRef]);
  const dirty = JSON.stringify([...sel].sort()) !== JSON.stringify([...(q.data ?? [])].sort());

  async function save() {
    if (!lessonRef) return;
    setSaving(true); setMsg(null);
    const { error } = await supabase.from("lesson_resource_records").insert({ lesson_ref: lessonRef, resources: sel });
    setSaving(false);
    if (error) { setMsg("Não foi possível salvar. Tente de novo."); return; }
    setMsg("Salvo.");
    await qc.invalidateQueries({ queryKey: ["lesson-resources", lessonRef] });
  }

  return (
    <div>
      <fieldset disabled={!lessonRef || saving} className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <legend className="sr-only">Recursos utilizados</legend>
        {LESSON_RESOURCE_OPTIONS.map((r) => (
          <label key={r} className="flex items-center gap-2">
            <input type="checkbox" className="size-4" checked={sel.includes(r)}
              onChange={(e) => setSel((s) => e.target.checked ? [...s, r] : s.filter((x) => x !== r))} />{r}
          </label>
        ))}
      </fieldset>
      {!lessonRef ? <p className="mt-1 text-micro text-dp-muted">Registre a aula para marcar os recursos.</p> : (
        <div className="mt-2 flex items-center gap-2">
          {dirty ? <button type="button" onClick={save} disabled={saving}
            className="h-8 rounded-lg bg-dp-action px-3 text-xs font-semibold text-primary-foreground hover:bg-dp-action-hover">
            {saving ? "Salvando…" : "Salvar recursos"}</button> : null}
          {msg ? <span className="text-micro text-dp-muted" role="status">{msg}</span> : null}
        </div>
      )}
    </div>
  );
}
