# Minimização de dados sensíveis — NPRIV.1

**Situação atual:** Registro de lote (2026-10-08).

## Corrigido
- `src/server.ts`: erros não tratados do servidor eram impressos crus (`console.error`), sem passar pela redação; mensagens do banco podem conter CPF/contato. Agora saem por `logError` (telemetria redigida).

## Conferido sem mudança
- Telas de pessoa/profissional: CPF só mascarado (2 últimos dígitos); campo cheio só no formulário de quem edita.
- Busca global: só nome/código; identificador oficial por igualdade exata.
- Relatórios/exports: colunas sensíveis fora por padrão; registro de relatórios não declara CPF/contato/endereço.
- Verificação pública da carteirinha: só nome, escola, turma, ano e status.
- Inclusão: CID/laudo só pelo leitor clínico com trilha; exportação minimizada.
- URLs: nenhum CPF/nome em parâmetro de busca.

## Teste
`src/features/privacy/npriv1-minimization.test.ts`.

## Pendente
- INTERACTIVE_BROWSER_VALIDATION_PENDING: conferência por estação com login real (chave técnica do harness indisponível nesta sessão).
