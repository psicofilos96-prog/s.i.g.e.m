# B1.4 — Auditoria de fechamento operacional

Data: 2026-10-04. Base de código: `1d977092d8f456c8b9df607527ee09af5f952eee`.
Este documento distingue o que foi observado nesta máquina do último estado da
Cloud informado pelo operador; não substitui uma consulta administrativa atual.

## Estado inicial conhecido

- Última verificação externa informada: SIGEM `nao-instalado`; v1/v2/v3 em
  `draft`, com 108/121/199 regras e 67/78/78 capabilities; cobertura do
  Administrador Geral v3 sem pendências; designação vigente
  `admin@sigem.itap.gov.br`; nenhum ato de ativação; conta Auth do mestre ausente;
  Supervisão confirmada. Fingerprint v3 informado:
  `73f7be02d792b16dadc72152c12825a05fcc39203cb673749a8545a10c49f35b`.
- O operador informou que `0055` está aplicada na Cloud e `0056` sincroniza o
  histórico de migrations. Isso não foi reconsultado por uma sessão administrativa
  nesta máquina.
- O checkout estava limpo em `4760454`; `origin/main` avançara dois commits.
  Fast-forward seguro trouxe `1d97709`. Nenhuma migration histórica foi editada.

## Atualização informada pelo usuário

Após a verificação externa inicial, o usuário informou que criou a conta real
`admin@sigem.itap.gov.br` pelo fluxo oficial de primeiro acesso. A senha não foi
usada, registrada ou transmitida a ferramentas de desenvolvimento. A conta,
confirmação de e-mail, origem one-shot e estado de ativação ainda exigem nova
leitura administrativa da Cloud; a informação do usuário é evidência da ação,
mas não substitui essa leitura. Nenhuma sessão legítima dessa conta está
disponível neste ambiente de execução.

## B1.3 e primeiro acesso

`createDesignatedActivatorAccount` recebe somente senha e busca o login vigente
no banco. O solicitante deve ser a conta confirmada preservada na primeira
designação (Supervisão). O servidor recusa quando o estado não é `nao-instalado`
ou quando já há origem. A migration `0055` reforça no banco a unicidade da
origem imutável e confere, sob trava, solicitante, designação e estado. A
autorização não acrescenta atuação nem capability à Supervisão. O bundle público
não contém `SUPABASE_SERVICE_ROLE_KEY`; o cliente administrativo é carregado em
handler de servidor.

Este agente não criou conta Auth, definiu senha ou executou ativação.
Sem uma sessão legítima de `admin@`, `activate_sigem_reviewed` não pode ser usado
para ativação real. Nenhuma sessão foi simulada.

## Security Advisor e fronteira de acesso

Esta máquina não possui acesso ao relatório do Security Advisor nem sessão
administrativa da Cloud. Assim, não há lista de findings que possa ser
classificada individualmente, nem contagem antes/depois verificável. Não se
declara zero vulnerabilidades reais. A classificação a aplicar a cada finding
exportado é: A = exposição real de leitura/escrita/escalação; B = RLS fechada
intencional; C = RPC `SECURITY DEFINER` acessível, mas com autorização interna
fail-closed; D = legado sem risco operacional atual; E = precisa de investigação.
Para C, conferir definição vigente, `search_path`, privilégios, capability e
escopo dentro da função; para A, corrigir por migration aditiva e repetir teste
de acesso. Sem o conjunto de findings, não se atribui classe a nenhum item.

Verificação direta disponível: a chamada anônima à RPC privada
`sigem_designated_installer_email()` recebeu HTTP 401 / SQLSTATE `42501`.
Isso comprova apenas essa fronteira, não todas as ACLs da Cloud.

## Prontidão técnica B2/B3

O repositório contém writers e testes para escolas, anos/organizações de
períodos, turmas, estudantes, matrículas, participações, alocações e posições
curriculares. A origem dos dados deve ser preservada pelos writers canônicos.
Sem política homologada e atuação efetiva, esses writers permanecem fechados
na Cloud; não há prontidão operacional comprovada para carga real. Não foi
importada escola nem semeado catálogo.
O plano verificável para a primeira escola e a ordem de writers estão em
`docs/b2-b3-gate-primeira-escola.md`. O smoke transacional de rollback continua
pendente de uma sessão autorizada na Cloud.

Permanecem intocados: catálogo D1, decisões R2–R5, matrizes reais, regras de
aplicabilidade, atos inexistentes e demais escolhas institucionais. E1–E4,
jornada e grade continuam com lacunas de writer/competência para o piloto
completo, como documentado em O1/O2; não se criou atalho.

## Validação e estado final

Build e typecheck passaram. A suíte completa executou 203 arquivos e 2.919
testes, todos aprovados na repetição após a informação de criação da conta
(159,65 s). O lint permanece com dívida
preexistente (18.700 erros, 49 avisos nesta execução); não foi aplicada
reformatação em massa. Os testes SQL B1/B2/B3 exigem execução transacional no
banco e não foram executados nesta máquina.

O fechamento B1.4, a ativação, a auditoria pós-ativação e a triagem integral do
Security Advisor **não estão concluídos**. A próxima verificação legítima exige
acesso administrativo ao estado atual da Cloud; a ativação exige a sessão real
do Administrador Geral. Não solicitar nem copiar sua senha.
