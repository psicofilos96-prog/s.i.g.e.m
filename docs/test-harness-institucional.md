# NTEST.1 — Harness institucional de testes

**Resultado: PASS — INSTITUTIONAL_TEST_HARNESS_COMPLETE** (2026-10-07).

## Entrada única
```
SIGEM_TEST_HARNESS=1 SIGEM_HARNESS_ACK=fixtures-efemeras-com-cleanup node scripts/institutional-harness.mjs
```
Demora ~5 min na camada autenticada; não rode com `timeout` curto. Se for interrompido (kill/timeout pula o `finally`): `node scripts/bo-fixture-sweep.mjs` com as mesmas variáveis.

## Porta fail-closed (`scripts/harness-gate.mjs`)
Recusa se: `NODE_ENV=production`; existir variável `VITE_*` de harness/fixture/impersonação; faltar opt-in `SIGEM_TEST_HARNESS=1`; faltar o reconhecimento `SIGEM_HARNESS_ACK`; o destino não for o banco canônico (`environment-gate`). Não concede nada: RLS, capabilities e writers continuam valendo.

## Camadas (sempre declaradas no relatório)
| Camada | Quando | Prova |
|---|---|---|
| `browser` | sessão mintada pela plataforma com aprovação humana | tela real com login real |
| `authenticated-layer` | credencial técnica presente, sem login interativo | JWT real de usuário sintético contra RLS/capabilities + smoke headless com essa sessão |
| `static` | sem credencial | só regras puras (navegação por estação); NÃO prova RLS |
Fora de `browser`, o runner imprime `INTERACTIVE_BROWSER_VALIDATION_PENDING`.

## Garantias
- Usuários sintéticos só em `@bo-fixture.invalid` (nunca recebe e-mail), senha aleatória por execução, só em memória; nada no repositório.
- Sem magic link, sem OTP, sem impersonação: teste recusa `generateLink`/`signInWithOtp`/senha literal nos scripts.
- Nenhum código do app importa o harness (teste estático).
- Cleanup em `finally` + varredura de resíduo antes e depois; varredura manual para execução interrompida.

## Cenários por estação (`src/test/harness/station-scenarios.ts`)
Secretaria, CIECE, Supervisão, Avaliação, OP, Direção, Alimentação e perfis pedagógicos (professor, gestão pedagógica da rede): rotas que devem e não devem ser alcançadas + tipos de perfil do manifesto.

## Suíte "69 perfis"
É `scripts/bo-fixture-harness.mjs`: 10 tipos da política homologada × escopo × com/sem pessoa, recusas negativas, revogação com sessão aberta, concorrência, smoke a11y autenticado.
Execução de 2026-10-07: **69/69, 0 usuários e 0 resíduos após**. Antes: duas execuções interrompidas por timeout deixaram 22 contas/10 registros; removidos pela varredura (resíduo 0) — motivo da criação do `bo-fixture-sweep.mjs`.

## Achado (não contado no 69/69)
Smoke informativo: `/central-de-acessos` no celular tem rolagem horizontal de 409 px (administrador geral). Fica para N12.4.
