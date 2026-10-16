import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LiveMapData } from "./map-live";

const Input = z.object({ schoolId: z.string().min(1).max(120), year: z.number().int().min(2000).max(2200), month: z.number().int().min(1).max(12) });
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Lê com a sessão (leitores do Mapa conferem a capacidade na escola) e devolve só dados minimizados. */
export const getLiveMapData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }): Promise<LiveMapData> => {
    const db = context.supabase as any;
    const from = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const to = iso(new Date(Date.UTC(data.year, data.month, 0)));
    const prev = iso(new Date(Date.UTC(data.year, data.month - 1, 0)));
    const [cls, pcls, mv, st, vis, ver, ids] = await Promise.all([
      db.rpc("map_live_classes", { _school: data.schoolId, _on: to }),
      db.rpc("map_live_classes", { _school: data.schoolId, _on: prev }),
      db.rpc("map_live_movements", { _school: data.schoolId, _from: from, _to: to }),
      db.rpc("map_live_staff", { _school: data.schoolId, _on: to }),
      db.from("institutional_visit_records").select("id, supersedes_id, visitor_kind_id, declared_identification, visited_on, annulled").eq("school_id", data.schoolId).gte("visited_on", from).lte("visited_on", to),
      db.from("institutional_school_record_versions").select("version_number, official_name, address, district, location_kind, phone, institutional_email, own_building, hard_access, classroom_count").eq("school_id", data.schoolId).order("version_number", { ascending: false }).limit(1),
      db.from("institutional_school_identifiers").select("identifier_kind, value").eq("school_id", data.schoolId),
    ]);
    const failed: string[] = [];
    for (const [k, r] of Object.entries({ turmas: cls, movimentacoes: mv, pessoal: st, visitas: vis, cadastro: ver })) if ((r as any).error) failed.push(k);
    const v = ((ver.data ?? []) as any[])[0] ?? {};
    const inep = ((ids.data ?? []) as any[]).find((x) => /inep/i.test(x.identifier_kind))?.value ?? (data.schoolId.startsWith("inep-") ? data.schoolId.slice(5) : null);
    const yn = (b: unknown) => (b === true ? "Sim" : b === false ? "Não" : null);
    const staff = (st.data ?? []) as any[];
    const director = staff.find((s) => /DIRET(OR|ORA) GERAL|DIRIGENTE/i.test(s.funcao ?? ""))?.full_name ?? null;
    const visRows = ((vis.data ?? []) as any[]);
    const superseded = new Set(visRows.map((x) => x.supersedes_id).filter(Boolean));
    const pc = (pcls.data ?? []) as any[];
    return {
      schoolName: v.official_name ?? "Unidade escolar", inep, year: data.year, month: data.month, referenceDate: to,
      identification: { "Endereço": v.address ?? null, "Distrito": v.district ?? null, "E-mail da escola": v.institutional_email ?? null, "Localização": v.location_kind ?? null,
        "Prédio": v.own_building === true ? "Próprio" : v.own_building === false ? "Não próprio" : null, "Direção": director, "Difícil acesso": yn(v.hard_access),
        "Nº de salas de aula": v.classroom_count != null ? String(v.classroom_count) : null, "Telefone de contato": v.phone ?? null },
      classes: (cls.data ?? []) as any[],
      previousTotal: pcls.error || !pc.length ? null : pc.reduce((a, c) => a + (c.students ?? 0), 0),
      movements: (mv.data ?? []) as any[], staff,
      visits: visRows.filter((x) => !superseded.has(x.id) && !x.annulled).map((x) => ({ visitor_kind_id: x.visitor_kind_id, declared_identification: x.declared_identification, visited_on: x.visited_on })),
      failed,
    };
  });
