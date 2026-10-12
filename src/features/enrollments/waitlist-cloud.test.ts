import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0470_enr17_waitlists.sql", "utf8");
const fam = sql.slice(sql.indexOf("FUNCTION public.enr_public_waitlist_position"));

describe("L17 lista de espera no banco", () => {
  it("ordem oficial só da distribuição publicada, pela posição do motor", () => {
    expect(sql).toMatch(/coalesce\(_last,''\) <> 'publicar' THEN RAISE EXCEPTION 'distribuicao-nao-publicada'/);
    expect(sql).toMatch(/array_agg\(a\.id ORDER BY \(it->>'position'\)::int\)/);
    expect(sql).toMatch(/it->>'outcome' = 'espera'/);
    expect(sql).not.toMatch(/ORDER BY a\.submitted_at/);
  });
  it("reclassificação: ato, motivo, versão esperada e mesmo conjunto", () => {
    expect(sql).toMatch(/CHECK \(basis = 'distribuicao' OR act_ref IS NOT NULL\)/);
    expect(sql).toMatch(/'conjunto-diferente'/);
    expect(sql).toMatch(/_cur\.version <> _expected_version THEN RAISE EXCEPTION 'versao-desatualizada'/);
  });
  it("convocação: 1º não convocado, trava a lista e reserva pelo writer canônico", () => {
    expect(sql).toMatch(/FROM public\.enr_waitlists WHERE id = _w FOR UPDATE/);
    expect(sql).toMatch(/ORDER BY t\.i LIMIT 1/);
    expect(sql).toMatch(/public\.enr_seat_reserve_v2\(_pool, _app, _l\.proposal_id, 'lista-de-espera'/);
    expect(sql).toMatch(/UNIQUE \(waitlist_id, application_id\)/);
  });
  it("consulta familiar: só posição/total, sem ids ou nomes de terceiros, falha uniforme", () => {
    const ret = fam.match(/RETURNS TABLE\(([^)]*)\)/)![1];
    expect(ret).toBe("status text, list_cell text, queue_position int, queue_total int, was_called boolean");
    expect(fam).not.toMatch(/requester_name|student_name|application_code,/);
    expect((fam.match(/'indisponivel'/g) ?? []).length).toBe(2);
  });
  it("anon só executa a consulta familiar; tabelas sem DML direta", () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.enr_public_waitlist_position\(text,text\) TO anon, authenticated;/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.enr_waitlists, public\.enr_waitlist_versions, public\.enr_waitlist_calls FROM authenticated, anon/);
    expect((sql.match(/TO anon/g) ?? []).length).toBe(1);
  });
});
