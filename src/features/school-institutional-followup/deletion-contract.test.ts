import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/features/school-institutional-followup/page.tsx", "utf8");
const source = readFileSync("src/features/school-institutional-followup/source.ts", "utf8");
const migration = readFileSync("drizzle/migrations/0635_followup_record_deletion.sql", "utf8");

describe("Acompanhamento — exclusão de registros", () => {
  it("mantém o panorama limpo e recolhe gráficos complementares", () => {
    expect(page.match(/<InstitutionalFollowupAnalytics/g)?.length).toBe(1);
    expect(page).toContain("Indicadores detalhados e gráficos");
    expect(page).toContain("<details className=\"rounded-lg border px-4 py-3\">");
  });

  it("oferece exclusão de visitas, medidas e atualizações para quem pode registrar", () => {
    expect(page).toContain('deleteRecord("visit", v.id, "visita")');
    expect(page).toContain('deleteRecord("action", a.id, "medida")');
    expect(page).toContain('deleteRecord("update", u.id, "atualização")');
    expect(page).toContain("disabled={hasUnsavedFollowup}");
  });

  it("pede justificativa e confirmação antes da operação destrutiva", () => {
    expect(page).toContain('askText("Justificativa da exclusão", "")');
    expect(page).toContain('actionLabel: "Excluir definitivamente"');
    expect(page).toContain("scope !== liveSchoolScope.current");
  });

  it("chama exclusivamente a RPC institucional de exclusão", () => {
    expect(source).toContain('call("delete_school_institutional_followup_record"');
    expect(source).not.toMatch(/\.from\(["']school_institutional_followup_/);
  });

  it("remove os dependentes e arquivos, sem expor DML direto ao cliente", () => {
    expect(migration).toContain("public.school_institutional_followup_deletion_audit");
    expect(migration).toContain("DELETE FROM public.school_institutional_followup_updates");
    expect(migration).toContain("DELETE FROM public.school_institutional_followup_attachments");
    expect(migration).toContain("DELETE FROM storage.objects");
    expect(migration).toContain("public.school_institutional_followup_person(_school)");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.delete_school_institutional_followup_record");
    expect(migration).toContain("FROM PUBLIC, anon, service_role");
    expect(migration).toContain("followup_deletion_audit_immutable");
  });
});
