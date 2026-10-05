# Frente AA — Avaliação, recuperação, conselho e fechamento 2027
Gate: W utilizável (writers v2, `diary_teacher_actor`); sem bloqueio estrutural. Reaproveita a arquitetura existente (Pauta, `register_assessment_results`, fechamento `record_period_closing_act`, colegiado, situação acadêmica, motor de composição/recuperação no TS que só calcula com regra homologada).
## 0138
- Instrumento `aa/1` só por `create_assessment_instrument_v2` (própria atribuição vigente na data prevista, período do ano, referências Y opcionais por ID).
- Aplicação só por `apply_assessment_instrument_v2` com `applied_on` dentro do período; aplicado ≠ lançado.
- Resultados só por `register_assessment_results_v2`: exige aplicação, atribuição na data da aplicação e estudante alocado nessa data; delega ao writer canônico (lote atômico, versão, base esperada, retificação). v1 sem EXECUTE para app.
- service_role sem EXECUTE em fechamento, situação e colegiado; nenhuma DML direta.
## Regras
0 normas de avaliação e 0 políticas de correção homologadas ⇒ RULE CALCULATION — BLOCKED_BY_HOMOLOGATED_RULES. Valores brutos (inclusive "não registrado" ≠ zero) são guardados; média, peso, arredondamento, recuperação e frequência mínima não são inventados.
## Pendências
- O writer canônico ainda checa capability em `current_date` (resíduo documentado; os gates v2 usam a data da aplicação).
- Telas legadas criam instrumento sem atribuição e passam a receber recusa explicada até ganharem o seletor de atribuição.
- Positivo ponta-a-ponta sem atribuições 2027 reais; Advisor não executado.
Teste DB: `aa-tests-ok` sem resíduos.
