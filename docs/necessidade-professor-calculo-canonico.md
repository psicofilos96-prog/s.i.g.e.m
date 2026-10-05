# Frente M — Necessidade de professor

**Status: BLOCKED_BY_SOURCE (modelo PASS).**

`src/features/staffing/staffing-model.ts` separa carga contratual, disponibilidade, regência, aulas ofertadas e aulas cobertas, e só calcula quando matriz/carga e regência existem; fórmula de déficit é regra homologável, não código (relatório catalogado com `dependency`).

Estado real: 0 matrizes, 0 grades, 0 regências, 0 lotações, jornada profissional ausente (Frente E). Portanto **nenhum déficit nominal ou excedência é publicado**; a tela mostra o impedimento por extenso. Os 551 vínculos e 2.403 declarações censitárias não são carga horária nem regência.
