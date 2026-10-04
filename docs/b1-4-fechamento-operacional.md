# B1.4 — fechamento operacional da fundação

Data: 2026-10-04. Base inicial desta revisão: `1be07fe6a2ad0cd7c065cc343b42acf8df11fa12`.
Nenhuma migration histórica foi editada e nenhuma ativação foi repetida.

## Snapshot pós-ativação verificado externamente

O operador verificou diretamente na Cloud: `sigem_installation_state = instalado`
em `2026-10-04 21:21:31.039322+00`; exatamente um ato de instalação
`4003d7e5-c15e-48ec-b85d-74e2393a248f`, executado pela conta Auth confirmada
`admin@sigem.itap.gov.br`; proveniência `ativacao-inicial-sem-ato-externo` e
`act_ref` NULL. A v1 permanece draft com 108 regras, a v2 draft com 121 e a v3
`5d55dad5-2c47-4b2c-8f7c-bd4a76d6f515` está homologada com 199 regras.
O fingerprint da v3 é
`73f7be02d792b16dadc72152c12825a05fcc39203cb673749a8545a10c49f35b`.

A pessoa `076951f6-914f-4c3b-a1f3-92c0a8979b2b` tem nome
`Administrador Geral do SIGEM` e natureza `orgao-institucional`. A atuação
`4627a681-c2cb-4fd2-b023-09376dd281bc` é do tipo
`administrador-geral-do-sigem`, em `rede`, sem escola nem término. A cobertura
`sigem_general_admin_coverage_issues(v3)` está vazia. Existe exatamente um
registro de origem do primeiro acesso. São fatos do snapshot externo informado;
esta máquina não dispõe de sessão administrativa para repeti-lo.

## Contrato técnico B1

O primeiro acesso só aceita senha; o login vem da designação vigente no banco.
A solicitação exigia a conta confirmada da Supervisão preservada na primeira
designação, estado `nao-instalado` e ausência de origem. A migration `0055`
impõe origem única e confere sob trava solicitante, designação e estado; `0056`
apenas documenta a guarda. Depois da ativação, a porta de primeiro acesso e
`activate_sigem_reviewed` recusam novo uso pelo estado instalado. A pessoa da
Supervisão não recebeu atuação de Administrador Geral. Autorização operacional
deriva de atuação vigente, política homologada, capability e escopo, nunca do
texto do e-mail. A v3 homologada é imutável; uma capability futura exige nova
versão explícita. Homologação posterior comum continua exigindo ato quando o
contrato exigir.

`supabase/tests/b1_4_post_activation_readonly.sql` registra verificações
somente leitura para o banco já instalado. Os testes B1.1–B1.3 com fixture e
rollback não devem ser executados como se o banco ainda estivesse em draft.
O novo teste SQL ainda não foi executado nesta máquina por falta de conexão
administrativa. Não simular `auth.uid()` para provar ativação real.

## Auditoria de segurança reproduzível

O painel do Security Advisor não está acessível aqui e nenhuma lista individual
de findings foi fornecida. Reproduzir o inventário fonte com
`node scripts/audit-sql-security.mjs`. A inspeção estática dos SQL encontrou
220 declarações fonte de funções `SECURITY DEFINER`, todas com `SET search_path`
explícito; 130 usam `public` no caminho. Isso requer verificar `CREATE` no
schema e as definições efetivas no catálogo antes de declarar ausência de
escalada. Encontrou 136 tabelas com `ENABLE ROW LEVEL SECURITY`; 19 não têm
`CREATE POLICY` no conjunto de SQL inspecionado. Essas 19 são candidatas à
classe B (fechadas intencionalmente), não prova de vulnerabilidade ou do estado
efetivo no `pg_catalog` da Cloud. Uma chamada anônima à RPC privada
`sigem_designated_installer_email()` recebeu 401 / SQLSTATE `42501`. O bundle
público não contém `SUPABASE_SERVICE_ROLE_KEY`.

Classificação para revisão dos findings reais: A = exposição efetiva; B =
objeto deliberadamente fechado; C = RPC `SECURITY DEFINER` com autorização
interna fail-closed; D = legado sem risco material atual; E = investigação
necessária. Para C, conferir função efetiva em `pg_proc`, owner, `search_path`,
grants, RLS, capability, escopo e possibilidade de oracle. A inspeção de texto
não substitui esse passo. Nenhuma vulnerabilidade A foi demonstrada nesta
revisão; isso não equivale a declarar zero findings ou zero risco na Cloud.

## Regressão e gate B2/B3

A suíte TS completa passou nesta revisão: 2.919 testes em 203 arquivos
(155,90 s); build, typecheck e `git diff --check` passaram. O lint tem dívida
histórica de 18.700 erros e 49 avisos, sem reforma cosmética. Testes SQL transacionais B1/B2/B3 e smoke
integrado em rollback ainda não puderam ser executados nesta Cloud.

Escolas, anos, organizações de períodos, turmas, estudantes, matrículas,
participações, alocações e posições curriculares têm contratos e writers no
repositório. O plano de operação e a primeira fonte oficial necessária estão
em `docs/b2-b3-gate-primeira-escola.md`. Não foi importada escola. D1, R2–R5,
matrizes reais, aplicabilidade, jornada, grade e competências ainda não
decididas permanecem fronteiras normativas; não houve default implícito.

**Estado desta auditoria:** a ativação B1 é fato concluído segundo o snapshot
externo. A prova independente pós-ativação, a execução SQL em rollback e a
auditoria do catálogo efetivo de permissões da Cloud seguem pendentes de acesso
de leitura administrativa; não são pré-requisito para repetir ativação.
