import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0630_selected_security_linked_catalog_and_artifact_reads.sql", "utf8");

describe("selected security read restrictions", () => {
  it("bounds changes to the selected 126 read policies", () => {
    expect(sql).toContain("cmd = 'SELECT' AND qual = 'true'");
    expect(sql).toContain("roles = ARRAY['authenticated']::name[]");
    const targets = sql.match(/AND tablename = ANY \(ARRAY\[([\s\S]*?)\]::text\[\]\)/)?.[1];
    expect(targets?.match(/'[^']+'/g)).toHaveLength(126);
    expect(sql).toContain("IF n <> 126 THEN RAISE EXCEPTION");
    expect(sql).not.toMatch(/DROP POLICY|CREATE POLICY|UPDATE |DELETE FROM|INSERT INTO/);
  });
  it("requires canonical linkage without trusting client metadata", () => {
    expect(sql).toContain("auth.uid() IS NOT NULL AND (");
    expect(sql).toContain("public.current_person_id() IS NOT NULL");
    expect(sql).toContain("public.current_principal_id() IS NOT NULL");
    expect(sql).toContain("public.sigem_designated_installer_email()");
    expect(sql).not.toMatch(/user_metadata|raw_user_meta_data|current_setting/);
    expect(sql).toContain("USING ((SELECT public.security_catalog_reader()))");
  });
  it("inherits lesson access without privileged lesson bypass", () => {
    expect(sql).toContain("EXISTS (SELECT 1 FROM public.lesson_record_versions l");
    expect(sql).toContain("l.logical_record_id = lesson_resource_records.lesson_ref");
    expect(sql).toContain("l.id::text = lesson_resource_records.lesson_ref");
  });
  it("allows owners to preview images and readers only registered shared images", () => {
    expect(sql.match(/owner_id = \(SELECT auth.uid\(\)::text\)/g)).toHaveLength(2);
    expect(sql).toContain("l.object_path = _name");
    expect(sql).toContain("n.image_path = objects.name");
    expect(sql).toContain("public.security_catalog_reader() AND EXISTS");
  });
  it("locks helper search paths and denies anonymous execution", () => {
    expect(sql.match(/SECURITY DEFINER SET search_path TO ''/g)).toHaveLength(2);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.security_catalog_reader() FROM PUBLIC, anon");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.security_school_logo_readable(text) FROM PUBLIC, anon");
  });
});