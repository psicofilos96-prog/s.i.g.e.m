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

O writer 0613 exige uma **pessoa natural** e preserva `author_user_id` e `author_person_id`. Nas contas humanas comuns a pessoa continua resolvida por `user_person_links`. A migração **0615 (somente na branch)** acrescenta outra via **exclusiva dos postos funcionais**, em `followup_seat_assignments` e `followup_seat_revocations`: exige ato administrativo, política homologada, sessão criada após a designação e pessoa natural. **É proibido ligar essas contas a `user_person_links` ou a `institutional_sector_principals`.**

Portanto, **os postos de escrita não podem ser ativados apontando para pessoa institucional fictícia ou genérica**. Antes de cada ativação ou substituição é necessário formalizar quem está autorizado a ocupar aquele posto; o nome da pessoa não precisa compor o endereço do login. A substituição não pode alterar autores de visitas históricas.

## Ciclo seguro de implantação

1. **Pré-cadastro e confirmação administrativa do identificador — CONCLUÍDOS:** as três identidades foram criadas pela API Auth Admin oficial, sem fornecer senha, sem convite e sem capacidades; os identificadores foram confirmados administrativamente em 06/11/2026, como previsto para o domínio sem caixa postal. Unicidade, confirmação e ausência de vínculos verificadas. Nenhum login operacional foi ativado.
2. **Antes da ativação:** instalar e validar as migrações 0613, 0614 e 0615, em ordem, no banco institucional, com backup/plano de reversão; fazer o aceite expresso da política de capacidades e das duas designações vigentes; não conceder poderes por `app_metadata`.
3. **Vinculação do posto:** associar cada conta de escrita a uma única **pessoa natural designada**, com ato, início de validade e política homologada; evitar pessoa fictícia. A conta do Gabinete é de leitura e requer um sujeito institucional autorizado, conforme políticas canônicas.
4. **Credencial:** usar mecanismo seguro de ativação individual, sem senha em planilhas, GitHub ou conversa; verificar acesso ao endereço institucional antes de solicitar recuperação. Recomenda-se autenticação individual e MFA sempre que suportados.
5. **Substituição:** primeiro revogar sessões/refresh tokens e retirar acesso do ocupante anterior; rotacionar credenciais; registrar a troca com rastreabilidade; vincular o novo ocupante e nova atuação. A migração 0615 modela os ocupantes como eventos append-only (`followup_seat_assignments`/`followup_seat_revocations`), sem alterar `user_person_links`. A revogação retira a permissão do posto imediatamente no servidor; a nova designação só aceita uma sessão Auth criada depois do ato. Credenciais e sessões antigas ainda devem ser rotacionadas/revogadas administrativamente.
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
- Contas funcionais não podem ser vinculadas pelo processo genérico `link_institutional_account`, mesmo que o servidor tenha um login individual. A 0615 conserva o cadastro pessoal original e a atribuição ao posto em tabelas separadas, sem copiar seus demais poderes.
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

**Proteções de base propostas na branch (0614 e 0615; nenhuma instalada em produção):** `drizzle/migrations/0614_followup_functional_seat_session_guard.sql` faz o leitor/escritor verificar a sessão real em `auth.sessions` e exige que `created_at` seja posterior à inserção do vínculo. O trigger `followup_functional_seat_link_guard` recusa `UPDATE` direto do vínculo funcional e impede forjar `created_at` no novo `INSERT`. A prova `supabase/tests/0614_followup_functional_seat_sessions.sql` usa transação revertida em PostgreSQL descartável: JWT antigo é recusado, nova sessão após o vínculo é aceita, histórico antigo mantém a autoria. A 0615 **substitui o vínculo genérico por designações exclusivas do acompanhamento**, com RPCs administrativas de designação e revogação, sem conceder capacidades automaticamente nem expor a tabela. A pessoa designada só recebe o verbo de acompanhamento que uma política homologada já autorizar; o Gabinete jamais recebe escrita. A 0615 também exige autoria por pessoa natural nas retificações, inclusive quando o mesmo Auth ID é reutilizado. **Ainda falta homologação completa em CI e clone, entrega/rotação de credenciais e interface administrativa de gestão de ocupantes.**

**Decisão:** confirmações do Auth e CI verde são pré-requisitos, não uma autorização para ativar os postos. A designação/revogação segregada existe como código na branch, mas sua implantação, aceite institucional, interface administrativa, política homologada, teste integral e rotação segura de credenciais permanecem pendentes. **Os três logins continuam sem vínculos e sem capacidades em produção.**

## Estado da proposta segregada — 0615

A migração `0615_followup_functional_seat_segregation.sql` acrescenta dois registros append-only separados: a **designação** com referência ao ato, conta Auth e pessoa natural, e a **revogação** com motivo e operador. As RPCs administrativas verificam capacidades canônicas de manutenção de contas e atuações; as tabelas não ficam consultáveis pelo navegador. Nenhum operador é designado automaticamente. O vínculo em `user_person_links` e o principal setorial são bloqueados para os logins funcionais, preservando a separação dos demais módulos.

A RPC `followup_seat_authority` devolve à aplicação somente capacidades de acompanhamento autorizadas pela política vigente. Ela não revela nenhum dado sem sessão Auth válida iniciada **após** a designação. O `session-authority.ts` usa essa fonte exclusivamente para os logins funcionais, sem incorporar as capacidades gerais da pessoa. Os autores de visitas continuam identificados por `author_person_id`, e o trigger `followup_seat_visit_correction_guard` impede que um novo responsável retifique a visita de um ocupante anterior apenas porque a conta Auth é a mesma.

**Validação técnica concluída em 06/11/2026:** CI integral no commit `ddeb4765` com os quatro jobs aprovados (`required`, `followup-sql`, `followup-contract`, `deep`). A 0615 também foi aplicada **somente no clone integral** `nyupdcodzfmwkpxpourt`, depois de pré-checagem de esquema. Auditoria pós-aplicação confirmou RLS sem políticas públicas, ausência de grants de clientes nas duas tabelas, SQL SECURITY DEFINER com `search_path` vazio, RPCs restritas a autenticados, gatilhos e preservação das funções 0613/0614. As tabelas de designação e revogação ficaram vazias e nenhum usuário Auth novo foi criado. **Não houve E2E autenticado da 0615 com ocupante de posto real**, nem aceite institucional. A gestão de senhas, entrega de credenciais, a designação por ato, a avaliação visual final e um procedimento seguro de rotação de credenciais continuam pendentes. A versão publicada não recebeu a 0613, 0614 ou 0615.


### Ressalvas da homologação 0615 no clone

O Lovable Cloud gravou uma cópia do SQL 0615 sem a quebra de linha final. A comparação textual mostrou **apenas** essa diferença em relação ao arquivo com SHA-256 congelado no GitHub; o conteúdo SQL executado é o mesmo. O papel interno `sandbox_exec` do ambiente de teste possui grants adicionais para administrar a base, mas `anon`, `authenticated` e `service_role` não têm acesso direto às tabelas. A página `/acompanhamento-unidades` ainda não foi ensaiada com uma conta funcional real após a 0615: o clone não possui usuários Auth ativos nem designações de posto. O frontend passa explicitamente o dia de São Paulo à RPC `followup_seat_authority`; o default `CURRENT_DATE` da função é uma divergência de UTC a revisar antes de publicar, para evitar resultados diferentes se o argumento for omitido.
