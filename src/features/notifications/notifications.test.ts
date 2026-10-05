import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EXTERNAL_CHANNELS, eventKey, safeInternalLink } from "./notifications-model";

const sql = readFileSync("drizzle/migrations/0077_notifications_infrastructure.sql", "utf8");
const fn = (name: string) => { const i = sql.indexOf(`FUNCTION public.${name}(`); return sql.slice(i, sql.indexOf("$fn$;", i)); };

describe("notificações", () => {
  it("duplicidade/retry: entrega única por evento+destinatário+canal e evento por chave idempotente", () => {
    expect(sql).toMatch(/UNIQUE \(event_id, recipient_user_id, channel\)/);
    expect(fn("dispatch_notification_event")).toMatch(/ON CONFLICT \(event_id, recipient_user_id, channel\) DO NOTHING/);
    expect(sql).toMatch(/event_key text NOT NULL UNIQUE/);
    expect(fn("emit_notification_event")).toMatch(/event-key-conflict/);
    expect(eventKey("doc", "e1")).toBe(eventKey("doc", "e1"));
  });
  it("destinatário por regra: capability na escola (sem outra escola) ou responsável autorizado na seção", () => {
    expect(fn("notif_capability_holders")).toMatch(/e\.scope_level = 'escola' AND e\.school_id = _school/);
    const g = fn("notif_guardians");
    expect(g).toMatch(/_section = ANY\(a\.sections\)/);
    expect(g).toMatch(/event_kind <> 'revogacao'/);
    expect(g).toMatch(/SELECT DISTINCT a\.guardian_user_id/); // dois responsáveis ⇒ duas entregas
  });
  it("perdeu acesso antes de abrir: open revalida e não devolve link", () => {
    const o = fn("open_notification");
    expect(o).toMatch(/recipient_user_id = auth\.uid\(\)/); // IDOR: só o próprio destinatário
    expect(o.indexOf("notif_still_authorized")).toBeLessThan(o.indexOf("'status','ok'"));
    expect(o).toMatch(/acesso-revogado/);
  });
  it("evento cancelado/expirado não é entregue nem listado", () => {
    expect(fn("dispatch_notification_event")).toMatch(/notification_event_cancellations/);
    expect(fn("my_notifications")).toMatch(/notification_event_cancellations/);
    expect(fn("my_notifications")).toMatch(/expires_at > now\(\)/);
  });
  it("modelo alterado: entrega guarda a versão usada; nova versão exige base e motivo", () => {
    expect(sql).toMatch(/template_version_id uuid NOT NULL REFERENCES public\.notification_template_versions/);
    expect(fn("record_notification_template")).toMatch(/base-superseded/);
  });
  it("minimização: payload só com variáveis declaradas e curtas; canal externo sem variáveis e sem provedor", async () => {
    const e = fn("emit_notification_event");
    expect(e).toMatch(/payload-key-not-declared/);
    expect(e).toMatch(/length\(_payload->>k\) > 120/);
    expect(fn("record_notification_template")).toMatch(/external-summary-has-variables/);
    expect(sql).toMatch(/channel IN \('in-app'\)/);
    for (const c of EXTERNAL_CHANNELS) await expect(c.send({ recipientUserId: "u", externalSummary: "x", deliveryId: "d" })).rejects.toThrow();
  });
  it("deep link: só caminho interno", () => {
    expect(safeInternalLink("/familia?aluno=1")).toBe("/familia?aluno=1");
    expect(safeInternalLink("https://mal.example")).toBeNull();
    expect(safeInternalLink("//mal.example")).toBeNull();
  });
  it("tabelas sem acesso direto; leitura só pelos readers", () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.%I FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/CREATE POLICY/);
  });
});
