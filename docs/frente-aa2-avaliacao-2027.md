# Frente AA.2 — Conclusão da Avaliação/Fechamento 2027

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Status: **PASS — READY_FOR_2027_HUMAN_ASSESSMENT_OPERATION**
· RULE CALCULATION — BLOCKED_BY_HOMOLOGATED_RULES
· PUBLICATION — AWAITING_HOMOLOGATED_RULE
· HUMAN_UI_VALIDATION_PENDING (sem login humano real; não bloqueia o PASS técnico)

## Migrations
- `0151_aa2_assessment_conclusion` — writers datados (`record_period_closing_act_v2`, `register_academic_standings_v2`,
  `record_assessment_item_version_v2`, `record_teacher_instrument_version_v2`); janela do período pela versão (`aa_period_window`);
  completude explicável e fingerprint SHA-256 no banco; ledgers append-only de conferência e oficialização; leitor de governança;
  legados sem EXECUTE.
- `0152_aa2_correction_capability_on_applied_date` — capacidades exigidas pela política de correção avaliadas na data da aplicação.

## Contratos
- Ausência de lançamento ≠ zero ≠ "não registrado" explícito (com motivo obrigatório).
- Conferência exige completude, cabeça esperada e fingerprint esperado; qualquer alteração em instrumento/aplicação/resultado/elegibilidade muda o fingerprint e exige reconferência.
- Oficialização só com capacidade `oficializar-resultado-avaliativo` em política homologada; hoje inexistente ⇒ recusa, nada gravado.
- Publicação: sempre `aguardando-regra-homologada`; nada é publicado por passagem de tempo. Cálculo/recuperação/conselho: bloqueados sem regra.
- Fechamento oficial exige conferência vigente dos instrumentos AA e capacidade na data efetiva do ato.

## Prova
- E2E transacional `supabase/tests/aa2_assessment_e2e.sql` (rollback; sucesso = `aa2-assessment-e2e-ok`), zero resíduos verificados.
- UI: painel de completude/conferência na pauta (`assessment-governance-panel.tsx`).
