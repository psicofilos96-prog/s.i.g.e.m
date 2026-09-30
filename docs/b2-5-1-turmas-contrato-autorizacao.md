# B2.5.1 — Contrato e autorização de Turmas

Decisão institucional de 30/09/2026. Esta microetapa formaliza o domínio e acrescenta duas capacidades à v2 **em rascunho**. Não cria nem altera turma, ano, organização, período, catálogo, matrícula, grade ou Calendário. A B2.5.2 ainda não começou.

## Competência separada

| Capacidade | Atuação | Alcance | Operações futuras |
| --- | --- | --- | --- |
| `manter-cadastro-de-turmas` | `secretaria-escolar` | `[school]` | Criar turma, registrar versões cadastrais e alterar seu estado administrativo na própria escola. |
| `manter-organizacao-de-periodos-da-turma` | `secretaria-escolar` | `[school]` | Declarar e corrigir exclusivamente o vínculo temporal da turma com uma Organização de Períodos Letivos da própria vigência/ano. |

Uma capacidade não concede a outra. A segunda não permite criar, alterar ou homologar ano, organização ou período da rede. A leitura existente de `institutional_classes` por atuação escolar dispensa uma capacidade genérica `consultar-turma` nesta microetapa. O contrato de autorização `class_registry_school_grant` exige atuação vigente `secretaria-escolar` com `scope_level = escola`, `school_id` idêntico ao da turma e regra `[school]` em política homologada. Ele não usa o fallback de rede do helper escolar genérico. Enquanto v1 e v2 estiverem em `draft`, nenhuma dessas capacidades é efetiva.

## Identidade e versões

`institutional_classes.id` permanece a identidade permanente. Escola e ano letivo compõem seu contexto estrutural: outra escola ou outro ano requer outro `classId`. Uma versão cadastral não muda esses dois vínculos. Um cadastro incorreto permanece auditável, torna-se não operacional pelo rito próprio e a turma correta recebe novo ID. Atuações, enturmações e outras dependências não são transferidas automaticamente.

`ativa` e `inativa` são os únicos estados administrativos da B2.5. Inativação e reativação acrescentam versões imutáveis. `valid_until` representa término da vigência, não o estado `inativa`. Código, nome e estado devem integrar uma cadeia cadastral por turma, com versão, base substituída, início/fim de vigência, motivo, ato, usuário, pessoa, atuação e `created_at` real. A persistência dessa cadeia pertence à B2.5.2.

## Classificação, vínculo e temporalidade

Oferta/classificação e turno são somente consumidos de `class_offering_versions`, `class_offering_axis_values`, `class_shift_versions` e valores homologados do catálogo. Administração de catálogos e Classificação da Oferta: B2.6. Sem valor obrigatório aplicável, a operação fica indisponível; nomes como etapa, modalidade, ano/fase e turno não são padrões de código.

O vínculo Turma → Organização é explícito em `institutional_class_period_organization_versions`; sua escrita pertence à etapa posterior da B2.5. A organização deve pertencer ao mesmo ano da turma, e no máximo uma pode valer para a mesma turma/data. Não se infere a escolha por oferta, etapa, modalidade, nome ou Calendário. Uma versão futura não oculta conflito anterior. Correção sempre acrescenta uma versão com motivo, ato e autoria; fatos históricos não sofrem `UPDATE` ou `DELETE`.

Há duas consultas conceitualmente diferentes: a verdade institucional **atualmente reconhecida para a data D** e o que o SIGEM **conhecia no instante T**. `valid_from`/`valid_until` exprimem a primeira dimensão; `created_at` real e a cadeia `supersedes_id` preservam a segunda. Uma retificação retroativa pode mudar a primeira resposta sem reescrever a resposta histórica para T. A B2.5.2 deve preservar ambas; a B2.5.1 não cria leitor ou interface para elas.

## Fronteiras e pendências documentadas

B3 mantém matrícula/enturmação; B4 mantém grade, matriz, horários e Calendário; B2.6 mantém catálogos/Classificação da Oferta; B2.7 fará a reconciliação geral das telas demonstrativas. Nenhum módulo congelado é reaberto nesta microetapa. Permanecem documentados os resíduos do Diário/6D apontados na auditoria B2.5: turno `Manhã` e agrupamento fabricado em `institutional-teaching.ts`, etapa consultada em `classStage` por ID de fixture, e períodos do parecer descritivo derivados de laboratório. Seu tratamento exige escopo posterior específico, sem refatoração geral agora.

Para iniciar B2.5.2, falta apenas implementar a cadeia cadastral e sua escrita autorizada conforme este contrato. A política v2 continua em rascunho; valores de catálogo e dados oficiais para validação operacional são dependências institucionais externas, não motivo para inventar dados.
