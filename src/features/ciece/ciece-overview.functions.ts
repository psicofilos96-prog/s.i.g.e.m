/**
 * CIECE Lote 19 — leitura do Observatório com a sessão do usuário (RLS aplicada).
 * Só contagens e o cadastro das escolas (sem pessoa); nada é gravado. Leitura negada ou
 * falha vira "sem-permissao"/"nao-lido", nunca zero (observatory.panorama).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { panorama, mapPoint, type Reading, type PanoramaKey } from "./observatory";
import { audit, summary } from "./quality-auditor";

export const getCieceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const today = new Date().toISOString().slice(0, 10);
    const count = async (table: "institutional_schools" | "school_enrollments" | "institutional_classes" | "professional_functional_links", source: string, filter?: (q: any) => any): Promise<Reading> => {
      let q = db.from(table).select("id", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: c, error } = await q;
      if (error) return { state: error.code === "42501" ? "sem-permissao" : "nao-lido", reason: "leitura recusada ou indisponível" };
      if (c == null) return { state: "nao-lido", reason: "contagem não devolvida" };
      return { state: "lido", value: c, source, referenceDate: today };
    };
    const [escolas, matriculas, semInicio, turmas, vinculos, versions, ids] = await Promise.all([
      count("institutional_schools", "institutional_schools"),
      count("school_enrollments", "school_enrollments"),
      count("school_enrollments", "school_enrollments", (q) => q.is("opened_on", null)),
      count("institutional_classes", "institutional_classes"),
      count("professional_functional_links", "professional_functional_links"),
      db.from("institutional_school_record_versions").select("school_id,version_number,official_name,district,location_kind").order("version_number", { ascending: false }).limit(1000),
      db.from("institutional_school_identifiers").select("school_id,identifier_kind,value").limit(1000),
    ]);
    const readings: Partial<Record<PanoramaKey, Reading>> = {
      escolas, matriculas, turmas,
      "estudantes-unicos": { state: "sem-fonte", reason: "contagem distinta exige reader agregado (não há)" },
      professores: { state: "sem-fonte", reason: "regência vigente lida só por turma" },
      servidores: vinculos.state === "lido" ? { ...vinculos, source: "professional_functional_links (vínculos, não pessoas)" } : vinculos,
    };
    const head = new Map<string, { name: string; district: string | null; location: string | null }>();
    for (const v of versions.data ?? []) if (!head.has(v.school_id)) head.set(v.school_id, { name: v.official_name, district: v.district, location: v.location_kind });
    const inep = new Map((ids.data ?? []).filter((i) => /inep/i.test(i.identifier_kind)).map((i) => [i.school_id, i.value]));
    const schools = [...head].map(([id, s]) => ({ id, ...s, inep: inep.get(id) ?? null, map: mapPoint(null) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const findings = versions.error ? [] : audit({ schools: schools.map((s) => ({ id: s.id, inep: s.inep, ibge: null, district: s.district })) });
    const enrollmentNoStart = semInicio.state === "lido" && semInicio.value > 0
      ? [{ ruleId: "matricula-sem-inicio", version: 1, grade: "pendencia" as const, subject: "rede", evidence: `${semInicio.value} matrículas sem data de início`, fix: "Secretaria: registrar início pelo writer de matrícula" }]
      : [];
    const all = [...findings, ...enrollmentNoStart];
    return {
      at: today,
      cells: panorama(readings),
      schools,
      schoolsReadable: !versions.error,
      findings: all,
      findingSummary: summary(all),
    };
  });
