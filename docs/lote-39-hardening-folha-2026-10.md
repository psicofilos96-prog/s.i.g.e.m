# Lote 39 — Hardening real da importação da folha (L38)

Situação atual: Registro de lote. Sem dado pessoal. Sem aprovação humana registrada.

## Executado
- Migrations `0509_l39_payroll_import_hardening.sql` e `0510_l39_switch_revoke_sandbox.sql` (incrementais; integridade de hashes OK, sem drift nas 558 anteriores).
- Escrita direta revogada em `payroll_functional_registrations` e `payroll_registration_person_links` para PUBLIC, anon, authenticated, service_role e sandbox; restam só SELECT (sujeito a RLS).
- Única via de escrita: `technical_import_payroll_functional_registrations(hash, payload)` — SECURITY DEFINER, sem EXECUTE para papéis de aplicação; switch próprio no banco (`payroll_import_switch_events`, append-only, ausência = desligado) somado a `technical_automation_enabled()`; manifesto e linhas por allowlist (CPF/CID recusados); leiaute fixo; rejeições individualizadas (nº de linha + motivo); tudo-ou-nada; registro em `technical_execution_operations` + `technical_execution_targets`; idempotência por fingerprint de conteúdo.
- Carga L38 adotada no ledger técnico sem alterar linhas: 1 operação, 2.037 alvos. Recarga do mesmo arquivo devolve `ja-carregado`.
- Matrícula: chave só para `<dígitos>-<DV>` (DV e zeros preservados); `SM-MT`, `61.725-3` e numérica sem DV ⇒ não elegível. Na relação SEMED: 213 casam, 4 com formato válido sem par, 2 não elegíveis.
- Escopo: no máximo uma linha por (período de referência, matrícula), em qualquer arquivo; períodos diferentes = fotografias do mesmo vínculo; pessoa 1:N vínculos continua no ledger de ligação.
- `record_payroll_person_link`: validação de entradas; locks por matrícula e por chave; repetição só devolve `ja-registrado` se o payload for idêntico (senão `idempotencia-payload-divergente`); pessoa precisa ser `pessoa-natural`; revogação exige informar a pessoa atualmente vinculada; auto-vínculo/autorrevogação recusados; sem EXECUTE para service_role.
- Exposição: nome e nascimento só para `consultar-registro-funcional`; a capability ampla usa `payroll_registrations_overview` (sem nome, sem nascimento, só ano de admissão).
- Script `lote38-payroll-import.py` não grava mais nem usa credencial: só prepara o payload em arquivo privado fora do repositório.

## Provas
- `supabase/tests/l39_payroll_hardening.sql`: 12/12 PASS (switch desligado, recarga idempotente, payload divergente, SM-MT, chave cpf, novo período, conflito no período, repetida no arquivo, normalização, privilégios, sem sessão, append-only). Bloco revertido: após a execução, 2.037 linhas, 0 ligações, 10.822 pessoas, switch vazio.
- Papel restrito do sandbox recebeu `permission denied` ao tentar ligar o switch.
- `src/test/invariants/l39-payroll-hardening.test.ts` 7/7; invariantes 158/158.

## Bloqueado
- Vínculo e revogação positivos com sessão humana real: não há titular de `manter-registro-funcional`; não foi simulado.
- SEMED 6 divergências e relação escolar (1.797 linhas): continuam pendentes do DP; nenhuma ligação por nome.
- `lote38-payroll-checks.py` ainda lê com credencial de serviço (só leitura e tentativas negativas); deve migrar para o teste SQL.
- CI do GitHub para este commit: não verificado daqui.
