# Contas funcionais do acompanhamento escolar — desenho e ativação

**Classe documental: Referência vigente.** Identidades funcionais pendentes; ativação sujeita a autorização institucional.

**Estado verificado em 06/11/2026:** as três identidades foram pré-cadastradas **no Auth do SIGEM publicado**, via API oficial Auth Admin, no Cloud `crfqhyqkujhhlbiyhdbc`. Cada endereço existe exatamente uma vez, **com login confirmado administrativamente em 06/11/2026**, sem convite, sem login anterior, sem `user_person_links`, sem principal setorial e com `app_metadata.sigem_account='followup-functional-pending'`. Nenhuma senha foi fornecida na criação; o serviço preencheu o campo interno de senha criptografada, portanto não se deve afirmar inatividade absoluta. **Não** foram concedidas capacidades, entregues senhas nem enviados e-mails; a migração 0613 ainda não foi instalada na produção.

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

1. **Pré-cadastro e confirmação administrativa do identificador — CONCLUÍDOS:** as três identidades foram criadas pela API Auth Admin oficial, sem fornecer senha, sem convite e sem capacidades; os identificadores foram confirmados administrativamente em 06/11/2026, como previsto para o domínio sem caixa postal. Unicidade, confirmação e ausência de vínculos verificadas. Nenhum login operacional foi ativado.
2. **Antes da ativação:** instalar e validar a migração 0613 no banco institucional, com backup/plano de reversão; fazer o aceite expresso da política de capacidades e das duas designações vigentes; não conceder poderes por `app_metadata`.
3. **Vinculação do posto:** associar cada conta de escrita a uma única **pessoa natural designada**, com ato, início de validade e política homologada; evitar pessoa fictícia. A conta do Gabinete é de leitura e requer um sujeito institucional autorizado, conforme políticas canônicas.
4. **Credencial:** usar mecanismo seguro de ativação individual, sem senha em planilhas, GitHub ou conversa; verificar acesso ao endereço institucional antes de solicitar recuperação. Recomenda-se autenticação individual e MFA sempre que suportados.
5. **Substituição:** primeiro revogar sessões/refresh tokens e retirar acesso do ocupante anterior; rotacionar credenciais; registrar a troca com rastreabilidade; vincular o novo ocupante e nova atuação. O `user_person_links` atual é ligação **corrente** e `link_institutional_account` só insere; não se deve fazer um UPDATE administrativo sem trilha. Antes de operacionalizar a troca, disponibilizar fluxo governado de reatribuição que preserve o histórico de designações e de autoria.
6. **Conferência após a troca:** testar login do novo operador, negação do antigo, registro de autoria sob a nova pessoa, Gabinete somente leitura e ausência de vazamento entre sessões.

## Impedimento atual

No SIGEM publicado o módulo do PR #7 ainda não está instalado: suas quatro tabelas e treze funções são exclusivas da homologação até o momento. Criar contas não instala a migração, não confere direito de registro e não autoriza merge/deploy. A etapa de ativação exige autorização institucional separada.

## Segurança operacional

Evitar compartilhar uma única senha entre servidores: isso impede atribuir com confiança a autoria à pessoa física realmente operante. Se os endereços genéricos forem usados, tratá-los como postos com apenas um responsável autorizado por vez, troca de titular acompanhada de revogação de sessões e procedimento auditável de reatribuição.
## Convenção institucional de login e DNS (verificação de 06/11/2026)

Os endereços `@sigem.itap.gov.br` são identificadores de login no Auth, **não caixas postais**, conforme decisão canônica já registrada em `docs/sigem-contas-padrao.md` (04/10/2026). A verificação DNS pública pelo runtime do Lovable retornou `ENOTFOUND` para `sigem.itap.gov.br` e para `itap.gov.br`: não há MX público acessível. Não se deve enviar senha, convite, link de confirmação nem recuperação de credencial para esses identificadores. O domínio `itaperuna.rj.gov.br` apresentou MX, mas isso não prova que exista qualquer uma das caixas pretendidas; **não migrar os três logins para esse domínio sem decisão administrativa**.

A confirmação de identidade do Auth, **já executada para as três contas em 06/11/2026**, é uma operação **administrativa de login** por `auth.admin.updateUserById(id, { email_confirm: true })`, conforme o fluxo já adotado pelo SIGEM para contas que não são caixas postais. Ela não deve criar vínculo, política nem capacidade, e não equivale à identificação de quem opera a conta. A credencial será entregue uma única vez por administração autorizada, pelo fluxo de redefinição e sem exposição em GitHub, chat ou arquivo compartilhado.

## Critérios para ativação operacional — bloquear por padrão

- O PR #7 e a migration 0613 ainda precisam de implantação e aceite próprios. Sem funções e catálogo do módulo no banco publicado, **nenhuma conta pode executar acompanhamento**.
- O Gabinete deve receber somente `consultar-acompanhamento-institucional`, por política homologada. O perfil de Gabinete não pode criar, alterar ou retificar visitas.
- Cada conta `acomp1`/`acomp2` requer pessoa física responsável **no momento de cada registro**, capacidade homologada e escopo autorizados. Não vincular a uma identidade fictícia ou genérica. O nome da pessoa não precisa constar do identificador de login.
- `link_institutional_account` recusa pessoas já ligadas a uma conta; não reutilizar um comando SQL administrativo que contorne esse controle. Um responsável que já tenha login individual exige fluxo governado específico.
- Na troca de ocupante, a possibilidade de usar JWT antigo persiste até expiração mesmo após revogar refresh tokens; é necessário invalidar a autorização antiga **no servidor** antes de alterar o vínculo corrente. O log imutável `author_person_id` de cada visita deve permanecer inalterado.
- O pré-cadastro e a verificação de estado são auditáveis com `node scripts/followup-functional-seats-preflight.mjs` no runtime seguro, com `SIGEM_FOLLOWUP_EXPECTED_BACKEND` definido e chaves administrativas somente no servidor. Esse comando **não grava dados**, não libera acesso e rejeita backend incorreto. A confirmação administrativa do e-mail, se houver, aparecerá como `CONFIRMADO_SEM_VINCULO`, nunca como permissão de uso.

