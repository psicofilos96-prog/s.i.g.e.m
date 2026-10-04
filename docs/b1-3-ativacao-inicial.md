# B1.3 — Ativação institucional inicial sem ato externo

Data: 2026-10-04. Decisão do proprietário/gestor do projeto: login mestre `admin@sigem.itap.gov.br`;
não existe ato administrativo externo para ativar o SIGEM. Nenhum ato é fabricado.

## O que mudou (migrations `0053`, `0054`)
- "Instalação" passa a ser **ativação institucional inicial** na UI/docs (não é instalação de software).
- Designação do ativador = histórico versionado `sigem_installer_designation_versions` (append-only, só antes da ativação):
  v1 = `supervisao@…` (cópia fiel da designação legada), v2 = `admin@sigem.itap.gov.br`, base
  `decisao-de-bootstrap-do-proprietario`, `designation_act_ref` NULL. A tabela singleton antiga ficou imutável e DEPRECATED.
- `activate_sigem_reviewed(policy, fingerprint, confirmação)`: sem ato; mantém autenticação, e-mail confirmado no Auth,
  login designado, `nao-instalado` sob trava, política draft, impressão digital, revisão, 5 capacidades administrativas,
  completude do Administrador Geral e atomicidade. Atuação inicial fixa `administrador-geral-do-sigem` (rede), pessoa
  `Administrador Geral do SIGEM` como `orgao-institucional`, origem da natureza "ativação institucional inicial".
- Proveniência: `sigem_installation_acts.provenance = ativacao-inicial-sem-ato-externo`, `act_ref` NULL, `policy_fingerprint`;
  `capability_policies.homologation_origin = ativacao-inicial` com `homologation_act_ref` NULL (CHECK de forma).
- Homologação posterior comum (`homologate_capability_policy`) continua exigindo ato. Portas antigas com ato preservadas (DEPRECATED).
- Primeiro acesso: `createDesignatedActivatorAccount` (server fn autenticada) cria SÓ o login designado, só antes da ativação,
  via Admin Auth oficial, com a senha escolhida pela pessoa (nunca gravada); origem em `sigem_activator_account_origins`.
  Cadastro público continua desligado.

## Testes (rollback)
`supabase/tests/b1_3_initial_activation.sql`: designação real e histórico; Supervisão/outro e-mail → `not-designated`;
não confirmado, revisão, impressão, política sem mestre, cobertura e 5 administrativas fail-closed; ativação sem ato com
proveniência correta; repetição recusada; designação travada após ativação; homologação comum exige ato; ACL.
Regressões B1.1 e B1.2 atualizadas para usar fixture do login designado. Suíte completa 2919/2919, typecheck e build OK.

## Estado informado em 2026-10-04
O usuário informou posteriormente que a conta real `admin@sigem.itap.gov.br` foi
criada pelo fluxo oficial. A criação ainda não foi reconsultada diretamente nesta
máquina, e a ativação não foi executada por este agente. O último estado de Cloud
verificado externamente antes da criação era `nao-instalado`, com v1/v2/v3 em
draft (108/121/199 regras). Não reutilizar a afirmação antiga de ausência da
conta como estado atual.

## Continuidade B1.4
Em `171adef`, a solicitação do primeiro acesso passou a exigir a sessão confirmada da
conta registrada na primeira designação histórica (Supervisão). Essa autorização só
serve ao bootstrap e é fechada pelo estado `nao-instalado`; não concede capability.
Em `4760454`, a migration `0055` tornou o registro imutável de origem único e
adicionou um guard que confere, sob trava, estado, designação vigente e solicitante.
A migration `0056` apenas documenta a guarda, sem mudar regra ou dado. A senha é
entregue somente ao Supabase Auth oficial; o login de destino vem do banco.

O estado acima é o último estado da Cloud informado externamente; esta sessão de
desenvolvimento não dispõe de uma sessão administrativa para reconsultar Auth e as
tabelas privadas. Consulte `docs/b1-4-fechamento-operacional.md` antes de tratar
esses dados como estado atual.

## Passo restante (humano)
Entrar com a conta real `admin@sigem.itap.gov.br` → Administração → "Ativação
inicial do SIGEM" → revisar a v3 (199 regras) e a impressão digital exibida →
confirmar pela sessão autenticada. Não simular a sessão nem reutilizar senha em
ferramentas de desenvolvimento.
