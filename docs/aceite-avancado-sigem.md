# Reaceite avançado do SIGEM — estado reconciliado (2026-10-05)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Nenhum dado real foi importado e nenhuma identidade foi criada.

## Fatos da Cloud após a correção
- Política v4: homologada por `decisao-do-proprietario`, sem ato, vigência 2026-10-04, 213 regras / 85 capabilities, agora histórica. v3 (199/78) histórica. v1/v2 rascunhos intactos.
- **Política v5 (migration `0096_capability_policy_v5_advanced_layers`)**: homologada por `decisao-do-proprietario`, `act_ref` NULL, `valid_from` 2026-10-05, **239 regras / 95 capabilities**. É a única efetiva hoje.
- As 10 capabilities usadas por funções/RLS sem concessão em nenhuma política homologada passaram a ser concedidas. Consulta pós-aplicação: **UNGRANTED = nenhuma**.
- Afirmações antigas como "R5 não aplicado", "v4 draft", "aguarda ato real" e "migration 20261004235500 pendente" foram **removidas**. Elas não refletem o estado atual.

## Defeito real corrigido (era fail-closed permanente)
Estas 10 capabilities não estavam em nenhuma política: `administrar-integracoes`, `consultar-banco-de-itens`, `consultar-instrumento-docente`, `consultar-planejamento-docente`, `gerir-base-de-conhecimento`, `gerir-tarefas-operacionais`, `homologar-definicoes-de-workflow`, `manter-definicoes-de-workflow`, `publicar-conteudo-publico`, `revisar-qualidade-dos-dados`.

A v5 acrescenta 26 regras à v4, todas por `engagement_kind_id` e sem curinga:
- Administrador Geral: as 10, `[network]`.
- Gestão Pedagógica da Rede: planejamento, banco de itens, instrumento e publicação pública, `[network]`.
- Direção Escolar: planejamento, banco de itens, instrumento, qualidade dos dados e tarefas, `[school]`.
- Orientação Pedagógica: planejamento, banco de itens, instrumento e tarefas, `[school]`.
- Professor: banco de itens, `[school]`. A autoria própria continua independente dessa capability.
- Secretaria Escolar: tarefas, `[school]`.
- CIECE auditoria/coordenação: qualidade dos dados, `[network]`.

A regra B1.2 recusa capacidade concedida só ao mestre. Workflow, integrações e base de conhecimento ficam **só** no Administrador Geral nesta versão. Por isso a v5 cria `sigem_master_reserved_capabilities`, uma reserva explícita, append-only e registrada como decisão do proprietário. A cobertura passa a aceitar apenas essas reservas declaradas. Não houve afrouxamento genérico.

Validações feitas dentro da própria migration (qualquer falha desfaz tudo):
- delta de 26 regras, total 239, 95 capabilities e nenhuma duplicata;
- zero curinga e nenhuma perda de regra da v4;
- `capability_policy_homologation_issues` sem problemas, o que inclui a cobertura do Administrador Geral.

Teste estático: `policy-v5.test.ts`.

**Limite técnico observado:** `effective_scope_capabilities` só considera atuações de nível escola/rede. Uma atuação de professor por turma não recebe a regra `[school]`. A autoria docente não depende dessa regra.

## Separação do resultado

### A) Bloqueador técnico do software
**Nenhum.**
- Suíte completa: 3.354/3.354 passaram (252 arquivos), executada depois da correção de acessibilidade.
- Testes focais da v5 e invariantes: 49/49 passaram.
- `tsgo --noEmit -p .`: limpo.
- `build`: OK.
- `check:migrations`: OK.
- `audit-sql-security`: 0 funções DEFINER sem `search_path`.
- `audit:curriculum-source`: OK (5 anexos, 22 posições).
- `git diff --check`: limpo.

### B) Pré-requisito operacional do piloto
- A Cloud tem hoje 2 usuários, 2 pessoas e 2 atuações, todos reais: Administrador Geral e `autoridade-calendario-da-rede` (Supervisão Escolar).
- Cadastrar as pessoas reais de Secretaria, Direção, Docente e Orientação, com suas atuações, faz parte do **onboarding do piloto**. Isso acontece pela Central de Administração quando os dados forem fornecidos. Nenhuma conta foi inventada.
- **Não existe nenhuma atuação `gestao-pedagogica-da-rede`.** As competências curriculares R5 e as novas consultas pedagógicas de rede ficam fechadas até essa atuação ser configurada. A identidade da Supervisão não foi alterada. Isso é uma pendência operacional, não uma falha do R5.

### C) Resiliência e infraestrutura
- Restauração de backup: não foi executada. Este ambiente proíbe dump completo do banco, e restaurar a produção no lugar está vetado.
- O caminho real é "Restore to a New Project", que pode ter custo e é feito pela plataforma. Ele é um exercício operacional externo ao código.
- Procedimento previsto: restaurar em um projeto novo, rodar `check:migrations`, comparar as contagens de `capability_policies`, `capability_policy_rules`, `institutional_*` e ledgers, e verificar os SHA-256 de `school_document_emissions`.

## Security Advisor (revisão por família)
Antes: 297 (241 no relatório anterior, com outra base). Depois: **296**.

| Família | Qtde | Explorabilidade | Mitigação | Severidade real | Ação |
|---|---|---|---|---|---|
| RLS ativo sem policy | 67 | Nenhuma: as 67 tabelas têm **0 GRANT** para anon/authenticated (negado por padrão) e são acessadas só por funções DEFINER | Writers e readers com gate | Informativa | Nenhuma |
| DEFINER executável por anon | 3 | Intencional: `public_portal_list`, `public_portal_get`, `verify_school_document` devolvem só campos públicos | Allowlist e verificação sem id técnico | Aceito por desenho | Nenhuma |
| DEFINER por authenticated: gate de capability | 142 | Recusam sem capability efetiva | `has_*_capability`/`*_grant` | Baixa | Nenhuma |
| … gate pela própria pessoa | 51 | Limitadas a `auth.uid()`/`current_person_id()` | Escopo próprio | Baixa | Nenhuma |
| … writers sem gate visível | 5 | Falso positivo: delegam a `r5_record_homologation`/writer de 11 argumentos, que têm gate | Gate no delegado | Baixa | Nenhuma |
| … readers sem gate textual | 29 | Exigem gate interno (`inclusion_require`, `integration_require_admin`) ou devolvem dado normativo homologado ou contexto público | Revisados um a um | Baixa | 1 corrigido |
| `operational_task_assignee` | 1 | Mostrava a quem a tarefa foi atribuída, a partir do id | — | Baixa | **Revogado** (`0097`). Uso só interno em DEFINER |

## Conclusão
**PRONTO PARA PILOTO COM CAMADAS AVANÇADAS DESABILITÁVEIS.**

Não resta bloqueador técnico (A). O piloto com pessoas reais depende do cadastro das atuações reais (B), inclusive a de Gestão Pedagógica da Rede. O exercício de restauração (C) é um gate operacional da plataforma.
