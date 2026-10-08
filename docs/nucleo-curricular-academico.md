# Frente K — Núcleo curricular/acadêmico

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


**Status: BLOCKED_BY_GATE + BLOCKED_BY_SOURCE (arquitetura PASS; produção vazia por decisão).**

Separação já existente e reutilizada (sem nova migration):
- Catálogo curricular: `institutional_curricular_components` + versões.
- Matriz/versionamento: B4.1 (`record_curricular_matrix_version`, quadro imutável, homologação B4.2.1).
- Oferta por turma: B2.6 (`class_offering_at`) e resolução E1–E4 (B4.2.x).
- Atribuição docente: `institutional_engagements` com escopo de turmas.
- Horário: B4.4 (`class_schedule_at`).

Estado real: 0 matrizes, 0 grades horárias, 2 atuações (contas institucionais). Nenhuma matriz foi derivada do nome da turma e nenhuma regência por coocorrência professor×turma nas fontes do Censo. Mutações de produção não foram feitas (gate J não pleno; sem fonte oficial de matriz).
