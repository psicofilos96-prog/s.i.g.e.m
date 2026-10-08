# NPREP.1 — Prontidão para 2027 (somente leitura)

**Situação atual:** Registro de lote (2026-10-08).

`/preparacao-2027` classifica cada item em Pronto, Ausente, Pendente de decisão, Pendente de dado ou Não verificado (leitura negada/erro nunca vira ausente), com link à ferramenta. Não grava, não abre nem configura 2027.

Novos itens: catálogos homologados, jornadas das turmas de 2027, lotações vigentes em 2027; calendário passou a ser lido (versões do ano + homologação `homologada`).

Estado atual (base de 2026-10-08): ano 2027 cadastrado e calendário homologado = Pronto; abertura e regras = Pendente de decisão; turmas, oferta, jornadas, grade, matrizes, catálogos (0 homologados), lotações (0) = Ausente; Educacenso, DP, BNCC/SAEB, modelos = Pendente de dado. Teste: `src/features/year-preparation/nprep1-checklist.test.ts`.