**Decisão arquitetural de segurança:** contas genéricas não devem ser senhas coletivas nem representar vários operadores simultâneos. Para manter endereços fixos com a rotatividade pretendida, o mecanismo de troca de responsável deve registrar início, término, ato e autoridade da designação; invalidar as sessões anteriores; e preservar as autorias antigas sem as atribuir retroativamente ao novo responsável.

## Provas de rotatividade e revogação no clone integral (06/11/2026)

A rodada foi executada exclusivamente no projeto de homologação `f17b6abd-c100-4603-bb6b-2fec9aa47dda`, backend `nyupdcodzfmwkpxpourt` (não é a produção). O clone mantém dados exclusivamente sintéticos. As operações de teste de troca de vínculo foram envolvidas em transação com **ROLLBACK**.

**Achado P0 de segurança confirmado:** o SQL canônico `current_person_id()` lê `user_person_links` a cada requisição. O teste demonstrou que, ao alterar `user_person_links.person_id` de servidor A para servidor B mantendo o **mesmo JWT antigo**, a conta passou a acessar a escola B e perdeu o acesso à A. Logo, não basta rotacionar senha ou sessão de refresh para afirmar que o responsável antigo perdeu imediatamente o poder de atuar como outro servidor.

**Condições de NO-GO da ativação dos três logins:**

1. **Proibir reatribuição simples de `user_person_links.person_id`.** A troca exige protocolo auditado com pessoa anterior e nova, início, ato e operador responsável, sem alterar `author_person_id` das visitas históricas.
2. **Invalidar tokens anteriores no próprio servidor.** Antes de liberar a conta para um novo ocupante, cada writer e reader da área precisa conferir que `auth.jwt()->>'session_id'` é uma sessão efetiva e que `auth.sessions.created_at` não antecede o início aprovado da nova ocupação. **Não usar somente `iat`**: um refresh de JWT da sessão antiga não representa uma nova autenticação.
3. **Revalidar autoridade em outras áreas.** Vincular o mesmo `auth.user.id` a uma pessoa que já tenha atuações escolares pode fazer o login funcional herdar **outras capabilities** por `effective_scope_capabilities`. A vedação não pode existir apenas no menu: deve atuar também nas RPCs e RLS dos outros módulos, ou o desenho deve preferir autenticação pessoal com delegação do posto. Ainda **não foi demonstrado** isolamento global seguro para essas três contas.
4. **Proteger a entrega de credenciais:** fazer a troca fora do chat e do GitHub, revogar sessões, trocar o segredo e exigir nova autenticação. Nenhuma conta de setor pode ter dois responsáveis usando a mesma senha simultaneamente.
5. **Homologar em clone:** provar com dois navegadores/sessões que o JWT antigo recebe negação de leitura e de escrita **antes de expirar**, e o novo JWT só pode atuar no escopo autorizado, com a autoria individual correta e sem adquirir outras capacidades.

**Revogação durante a sessão — PASS para os escritores do módulo:** uma versão sintética de política sem capabilities foi homologada no clone enquanto a ficha da Escola A permanecia aberta. A RPC recusou nova gravação e leitura; após atualizar, o navegador ocultou os dados e o botão de salvar; o recarregamento exibiu acesso negado. Nenhuma visita do ensaio foi gravada. A interface inicialmente mostrou erro técnico genérico; foi adicionada tradução de `followup:recording-denied` e `followup:read-denied` na branch do PR, ainda sujeita à CI.

**Zoom nativo de navegador a 200% — validação parcial:** foi aplicada escala 2 no Chromium; o layout medido não produziu overflow horizontal da página, e o botão de salvar foi alcançado por Tab. As capturas visuais ficaram incompletas; a região da tabela rolável não recebia foco. Foi acrescentado `tabIndex={0}` com papel e rótulo de região no PR, ainda sujeito a testes de acessibilidade com navegador visível.

**Estado do clone após ensaio:** conta Auth temporária excluída; permanecem exclusivamente pessoas, escolas, vínculos órfãos e versões da política **sintéticos de teste**, não copiados nem aplicados na produção. As políticas de teste usadas tinham validade até 06/11/2026.

**Proteção de base adicionada à branch (0614; ainda não instalada em produção):** `drizzle/migrations/0614_followup_functional_seat_session_guard.sql` faz o leitor/escritor verificar a sessão real em `auth.sessions` e exige que `created_at` seja posterior à inserção do vínculo. O trigger `followup_functional_seat_link_guard` recusa `UPDATE` direto do vínculo funcional e impede forjar `created_at` no novo `INSERT`. A prova `supabase/tests/0614_followup_functional_seat_sessions.sql` usa transação revertida em PostgreSQL descartável: JWT antigo é recusado, nova sessão após o vínculo é aceita, histórico antigo mantém a autoria. O fluxo oficial de transferência com trilha, revogação e controle transversal de outras capacidades **não foi implementado**. CI da 0614 pendente de validação nesta revisão.

**Decisão:** confirmações do Auth e CI verde são pré-requisitos, não uma autorização para ativar os postos. A **troca segura do responsável ainda não está integralmente implementada**; não prometer que a conta funcional possa ser compartilhada ou transferida com segurança até fechar o controle transversal e o processo governado.
