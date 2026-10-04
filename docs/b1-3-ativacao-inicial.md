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

## Estado
Não ativado; v1=108, v2=121, v3=199 em draft. Conta Auth `admin@` **não existe**.

## Passo restante (humano)
1. Entrar como Supervisão → Administração → "Primeiro acesso do Administrador Geral" → escolher a senha.
2. Sair, entrar com `admin@sigem.itap.gov.br` → "Ativação inicial do SIGEM" → revisar v3 (199 regras) → confirmar.
