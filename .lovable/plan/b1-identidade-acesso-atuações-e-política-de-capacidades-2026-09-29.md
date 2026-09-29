# B1 — Identidade, acesso, atuações e Política de Capacidades

Objetivo de saída: montar a cadeia institucional real sem SQL manual:
localizar/criar pessoa → criar conta vinculada → atribuir atuação com alcance e vigência → registrar política → homologá-la por ato → entrar com a conta → receber exatamente as capacidades correspondentes.

## Salvaguardas (congeladas)
- Nenhuma segunda arquitetura de identidade, autorização ou política. Reutilizar `institutional_persons`, `user_person_links`, `institutional_engagements` (+ `scope_level`, `institutional_engagement_scope_classes`), `capability_policies`, `capability_policy_rules`, `effective_capabilities`/`has_*_capability`, e a autenticação já existente.
- Nenhuma conta-mestra, superusuário, senha universal, bypass ou capacidade fora da política.
- Política v1 (103 regras / 8 atuações) permanece congelada; B1 só fornece o caminho para registrá-la e homologá-la — não a homologa, não cria contas nem grava a cadeia Juliana.

## 1. Ato de instalação único (bootstrap)
- Nova tabela singleton de estado institucional: `nao-instalado` → `instalado` (irreversível por trigger).
- Nova tabela de designação da conta instaladora (preenchida uma única vez pelo operador da implantação) e registro permanente do ato de instalação (executor, pessoa, atuação, política, ato, data/hora), append-only.
- Função transacional `install_sigem(ato, pessoa, atuação de rede, política inicial)`: exige estado `nao-instalado`, conta autenticada = designada, referência de ato; trava o singleton (`FOR UPDATE`) para que duas tentativas concorrentes resultem em exatamente uma; cria/vincula pessoa, atuação com alcance de rede, política + regras e homologa; muda estado. Qualquer falha desfaz tudo.
- O critério é o estado, nunca "não há política homologada"; ausência futura de política/atuação não reabre.
- Após instalação, o instalador só tem o que `effective_capabilities` lhe dá.

## 2. Pessoas
- Funções `register_person` / `record_person_version` (identificador institucional, nome), exigindo capacidade existente de cadastro institucional (reutilizada da política congelada); leitura por atuação com alcance.

## 3. Contas institucionais
- Server function com `requireSupabaseAuth` que verifica capacidade via `has_*_capability` e só então usa o cliente administrativo para: gerar login pela regra oficial (matrícula / INEP / setor + `@sigem.itap.gov.br`), gerar senha provisória, criar a conta e o vínculo conta↔pessoa atomicamente (conta desfeita se o vínculo falhar).
- Senha provisória exibida uma única vez; nunca gravada, logada nem auditada. Marca "troca obrigatória" no primeiro acesso, com tela de troca.
- Redefinição administrativa de credencial por fluxo próprio auditável (registro do ato sem a senha).
- Sem autocadastro; conta não cria pessoa, atuação nem capacidade.

## 4. Atuações
- Função `record_engagement` (tipo, alcance `rede|escola|turmas|turma`, turmas do alcance, vigência, ato originador, rótulo de cargo só como snapshot) e encerramento de vigência como novo ato — sem edição destrutiva.

## 5. Política de Capacidades
- Funções `register_capability_policy_draft` (versão encadeada + regras) e `homologate_capability_policy` (ato obrigatório; capacidade existente de homologação; regras imutáveis após homologação).
- Tela para importar a minuta v1 congelada como rascunho, conferir diferenças e homologar — só quando o ato real existir.

## 6. Telas (área "Administração institucional")
Instalação (visível apenas enquanto `nao-instalado`), Pessoas, Contas, Atuações, Política, e "Minhas capacidades" (projeção de `effective_capabilities` para conferência do critério de saída).

## Testes obrigatórios
Instalação única; segunda tentativa recusada; conta não designada recusada; atomicidade; falha intermediária sem resíduos; política efetiva após instalação; instalador sem privilégio extrínseco; ausência futura de política não reabre; concorrência → exatamente uma; rastreabilidade do ato. Mais: conta sem atuação = zero capacidades; senha provisória ausente de qualquer tabela/log; criação de conta recusada sem capacidade.

## Pendência que depende de você
A designação da conta instaladora e o número do ato de implantação são dados administrativos: deixo o mecanismo pronto e vazio.
