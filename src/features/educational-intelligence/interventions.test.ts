import { describe, expect, it } from "vitest";
import { projectInterventions, summarizeBySchool, validateNewIntervention, type InterventionEvent, type InterventionVersion } from "./interventions";

const v = (o: Partial<InterventionVersion> = {}): InterventionVersion => ({
  id: "v1", logical_id: "p1", version: 1, school_id: "s1", class_id: null, segment: "anos-iniciais", is_infant: false,
  origin_kind: "sia-instrumento-aprovado", origin_ref: "iv1", sipe_plan_version_id: null, objective: "Recompor leitura",
  responsible_label: "OP", due_date: "2026-11-01", reason: null, author_user_id: "u", recorded_at: "2026-10-01T00:00:00Z", ...o });
const e = (seq: number, kind: InterventionEvent["kind"], o: Partial<InterventionEvent> = {}): InterventionEvent => ({
  plan_logical_id: "p1", seq, kind, body: "texto", responsible_label: null, due_date: null, progress: null, reassessment_ref: null,
  author_user_id: "u", recorded_at: "2026-10-02T00:00:00Z", ...o });

const one = (...a: Parameters<typeof projectInterventions>) => projectInterventions(...a)[0]!;

describe("intervenções pedagógicas", () => {
  it("sem ação = planejado; com ação = em execução", () => {
    expect(one([v()], [], "2026-10-10").stage).toBe("planejado");
    expect(one([v()], [e(1, "acao")], "2026-10-10").stage).toBe("em-execucao");
  });
  it("prazo vencido sem reavaliação aguarda reavaliação e alerta", () => {
    const r = one([v()], [e(1, "acao")], "2026-11-02");
    expect(r.stage).toBe("aguardando-reavaliacao");
    expect(r.overdue.length).toBe(1);
  });
  it("reavaliação registra progresso e encerra alertas de prazo do plano", () => {
    const r = one([v()], [e(1, "acao"), e(2, "reavaliacao", { progress: "avanco-parcial", reassessment_ref: "iv2" })], "2026-11-02");
    expect(r.stage).toBe("reavaliado"); expect(r.lastProgress).toBe("avanco-parcial"); expect(r.overdue).toEqual([]);
  });
  it("ação vencida sem evidência posterior é sinalizada", () => {
    expect(one([v()], [e(1, "acao", { due_date: "2026-10-05" })], "2026-10-10").overdue).toHaveLength(1);
    expect(one([v()], [e(1, "acao", { due_date: "2026-10-05" }), e(2, "evidencia")], "2026-10-10").overdue).toHaveLength(0);
  });
  it("Educação Infantil nunca aceita decisão de retenção/promoção sem aviso", () => {
    const r = one([v({ is_infant: true, objective: "Avaliar retenção da criança" })], [], "2026-10-10");
    expect(r.issues.some((i) => i.includes("Educação Infantil"))).toBe(true);
  });
  it("encerramento sem devolutiva é apontado", () => {
    expect(one([v()], [e(1, "encerramento")], "2026-10-10").issues).toContain("Encerrado sem devolutiva registrada.");
  });
  it("versão mais nova prevalece e histórico é mantido", () => {
    const r = one([v(), v({ id: "v2", version: 2, objective: "Novo objetivo" })], [], "2026-10-10");
    expect(r.current.objective).toBe("Novo objetivo"); expect(r.history).toHaveLength(2);
  });
  it("validação recusa referência de origem vazia", () => {
    expect(validateNewIntervention({ school_id: "s", segment: "x", origin_kind: "frequencia-diario", origin_ref: " ", objective: "abcde" })).toHaveLength(1);
  });
  it("consolidado por escola conta só planos lidos", () => {
    const s = summarizeBySchool(projectInterventions([v(), v({ id: "x", logical_id: "p2", school_id: "s2" })], [], "2026-10-10"));
    expect(s.find((x) => x.school_id === "s1")?.total).toBe(1);
    expect(s.find((x) => x.school_id === "s3")).toBeUndefined();
  });
});
