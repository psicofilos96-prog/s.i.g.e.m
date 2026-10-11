# Relatório de lacunas-raiz — identidade, vínculos e dados fundamentais

**Situação atual:** Registro de lote (SIGEM 2.0 — A, 2026-10-11). Contagens lidas do banco nesta data; nada foi alterado.

| Lacuna | Medido | Classe | Caminho de resolução (já existente) |
|---|---|---|---|
| Matrículas sem data de início declarada | 9.811 de 9.811 (`opened_on` nulo em todas) | pendente | `secretariat_declare_enrollment_start` (0315: append-only, motivo, fonte, autoria) — sem tela que o chame |
| Estudantes em >1 escola | 48, todos no mesmo ano letivo, sem datas | a revisar (`multiescola-sem-datas`) | revisão humana; sucessão só com datas declaradas; nunca fusão |
| Turmas sem composição/etapa | 698 de 698 | pendente | `secretariat_create_class` / composição N5.3.1 |
| Docente com 0 estudantes | 2 atuações na rede; enturmações 2026 dependem de alocação | escopo × ausência real distinguidos por `teacherRoster` | atribuição docente + enturmação |
| Servidores sem identificador seguro | 1.797 de 2.016 linhas de planilha sem matrícula funcional | sem-identificador / candidato-por-nome | conciliação só por matrícula exata; nome nunca concilia |
| Jornadas sem fonte | nenhuma jornada com fonte registrada | pendente | fonte do DP |

Regras: `src/features/data-quality/fundamentals-integrity.ts` (testes ao lado). Data técnica de importação nunca é início; nome nunca é chave.

Pendente: tela da central de pendências e da declaração de início; teste autenticado escola A/B com contas sintéticas (`scripts/harness-gate.mjs`).
