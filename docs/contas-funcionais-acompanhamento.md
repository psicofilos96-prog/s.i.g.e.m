# Contas funcionais do acompanhamento escolar — desenho e ativação

**Classe documental: Referência vigente.** Identidades funcionais pendentes; ativação sujeita a autorização institucional.

**Estado verificado em 06/11/2026:** as três identidades foram pré-cadastradas **no Auth do SIGEM publicado**, via API oficial Auth Admin, no Cloud `crfqhyqkujhhlbiyhdbc`. Cada endereço existe exatamente uma vez, com e-mail não confirmado, sem convite, sem login anterior, sem `user_person_links`, sem principal setorial e com `app_metadata.sigem_account='followup-functional-pending'`. Nenhuma senha foi fornecida na criação; o serviço preencheu o campo interno de senha criptografada, portanto não se deve afirmar inatividade absoluta. **Não** foram concedidas capacidades; a migração 0613 ainda não foi instalada na produção.

## Três endereços estáveis solicitados

| Identificador de acesso | Área | Capacidade-alvo | Escopo institucional-alvo |
| --- | --- | --- | --- |
| `acomp1@sigem.itap.gov.br` | Acompanhamento — posto 1 | `registrar-acompanhamento-institucional` | Rede escolar municipal, se a designação administrativa aprovar |
| `acomp2@sigem.itap.gov.br` | Acompanhamento — posto 2 | `registrar-acompanhamento-institucional` | Rede escolar municipal, se a designação administrativa aprovar |
| `gab@sigem.itap.gov.br` | Gabinete | `consultar-acompanhamento-institucional` | Rede municipal, estritamente leitura |

Esses e-mails são identificadores **estáveis de postos**, não nomes de pessoas. Nenhum outro perfil do SIGEM deve herdar capacidades por mera correspondência de e-mail ou metadados de Auth. Gabinete não recebe escrita, correção ou administração de política.

## Regra de autoria que não pode ser contornada

A migração 0613 usa `school_institutional_followup_person`: para registrar, exige `auth.uid()`, capacidade homologada na escola e `user_person_links.person_id` apontando para `institutional_persons.actor_nature = 'pessoa-natural'`. Os fatos mantêm `author_user_id` e `author_person_id`.

Portanto, **os postos de escrita não podem ser ativados apontando para pessoa institucional fictícia ou genérica**. Antes de cada ativação ou substituição é necessário formalizar quem está autorizado a ocupar aquele posto; o nome da pessoa não precisa compor o endereço do login. A substituição não pode alterar autores de visitas históricas.

## Ciclo seguro de implantação

1. **Pré-cadastro no Auth — CONCLUÍDO:** as três identidades foram criadas pela API Auth Admin oficial, sem fornecer senha, sem convite e sem capacidades; unicidade, não confirmação e ausência de vínculo confirmadas. Nenhum login operacional foi ativado.
2. **Antes da ativação:** instalar e validar a migração 0613 no banco institucional, com backup/plano de reversão; fazer o aceite expresso da política de capacidades e das duas designações vigentes; não conceder poderes por `app_metadata`.
3. **Vinculação do posto:** associar cada conta de escrita a uma única **pessoa natural designada**, com ato, início de validade e política homologada; evitar pessoa fictícia. A conta do Gabinete é de leitura e requer um sujeito institucional autorizado, conforme políticas canônicas.
4. **Credencial:** usar mecanismo seguro de ativação individual, sem senha em planilhas, GitHub ou conversa; verificar acesso ao endereço institucional antes de solicitar recuperação. Recomenda-se autenticação individual e MFA sempre que suportados.
5. **Substituição:** primeiro revogar sessões/refresh tokens e retirar acesso do ocupante anterior; rotacionar credenciais; registrar a troca com rastreabilidade; vincular o novo ocupante e nova atuação. O `user_person_links` atual é ligação **corrente** e `link_institutional_account` só insere; não se deve fazer um UPDATE administrativo sem trilha. Antes de operacionalizar a troca, disponibilizar fluxo governado de reatribuição que preserve o histórico de designações e de autoria.
6. **Conferência após a troca:** testar login do novo operador, negação do antigo, registro de autoria sob a nova pessoa, Gabinete somente leitura e ausência de vazamento entre sessões.

## Impedimento atual

No SIGEM publicado o módulo do PR #7 ainda não está instalado: suas quatro tabelas e treze funções são exclusivas da homologação até o momento. Criar contas não instala a migração, não confere direito de registro e não autoriza merge/deploy. A etapa de ativação exige autorização institucional separada.

## Segurança operacional

Evitar compartilhar uma única senha entre servidores: isso impede atribuir com confiança a autoria à pessoa física realmente operante. Se os endereços genéricos forem usados, tratá-los como postos com apenas um responsável autorizado por vez, troca de titular acompanhada de revogação de sessões e procedimento auditável de reatribuição.