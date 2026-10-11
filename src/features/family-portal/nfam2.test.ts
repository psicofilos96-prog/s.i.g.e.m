import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { candidateDisambiguation } from "./student-lookup";
import { projectHealth, validateHealthDraft, type HealthRow } from "./family-health";
import { DATA_INVENTORY } from "@/features/privacy/data-inventory";

const row = (o: Partial<HealthRow>): HealthRow => ({ id: "a", logical_id: "L", version: 1, kind: "alergia", event_kind: "declaracao", description: "amendoim",
  instructions: null, consent_text_version: "v1", recorded_at: "2026-10-01T10:00:00Z", by_me: true, is_head: true, ...o });

describe("NFAM.2 homônimos", () => {
  const a = { student_id: "s1", name: "Ana Souza", internal_id: null, birth_date: null, homonyms: 2 };
  const b = { student_id: "s2", name: "Ána Souza", internal_id: null, birth_date: null, homonyms: 2 };
  it("homônimo sem distinção não pode ser escolhido", () => expect(candidateDisambiguation(a, [a, b]).ok).toBe(false));
  it("identificador próprio distingue", () => expect(candidateDisambiguation({ ...a, internal_id: "X1" }, [{ ...a, internal_id: "X1" }, b]).ok).toBe(true));
  it("data de nascimento própria distingue", () => expect(candidateDisambiguation({ ...a, birth_date: "2015-01-02" }, [{ ...a, birth_date: "2015-01-02" }, b]).ok).toBe(true));
  it("nome único é escolhível sem CPF", () => expect(candidateDisambiguation({ ...a, homonyms: 1 }, [{ ...a, homonyms: 1 }]).ok).toBe(true));
});

describe("NFAM.2 declarações de saúde", () => {
  it("sem ciência não envia", () => expect(validateHealthDraft({ kind: "alergia", description: "amendoim", instructions: "", consent: false })).toMatch(/ciência/));
  it("com ciência e descrição envia", () => expect(validateHealthDraft({ kind: "medicamento", description: "insulina", instructions: "", consent: true })).toBeNull());
  it("retirada deixa de ser vigente e mantém histórico", () => {
    const [it0] = projectHealth([row({}), row({ id: "b", version: 2, event_kind: "retirada", by_me: false })]);
    expect(it0!.active).toBe(false); expect(it0!.history).toHaveLength(2);
  });
  it("inventário marca a tabela como sensível de menor", () => {
    const e = DATA_INVENTORY.find((x) => x.tables.includes("family_health_declarations"));
    expect(e?.sensitivity).toBe("sensivel"); expect(e?.minors).toBe(true);
  });
  it("tabela sem privilégio direto e verificação pública sem saúde", () => {
    const sql = readFileSync("drizzle/migrations/0326_nfam2_family_health_declarations.sql", "utf8");
    expect(sql).toMatch(/REVOKE ALL ON public\.family_health_declarations FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/GRANT [A-Z, ]+ ON public\.family_health_declarations TO (anon|authenticated)/);
  });
});
