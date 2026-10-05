import type { AnswerProvider, Readers } from "./assistant-core";
import { TOPICS, GLOSSARY } from "@/features/help/help-content";
import { navigationItems } from "@/config/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Readers do broker sobre o cliente do PRÓPRIO usuário: RLS e capability do banco valem sempre. */
export function serverReaders(sb: any): Readers {
  const today = new Date().toISOString().slice(0, 10);
  return {
    async classMatrices(classId) {
      const r = await sb.rpc("class_curricular_matrices_at", { _class_id: classId, _on: today, _known_at: new Date().toISOString() });
      return r.error ? { ok: false } : { ok: true, rows: r.data ?? [] };
    },
    async workflowInstances(schoolId) {
      let q = sb.from("workflow_instances").select("id, subject_ref, opened_at, school_id").order("opened_at", { ascending: false }).limit(20);
      if (schoolId) q = q.eq("school_id", schoolId);
      const r = await q;
      return r.error ? { ok: false } : { ok: true, rows: r.data ?? [] };
    },
    helpTopics: () => TOPICS.map((t) => ({ id: t.id, title: t.title["pt-BR"], summary: t.summary["pt-BR"], body: t.body["pt-BR"], routes: t.routes, audience: t.audienceCapabilities, administrative: t.administrative })),
    glossary: () => GLOSSARY.map((g) => ({ id: g.id, term: g.term["pt-BR"], definition: g.definition["pt-BR"] })),
    navigation: () => navigationItems.map((n) => ({ label: n.label, to: n.to, hint: n.hint })),
  };
}

/** Lovable AI (Responses, streaming consumido no servidor). Sem treino, sem store; só recebe as fontes já autorizadas. */
export function lovableProvider(apiKey: string): AnswerProvider {
  return {
    name: "lovable-ai",
    async complete(system, prompt) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({ model: "openai/gpt-6-astra", instructions: system, input: prompt, stream: true, store: false, reasoning: { effort: "low" } }),
      });
      if (!res.ok || !res.body) throw new Error(`ai:${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", out = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i); buf = buf.slice(i + 2);
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const ev = JSON.parse(payload);
              if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
              if (ev.type === "response.failed" || ev.type === "error") throw new Error("ai:failed");
            } catch (e) { if (e instanceof Error && e.message === "ai:failed") throw e; }
          }
        }
      }
      if (!out.trim()) throw new Error("ai:empty");
      return out;
    },
  };
}
