# B1.3 — Ativação institucional inicial sem ato externo

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


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

## Estado pós-ativação informado em 2026-10-04
Uma verificação externa direta na Cloud confirmou a ativação real: estado
`instalado`, v3 homologada com 199 regras, um ato com proveniência
`ativacao-inicial-sem-ato-externo`, `act_ref` NULL, pessoa e atuação de rede do
Administrador Geral e uma única origem de primeiro acesso. V1/v2 permanecem
draft com 108/121 regras. IDs, fingerprint e limites da verificação estão em
`docs/b1-4-fechamento-operacional.md`. Não executar a ativação novamente.

## Continuidade B1.4
Em `171adef`, a solicitação do primeiro acesso passou a exigir a sessão confirmada da
conta registrada na primeira designação histórica (Supervisão). Essa autorização só
serve ao bootstrap e é fechada pelo estado `nao-instalado`; não concede capability.
Em `4760454`, a migration `0055` tornou o registro imutável de origem único e
adicionou um guard que confere, sob trava, estado, designação vigente e solicitante.
A migration `0056` apenas documenta a guarda, sem mudar regra ou dado. A senha é
entregue somente ao Supabase Auth oficial; o login de destino vem do banco.

O snapshot pós-ativação foi verificado externamente; esta máquina não dispõe de
sessão administrativa para repetir a consulta. Detalhes e limites estão em
`docs/b1-4-fechamento-operacional.md`.

## Continuidade
Auditar a cadeia pós-ativação e preparar B2/B3 sem alterar a v3 homologada.
Não reutilizar senha em ferramentas de desenvolvimento nem repetir o bootstrap.
