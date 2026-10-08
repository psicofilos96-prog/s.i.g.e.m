# NTEST.1 — Harness institucional de testes

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


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

## NTEST.2 — fluxos consolidados por área (2026-10-07)
Fonte: `src/test/harness/station-flows.ts` (+ `station-flows.test.ts`). 12 fluxos nas 9 áreas; cada um declara a camada mais forte que o harness prova hoje.

| Área | Fluxo | Camada |
|---|---|---|
| Secretaria | estação + estudantes da escola; enturmação/vagas | authenticated-layer |
| Secretaria | documentos escolares | static |
| CIECE | censo/qualidade; mapa da rede | authenticated-layer |
| Supervisão | calendário/home | static (sem perfil sintético: conta-órgão) |
| Avaliação | desempenho/painéis | static (sem perfil sintético) |
| OP | orientação/planejamento | authenticated-layer |
| Direção | dossiê/profissionais/horários | authenticated-layer |
| Alimentação | estação | static (sem perfil sintético) |
| Docente | diário/turmas da atuação (perfil professor) | authenticated-layer |
| Admin | central de acessos/cobertura (administrador geral) | authenticated-layer |

Regras testadas: fluxo sem perfil sintético nunca é declarado autenticado; nenhum fluxo se declara `browser`; sem sessão aprovada todo fluxo leva `INTERACTIVE_BROWSER_VALIDATION_PENDING`; o runner passa pela porta antes de qualquer suíte; em `NODE_ENV=production` o runner sai com código 3 sem tocar no banco.

Execução: 34/34 estáticos + **BO_HARNESS 69/69**, camada `authenticated-layer`, 0 resíduos antes e depois.

Limitações: Supervisão, Avaliação e Alimentação não têm tipo de atuação sintético no manifesto (seus tipos não existem na política homologada como perfis do harness) → só camada estática; nada é provado em navegador sem sessão aprovada; smoke a11y repete o achado de rolagem horizontal de 401 px em `/central-de-acessos` no celular (informativo, não conta no 69/69).

## NTEST.3 — Supervisão, Avaliação e Alimentação (2026-10-08)

Arquivo: `src/test/harness/ntest3-stations.test.ts` (44 casos), dentro do mesmo runner `scripts/institutional-harness.mjs` (porta fail-closed → `vitest run src/test/harness`). Dados de teste são linhas em memória descartadas por caso; nada é gravado no banco.

| Área | Menu | Rotas permitidas | Rotas negadas (deep link) | Export | Ação principal | Camada |
|---|---|---|---|---|---|---|
| Supervisão | home `/supervisao-escolar` no menu; nenhum item negado | `/supervisao-escolar`, `/unidades` | alunos, secretaria, CIECE, alimentação, avaliação, profissionais, admin | `acompanhamento-supervisao-escolar`: responsável fora por padrão; CSV neutraliza fórmula | `record_school_supervision` / `school_supervision_records_at`, sem DML direto; sem capacidade nenhuma ferramenta "pode agir" | static |
| Avaliação | home `/avaliacao-desempenho` | `/avaliacao-desempenho`, `/paineis` | alunos, secretaria, supervisão, alimentação, profissionais, admin | BNCC×SAEB sem formato (DEPENDE_DADO); evolução exige ≥3 edições | `record_assessment_conference` / `record_assessment_officialization` | static |
| Alimentação | home `/alimentacao-escolar` | `/alimentacao-escolar`, `/alimentacao-escolar/cozinha`, `/unidades` | alunos, secretaria, supervisão, avaliação, profissionais, admin | relatórios `nae-*` no registro único; ausência sai vazia, nunca zero | Cozinha: `record_meal_execution`, `record_meal_stock_movement`; sem DML direto em 5 telas | static |

Pendências: ASSIGNMENT_PENDING — a política homologada v8 não tem tipo de atuação para estas três estações, então `bo_fixture_prepare` as recusa e não há usuário sintético com cleanup para a camada autenticada (não foi concedida capacidade). INTERACTIVE_BROWSER_VALIDATION_PENDING — tela com login real.
