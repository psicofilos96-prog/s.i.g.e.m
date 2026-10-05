// Adaptador da Store sobre o banco, usado só no servidor após autenticar a máquina.
// O cliente externo nunca recebe credencial do banco; só a chave sgk_ (guardada como hash).
import type { Store, Delivery } from "./integration-api";
import type { EventType } from "./integration-core";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function databaseStore(): Promise<Store> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
  return {
    async findKey(hash) {
      const k = must(await db.from("integration_keys").select("id, revoked_at, client:integration_clients(id, scopes, school_ids, rate_limit_per_minute, active)").eq("key_hash", hash).maybeSingle()) as any;
      if (!k || k.revoked_at || !k.client) return null;
      return { keyId: k.id, client: k.client };
    },
    async countRecent(clientId, since) {
      const r = await db.from("integration_requests").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("created_at", since);
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
    async findIdempotent(clientId, route, key) {
      const r = must(await db.from("integration_requests").select("status, response_body").eq("client_id", clientId).eq("route", route).eq("idempotency_key", key).lt("status", 300).maybeSingle()) as any;
      return r ? { status: r.status, body: r.response_body } : null;
    },
    async audit(row) {
      const r = await db.from("integration_requests").insert(row);
      if (r.error && r.error.code !== "23505") throw r.error;
    },
    async listSchools(afterId, limit, allowed) {
      if (allowed && allowed.length === 0) return [];
      let q = db.from("institutional_schools").select("id").order("id").limit(limit);
      if (afterId) q = q.gt("id", afterId);
      if (allowed) q = q.in("id", allowed);
      const ids = (must(await q) as { id: string }[]).map((s) => s.id);
      if (!ids.length) return [];
      const versions = must(await db.from("institutional_school_record_versions").select("school_id, version_number, official_name").in("school_id", ids)) as any[];
      const latest = new Map<string, { v: number; name: string }>();
      for (const v of versions) { const c = latest.get(v.school_id); if (!c || v.version_number > c.v) latest.set(v.school_id, { v: v.version_number, name: v.official_name }); }
      return ids.filter((id) => latest.has(id)).map((id) => ({ id, official_name: latest.get(id)!.name }));
    },
    async listPublications() {
      const rows = must(await db.rpc("public_portal_list", { _kind: null })) as any[];
      return (rows ?? []).map((p) => ({ slug: p.slug, kind: p.kind, title: p.title, published_at: p.published_at, version: p.version }));
    },
    async listDeliveries(clientId, afterId, limit) {
      const subs = (must(await db.from("webhook_subscriptions").select("id").eq("client_id", clientId)) as { id: string }[]).map((s) => s.id);
      if (!subs.length) return [];
      let q = db.from("webhook_deliveries").select("id, subscription_id, event_id, event_type, payload, status, attempts, last_http_status, updated_at").in("subscription_id", subs).order("id").limit(limit);
      if (afterId) q = q.gt("id", afterId);
      return must(await q) as Delivery[];
    },
    async subscriptionsFor(clientId, event: EventType) {
      return must(await db.from("webhook_subscriptions").select("id, client_id, url, events, secret, active").eq("client_id", clientId).eq("active", true).contains("events", [event])) as any[];
    },
    async enqueue(subId, eventId, type, payload) {
      const ins = await db.from("webhook_deliveries").insert({ subscription_id: subId, event_id: eventId, event_type: type, payload }).select("id").maybeSingle();
      if (!ins.error && ins.data) return { id: ins.data.id, created: true };
      if (ins.error && ins.error.code !== "23505") throw ins.error;
      const ex = must(await db.from("webhook_deliveries").select("id").eq("subscription_id", subId).eq("event_id", eventId).single()) as any;
      return { id: ex.id, created: false };
    },
    async dueDeliveries(ids, nowIso, limit) {
      let q = db.from("webhook_deliveries").select("id, subscription_id, event_id, event_type, payload, status, attempts, last_http_status, updated_at, sub:webhook_subscriptions!inner(url, secret, active)").in("status", ["pendente", "falhou"]).lte("next_attempt_at", nowIso).eq("sub.active", true).order("next_attempt_at").limit(limit);
      if (ids) q = q.in("id", ids);
      return (must(await q) as any[]).map((d) => ({ ...d, url: d.sub.url, secret: d.sub.secret }));
    },
    async markDelivery(id, patch) {
      must(await db.from("webhook_deliveries").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
    },
  };
}
