# NREL.3 — Modelos pessoais do gerador no servidor

## Situação atual
Classe: Registro de lote (2026-10-08).

## Feito
- Tabela `report_template_versions` (migration 0246): append-only (só SELECT/INSERT), dono = `auth.uid()` forçado por trigger, RLS só do próprio dono, versão +1 sob lock, `UNIQUE(owner_id, idempotency_key)`. Arquivar = nova versão `archived`.
- Com login, o gerador lê/grava modelos na conta (vale em qualquer navegador); sem login, segue o modo local do navegador.
- Guarda só as escolhas; dado sempre relido com a ACL de quem gera; exportação inalterada (motor de relatórios).
- Testes: `src/features/reports/report-templates-nrel3.test.ts`.

## Pendências
- DEPENDE_DECISAO: compartilhar com o setor (não há capability definida; botão desabilitado com explicação).
- PENDENTE: fontes de Avaliação, CIECE e DP — sem leitor transversal autorizado; continuam recusando execução.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: salvar/trocar navegador com login real; isolamento entre duas contas reais (PROVAS_SQL_PENDENTES).
- 2027 não configurado.
