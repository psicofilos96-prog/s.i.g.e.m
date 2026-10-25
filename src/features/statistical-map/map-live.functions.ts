import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LiveMapData } from "./map-live";

const Input = z.object({ schoolId: z.string().min(1).max(120), year: z.number().int().min(2000).max(2200), month: z.number().int().min(1).max(12) });
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Lê com a sessão (leitores do Mapa conferem a capacidade na escola) e devolve só dados minimizados. */
export const getLiveMapData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => Input.parse(d))
  .handler(async ({ data, context }): Promise<LiveMapData> => {
    const db = context.supabase as any;
    const from = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const to = iso(new Date(Date.UTC(data.year, data.month, 0)));
    const prev = iso(new Date(Date.UTC(data.year, data.month - 1, 0)));
    const py = data.month === 1 ? data.year - 1 : data.year; const pm = data.month === 1 ? 12 : data.month - 1;
    const prevFrom = `${py}-${String(pm).padStart(2, "0")}-01`;
    const [fz, can] = await Promise.all([
      db.from("statistical_map_freezes").select("year, month, frozen_at").eq("school_id", data.schoolId).or(`and(year.eq.${data.year},month.eq.${data.month}),and(year.eq.${py},month.eq.${pm})`),
      db.rpc("has_school_capability", { _capability: "manter-regra-de-competencia-do-mapa", _school: data.schoolId }),
    ]);
    const fzRows = (fz.data ?? []) as any[];
    const cut: string | null = fzRows.find((r) => r.year === data.year && r.month === data.month)?.frozen_at ?? null;
    const prevCut: string | null = fzRows.find((r) => r.year === py && r.month === pm)?.frozen_at ?? null;
    const [cls, pcls, mv, late, st, vis, ver, ids] = await Promise.all([
      cut ? db.rpc("map_live_classes_known", { _school: data.schoolId, _on: to, _known_at: cut }) : db.rpc("map_live_classes", { _school: data.schoolId, _on: to }),
      prevCut ? db.rpc("map_live_classes_known", { _school: data.schoolId, _on: prev, _known_at: prevCut }) : db.rpc("map_live_classes", { _school: data.schoolId, _on: prev }),
      db.rpc("map_live_movements_known", { _school: data.schoolId, _from: from, _to: to, _after: null, _until: cut }),
      prevCut ? db.rpc("map_live_movements_known", { _school: data.schoolId, _from: prevFrom, _to: prev, _after: prevCut, _until: cut }) : Promise.resolve({ data: [] }),
      db.rpc("map_live_staff", { _school: data.schoolId, _on: to }),
      db.from("institutional_visit_records").select("id, supersedes_id, visitor_kind_id, declared_identification, visited_on, annulled").eq("school_id", data.schoolId).gte("visited_on", from).lte("visited_on", to),
      db.from("institutional_school_record_versions").select("version_number, official_name, address, district, location_kind, phone, institutional_email, own_building, hard_access, classroom_count").eq("school_id", data.schoolId).order("version_number", { ascending: false }).limit(1),
      db.from("institutional_school_identifiers").select("identifier_kind, value").eq("school_id", data.schoolId),
    ]);
    const failed: string[] = [];
    for (const [k, r] of Object.entries({ turmas: cls, movimentacoes: mv, tardias: late as any, pessoal: st, visitas: vis, cadastro: ver })) if ((r as any).error) failed.push(k);
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
      movements: [...((mv.data ?? []) as any[]), ...((late.data ?? []) as any[]).map((m) => ({ ...m, late: true }))], staff,
      frozenAt: cut, canFreeze: can.data === true, previousFrozenAt: prevCut,
      visits: visRows.filter((x) => !superseded.has(x.id) && !x.annulled).map((x) => ({ visitor_kind_id: x.visitor_kind_id, declared_identification: x.declared_identification, visited_on: x.visited_on })),
      failed,
    };
  });

/** Congela as movimentações do mês: o que for registrado depois entra no mês seguinte, com observação. */
export const freezeLiveMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => Input.extend({ note: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (context.supabase as any).rpc("freeze_statistical_map", { _school: data.schoolId, _year: data.year, _month: data.month, _note: data.note ?? null });
    if (error) throw new Error(/capacidade/.test(error.message) ? "Seu acesso não permite congelar o mapa desta escola." : "Não foi possível congelar agora.");
    return { frozenAt: (r as any).frozen_at as string };
  });
