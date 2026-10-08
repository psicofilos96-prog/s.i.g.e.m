# B1.4 — fechamento operacional da fundação

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


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
Essa impressão foi armazenada com `status = draft`. A função inclui esse
status; após homologação, a mesma v3 produz
`4627aa42bbc43bd380072bf9178b9561d4356dd598b62e3e3e219e02c5ae3e56`.
A diferença não indica alteração das 199 regras. O teste pós-ativação confere
ambas as impressões, a proveniência do ato e a contagem de regras.

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

A rota `/administracao-geral` lista módulos pelas capabilities da atuação
vigente (`general_admin_session`), sem e-mail. O acesso foi incluído também na
navegação lateral móvel, condicionado ao mesmo estado de atuação; o atalho de
topo já existia nas telas médias e maiores. Teste com sessão real no navegador
ainda depende de acesso ao ambiente da aplicação.

`supabase/tests/b1_4_post_activation_readonly.sql` registra verificações
somente leitura para o banco já instalado. Os testes B1.1–B1.3 com fixture e
rollback não devem ser executados como se o banco ainda estivesse em draft.
O novo teste SQL ainda não foi executado nesta máquina por falta de conexão
administrativa. Não simular `auth.uid()` para provar ativação real.

## Auditoria de segurança reproduzível

O Security Advisor foi reexecutado após o hardening. O total caiu de 220 para
195 findings: 28 INFO (RLS sem policy), 52 WARN (EXECUTE de SECURITY DEFINER
para anon) e 115 WARN (EXECUTE para authenticated), redução de 25 alertas sem
criação de policies artificiais. Há 152
funções SECURITY DEFINER efetivas, todas com `search_path` explícito. Dos INFO,
27 são objetos intencionalmente fechados; a designação legada é exceção por
seus grants. Não foram criadas policies artificiais. Reproduzir inventário fonte com
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
não substitui esse passo. A verificação externa encontrou grants destrutivos,
inclusive `TRUNCATE`, em `capability_policy_rules`, `institutional_classes`,
`institutional_class_record_versions`,
`institutional_class_period_organization_versions` e
`sigem_installer_designation` para anon/authenticated/service_role; sandbox_exec
tinha INSERT. RLS bloqueia DML de linhas, mas não TRUNCATE: é achado A concreto.
A migration aditiva `0057` revoga esses privilégios, reduz o EXECUTE anônimo
dos writers B1/B2 e fecha três context helpers com potencial vazamento E e duas
trigger functions. A `0057` foi aplicada e verificada na Cloud em 2026-10-04:
os cinco objetos perderam `TRUNCATE`/DML destrutivo para os papéis de aplicação,
os writers auditados deixaram de aceitar `anon` e os helpers privados ficaram
fechados. A regressão B2.5.2 revelou ainda EXECUTE de `service_role` nos dois
writers de turma; o grant foi revogado na Cloud e registrado de forma append-only
em `0058_b1_4_class_writer_acl.sql`. A `0057` permaneceu byte-idêntica ao
commit em que foi criada; nenhuma migration aplicada foi reescrita.

## Regressão e gate B2/B3

A suíte TS completa continua em 2.919 testes / 203 arquivos, com typecheck,
build, auditoria SQL estática e `git diff --check` aprovados na revisão local
pós-hardening. Na Cloud passaram `b1_4_security_hardening.sql`,
`b1_4_post_activation_readonly.sql`, B2.5.1, B2.5.2 privilégios, B2.5.2 cadeia,
B2.5.2 histórico (24 cenários), B2.5.2 contexto de ano (26 cenários) e B2.5.3
(23 cenários). B2.1, B2.2, B2.4, B2.6, B3.1, B3.2 e B3.3 já haviam alcançado
seus marcadores finais de sucesso na Cloud. Os testes B2.5 foram atualizados
para o estado pós-B1.3: v1/v2 permanecem draft e a autorização operacional vem
da v3 homologada; Secretaria Escolar continua restrita a `[school]` e o
Administrador Geral só atua por regras explícitas `[network]`.

Uma execução anterior de prova B2.5.3 deixou fixture sintética por comportamento
do executor SQL. O resíduo foi identificado e removido de forma estritamente
direcionada; a conferência posterior mostrou 0 escolas, 0 turmas, 0 estudantes e
somente as três políticas canônicas. B2.5.1/2/3 foram então repetidos com
rollback confirmado e permaneceram sem resíduos. Nenhuma escola real foi importada.

Escolas, anos, organizações de períodos, turmas, estudantes, matrículas,
participações, alocações e posições curriculares têm contratos e writers no
repositório. O plano de operação e a primeira fonte oficial necessária estão
em `docs/b2-b3-gate-primeira-escola.md`. Não foi importada escola. D1, R2–R5,
matrizes reais, aplicabilidade, jornada, grade e competências ainda não
decididas permanecem fronteiras normativas; não houve default implícito.

**Estado desta auditoria:** B1.4 está tecnicamente fechado na Cloud. A ativação
é única, a v3 permanece homologada com 199 regras, o hardening 0057/0058 está
efetivo, as ACLs B2.5 foram comprovadas e as regressões pós-ativação relevantes
passaram sem resíduos. O próximo gate não é outro reparo de B1: é a preparação
controlada da primeira escola real, preservadas as fronteiras normativas já
documentadas.
