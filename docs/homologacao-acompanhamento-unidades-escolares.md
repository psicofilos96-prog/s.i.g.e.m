# Homologação — Acompanhamento institucional das unidades escolares

**Módulo:** `/acompanhamento-unidades` · **PR:** #7 · **Estado:** implementação em revisão, sem implantação no banco institucional.

## 1. Evidências já obtidas (não substituem homologação)

O GitHub Actions executa em cada revisão:

- `required`: integridade das migrations, TypeScript, testes e build;
- `deep`: suíte de testes aprofundados;
- `followup-sql`: PostgreSQL 17 descartável, esquema mínimo de teste, migration `0613` e provas SQL negativas/positivas (inclusive segregação entre dois visitantes simulados).
- `followup-contract`: job rápido e paralelo que executa somente os testes Vitest do módulo `school-institutional-followup`; erros de contrato, histórico, UI e exportação ficam visíveis antes da conclusão da suíte geral. A execução rápida não substitui `required` nem `deep`.

A prova PostgreSQL verifica escrita por servidor natural, leitura de rede pelo Gabinete, isolamento entre escolas, retificação append-only, autoria, datas, idempotência, transação atômica e limites explícitos de volume. O ensaio `0613_followup_two_visitors.sql` usa **dois servidores sintéticos distintos**, com gravação limitada respectivamente às escolas A e B; confirma autoria persistida, bloqueio de leituras/escritas/evoluções cruzadas, panorama filtrado e leitura das duas escolas pelo Gabinete sem capacidade de registrar. O mesmo ensaio revoga a capability sintética do segundo servidor depois das primeiras operações e comprova, **na sessão já autenticada**, que novas leituras e gravações pela RPC deixam de funcionar, enquanto a unidade A e o histórico consultável pelo Gabinete permanecem intactos. Um teste adicional verifica que **identidade de órgão/setor não pode registrar visita**, ainda que a política lhe conceda capacidade de escrita. A fixture não reproduz todas as migrations do SIGEM; portanto, **CI verde não valida compatibilidade com o esquema institucional completo**.

## 2. Pré-requisitos para homologação em ambiente isolado

1. Obter **clone/restauração isolada** do esquema integral do SIGEM, com dados minimizados ou sintéticos; nunca testar com escrita em produção.
2. Executar o manifesto de migrations na ordem prevista pelo projeto até a anterior à `0613`; conferir o hash da `0613` e aplicar a migration apenas no clone.
3. Conferir que os objetos preexistentes têm as assinaturas esperadas: `institutional_schools(id)`, `institutional_school_identifiers(school_id, identifier_kind, value)`, `institutional_school_record_versions(school_id, version_number, official_name)`, `institutional_persons(id, display_name, actor_nature)`, `user_person_links(user_id, person_id)`, `sigem_capability_catalog(capability_id, origin)` e `effective_scope_capabilities(date)`.
4. Aplicar as provas em `supabase/tests/0613_school_institutional_followup.sql` e `supabase/tests/0613_followup_isolated_positive.sql` **somente em ambiente de teste configurado para isso**. A prova positiva depende de fixtures específicas; ela não deve ser executada diretamente no banco oficial.
5. Verificar que o Data API expõe apenas as RPCs de acesso controlado; tabelas não possuem acesso direto de `anon`, `authenticated` ou `service_role`. Revisar as funções `SECURITY DEFINER` e `auth.uid()`.

### Pré-checagem somente leitura (executar como administrador no clone)

```sql
SELECT obj, to_regclass('public.' || obj) IS NOT NULL AS existe
FROM (VALUES
  ('sigem_capability_catalog'),
  ('institutional_schools'),
  ('institutional_school_identifiers'),
  ('institutional_school_record_versions'),
  ('institutional_persons'),
  ('user_person_links')
) AS t(obj);
SELECT to_regprocedure('public.effective_scope_capabilities(date)') IS NOT NULL
  AS capacidade_efetiva_disponivel;
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('institutional_schools', 'institutional_school_identifiers',
    'institutional_school_record_versions', 'institutional_persons',
    'user_person_links', 'sigem_capability_catalog')
ORDER BY table_name, ordinal_position;
```

Se faltar qualquer dependência, **interromper**: não improvisar grants, políticas ou migrações na base oficial.

### Verificações SQL somente leitura para o clone (adição de 04/11/2026)

Foram acrescentados dois arquivos de pré/pós-verificação no repositório:

- `supabase/tests/0613_followup_clone_preflight_readonly.sql` — rodar no **clone antes de aplicar 0613**. Verifica a presença e os tipos das colunas canônicas, assinaturas de `auth.uid()` e `effective_scope_capabilities(date)`, papéis e funções necessárias; também detecta objetos de 0613 já existentes e INEP duplicado por escola.
- `supabase/tests/0613_followup_clone_postflight_readonly.sql` — rodar no **clone depois de aplicar 0613**. Confere quatro tabelas privadas com RLS, negação de DML/SELECT aos papéis cliente, RPCs abertas exclusivamente a `authenticated`, funções auxiliares privadas, `SECURITY DEFINER` e **`search_path` estritamente vazio em todas as funções da migration** (não basta estar configurado; `public` ou `"$user", public` são recusados). A função de imutabilidade deve permanecer `SECURITY INVOKER`. Confere também **os quatro gatilhos de imutabilidade** de visitas, medidas, evoluções e ledger de bundles: devem existir, estar habilitados para operações normais, ser `BEFORE UPDATE OR DELETE` por linha e apontar para a função de imutabilidade canônica.

O pré-check também exige índices ou constraints únicos válidos para **(escola, tipo de identificador)**, **(tipo de identificador, valor)** em toda a rede, **(escola, versão cadastral)**, **usuário vinculado à pessoa** e **ID da pessoa**. A segunda chave é a prevista na migration histórica do cadastro escolar e impede que o mesmo INEP seja associado a escolas distintas. Ele rejeita a ausência da unicidade mesmo que os registros existentes não estejam duplicados. O CI retira temporariamente **as duas chaves únicas do cadastro de identificadores, uma por vez**, confirma cada rejeição pela causa correta e recria a respectiva chave antes dos testes positivos.

O **pós-check** também exige exatamente as 13 assinaturas de funções previstas na migration 0613 (quatro auxiliares privadas, cinco leitores e quatro escritores); os testes de assinatura continuam verificando cada função obrigatória, enquanto a contagem da família recusa membros adicionais e **sobrecargas criadas depois da instalação**. As funções não podem pertencer aos papéis cliente `anon`, `authenticated` ou `service_role`: o proprietário de uma função pode alterar sua definição, mesmo sem receber concessões normais de execução. Diferentes nomes de administrador confiável são admitidos no clone. No CI descartável, um overload sintético de `school_institutional_followup_network(integer, integer)` e uma transferência temporária da RPC para o papel `authenticated` devem reprovar o pós-check; a remoção, a restauração do proprietário **e do `GRANT EXECUTE` original** devem devolver a aprovação. Essa reconstituição de grants é necessária porque o PostgreSQL pode ajustar privilégios ao transferir a propriedade; ocorre somente na fixture descartável do CI, não em clone institucional. Essas checagens são complementares, não inspeção do corpo das funções nem prova de que o banco é um clone.

O pré-check agora também interrompe caso encontre **qualquer função já existente das famílias** `school_institutional_followup_*` ou `record_school_institutional_followup_*` (inclusive overloads), ou um dos três nomes de índices usados pela migration 0613. Isso antecipa conflitos de instalação e possíveis RPCs ambíguas. No CI, são criadas colisões sintéticas, verifica-se que o pré-check as rejeita pela causa correta, elas são removidas e somente então a 0613 é aplicada à fixture descartável.

A inspeção estática das migrations históricas do repositório identificou as fontes das tabelas de escola/INEP/versões (migração Supabase `20260929031130_3348d211-7583-485d-94db-42a059e1a09b.sql`), pessoa/vínculo (`20260929005850_39761935-6524-45ac-a91b-3237c9d90f23.sql`), natureza do ator (`0040_b1_institutional_actor_nature.sql`), catálogo de capacidades (`0253_bq1_institutional_authority_matrix.sql`) e a assinatura de `effective_scope_capabilities(date)` (`0306_bo_fixture_meal_operations.sql`). **São evidências de compatibilidade estrutural do código versionado, não prova de que essas versões estão aplicadas ao banco real.**

**Ambos executam dentro de `BEGIN TRANSACTION READ ONLY`, terminam em `ROLLBACK` e não criam contas, não concedem capacidades e não alteram o banco.** Validar previamente o host, nome do banco e isolamento: uma pré-checagem estrutural jamais demonstra que o endpoint aponta para um clone.

#### Executor com bloqueio de endpoints remotos

Para clones **locais**, utilize `scripts/followup-clone-readonly.mjs`, que executa somente o pré ou o pós-check. Ele requer confirmação explícita, bloqueia endereços remotos (inclusive endpoints do Supabase), compara o nome informado com o banco efetivamente conectado e não inclui qualquer opção para aplicar migrations. Segredos ficam apenas nas variáveis de ambiente do processo, nunca nos argumentos enviados ao `psql`.

Exemplo para Windows PowerShell, depois de criar um clone PostgreSQL realmente isolado:

```powershell
$env:SIGEM_CLONE_CONFIRMATION = "CONFIRMO_CLONE_LOCAL_ISOLADO"
$env:SIGEM_CLONE_EXPECTED_DATABASE = "sigem_followup_clone"
$env:SIGEM_CLONE_DATABASE_URL = "postgresql://USUARIO:SENHA@127.0.0.1:54322/sigem_followup_clone"
node scripts/followup-clone-readonly.mjs --pre
# A aplicação da migration 0613, SE APROVADA, é um procedimento manual SEPARADO e exclusivo do clone.
node scripts/followup-clone-readonly.mjs --post
```

Substitua usuário/senha somente em ambiente técnico privado; **nunca publique a URL ou credenciais no GitHub**. Exige-se Node.js e `psql` disponíveis. O runner não cria o clone, não instala a migration e não substitui autorização da gestão técnica. **Localhost também pode apontar para um túnel SSH:** a equipe precisa atestar que não existe túnel, proxy ou redirecionamento para produção. A proteção não é prova criptográfica de isolamento.

Para simular o bloqueio sem qualquer banco, os testes locais são:

```bash
node --test scripts/followup-clone-readonly.test.mjs
```

O CI executa ainda **provas negativas do pós-check** em PostgreSQL descartável: desabilita temporariamente o gatilho de imutabilidade das medidas, verifica a rejeição, restaura-o; remove temporariamente o gatilho do ledger de bundles, verifica a rejeição e recria-o. Também ensaia a troca de `search_path` de uma RPC privilegiada por `public` e a remoção do parâmetro, além da alteração indevida do gatilho canônico para `SECURITY DEFINER`. Cada caso deve falhar por motivo específico; depois as definições originais são restauradas e o pós-check positivo é obrigatório. Nenhuma dessas operações destrutivas é permitida no clone institucional ou em produção: são exclusivamente simulações no serviço descartável do CI.

O GitHub Actions agora usa essas mesmas verificações na fixture mínima, o que testa o roteiro técnico, **mas não fornece o clone institucional nem uma execução no esquema real**. O pós-check não comprova os escopos das pessoas nem o comportamento da UI: a matriz de aceite abaixo permanece obrigatória. Se o pré-check reprovar, parar e analisar diferenças, sem adaptar funções ou alterar permissões em produção.

### Limite do teste com dois servidores simulados

A fixture de CI vincula o Servidor 1 à escola A e o Servidor 2 à escola B por capacidades de teste, em transações descartadas. Isso comprova o comportamento esperado **para aquelas permissões sintéticas**; não valida concessões reais, vínculos de lotação, configuração de autenticação do Supabase nem a política definitiva de quais unidades cada servidor poderá visitar. Antes de implantar, os responsáveis devem registrar o escopo nominal aprovado e realizar a matriz abaixo com sessões reais em um ambiente institucional isolado.

## 3. Matriz de aceitação institucional

| Perfil testado | Acesso à escola própria | Acesso a outras escolas | Registra/retifica/evolui | Exporta |
| --- | --- | --- | --- | --- |
| Servidor 1 (pessoa natural, atribuição escola A) | Sim | Não | Sim, somente onde autorizado | Somente escola A |
| Servidor 2 (pessoa natural, escopo homologado) | Conforme o escopo | Conforme o escopo | Conforme o escopo | Conforme o escopo |
| Gabinete, com capacidade de consulta da rede | Sim | Sim, dentro do escopo | **Não** | Sim, somente dados autorizados |
| Conta sem capacidade | Não | Não | Não | Não |
| Identidade institucional que recebeu capacidade de registro | Leitura conforme autorização | Conforme autorização | **Não** (exige pessoa natural) | Conforme autorização |

As políticas de concessão devem ser homologadas pelos responsáveis institucionais. **Nenhuma capacidade nova é distribuída automaticamente**. A autoria corresponde à pessoa natural autenticada; o campo de participantes é apenas texto declarado, sem assinatura ou delegação.

### Transição de sessão (contas de teste no ambiente isolado)

Além da matriz de capacidades, confirmar na mesma aba do navegador: **servidor A → logout → Gabinete B**, **servidor A → logout → novo login de A** e **alteração do escopo autorizado do servidor A com sessão ativa, seguida de atualização da autoridade pelo cliente**. Ao trocar de identidade, nenhuma ficha, medida, rascunho ou exportação pendente da sessão anterior deve reaparecer; as consultas devem ser realizadas novamente com o escopo da sessão nova. Exportações antigas em conversão não podem produzir download depois da troca. Essa prova visual deve usar apenas escolas e contas fictícias ou devidamente autorizadas no ambiente de homologação. O teste React automatizado correspondente usa `QueryClient` único, contas sintéticas e RPCs mockadas; **não substitui a verificação autenticada das políticas no PostgreSQL isolado**.

## 4. Roteiro funcional para o aceite

- [ ] Uma visita permite registrar objetivo, participantes, diagnóstico, pontos fortes, fragilidades e observações.
- [ ] Um plano permite medidas, responsável declarado e prazo; medidas podem ser adicionadas posteriormente.
- [ ] Antes do salvamento, é possível subir, descer e remover medidas específicas mantendo descrição/responsável/prazo corretos; registros históricos permanecem sem edição destrutiva.
- [ ] Se uma medida possui responsável ou prazo, mas não possui descrição, o formulário mostra erro na linha e bloqueia salvar até corrigir.
- [ ] Se a data da visita é alterada e torna o prazo de uma medida anterior a ela, o erro aparece imediatamente e desaparece após corrigir; linhas totalmente vazias continuam opcionais.
- [ ] Remover uma medida já preenchida exige confirmação explícita e não altera outras linhas; recusar o descarte preserva o texto. Linha vazia pode ser removida sem diálogo.
- [ ] Descartar uma visita ou cancelar uma retificação/medida/evolução com dados exige confirmação; recusar mantém os valores e não grava nada no banco.
- [ ] Usuário com escrita limitada a apenas uma unidade consegue consultar outras escolas no escopo de leitura, mas não recebe formulário de escrita fora da unidade autorizada.
- [ ] Evoluções distinguem previsto, em andamento, concluída, não realizada e suspensa, sem inferir que ausência de registro equivale a omissão.
- [ ] Evolução pode se vincular a visita posterior da mesma escola; vínculo e histórico resistem a retificações.
- [ ] Retificação da própria visita exige justificativa e preserva a versão original.
- [ ] Gabinete visualiza rede, gráfico mensal, situações, quadro de pendências e histórico por unidade, sem poder gravar.
- [ ] No quadro de preparação da próxima visita, a última evolução de cada medida aparece em detalhe expansível, com relato, data e autoria, sem ocultar o histórico antigo e sem oferecer escrita ao Gabinete.
- [ ] É possível marcar medidas para um **roteiro de foco**, inclusive com filtros e prévia de cinco itens; PDF/Excel/CSV seletivos contêm somente as medidas marcadas, e o roteiro integral continua incluindo todas as pendentes. A seleção não duplica medidas nem registra visita.
- [ ] Se uma medida selecionada deixar de estar pendente durante atualização do histórico, o roteiro seletivo é bloqueado até revisão/limpeza, sem excluir uma medida silenciosamente.
- [ ] Se **todas** as medidas selecionadas forem concluídas após atualização, o aviso de seleção obsoleta e o botão de limpeza continuam visíveis, mesmo com zero pendências; se algumas permanecerem pendentes, o roteiro integral ainda pode ser exportado normalmente.
- [ ] O filtro **Somente selecionadas** permite rever as medidas marcadas sem depender dos filtros anteriores; ao concluir uma parte das medidas após atualização, o botão **Retirar medidas não pendentes** preserva as outras escolhidas e libera o roteiro de foco apenas com as restantes.
- [ ] Durante geração de roteiro PDF/Excel/CSV, a seleção, filtros, pesquisa e atalhos internos ficam temporariamente desabilitados e aparece aviso acessível de preparação; ao concluir ou falhar, a tela reabilita sem trocar a seleção.
- [ ] Se a geração do roteiro falhar por conexão/serviço, a seleção persiste e existe botão explícito de repetir o mesmo formato; cliques rápidos não produzem arquivos duplicados. Se o usuário modificar os IDs ou escopo, a repetição antiga desaparece e o próximo download usa a seleção corrente.
- [ ] Se o usuário mudar de escola ou sair da ficha durante uma exportação PDF/Excel ainda em processamento, não ocorre download tardio do documento da escola anterior. Um novo roteiro da unidade selecionada continua funcionando normalmente.
- [ ] Se o histórico da **mesma** escola atualizar enquanto PDF/Excel ainda está sendo convertido, o arquivo antigo não é baixado; o SIGEM mostra aviso de cancelamento e preserva a seleção para revisão e nova exportação.
- [ ] A comparação entre duas visitas mostra apenas versões vigentes da escola autorizada, permite escolher encontros diferentes, não conta retificação como visita e permanece somente leitura para o Gabinete.
- [ ] Filtros de vencidas, sem atualização e sem prazo, mais pesquisa de responsável/descrição, alteram só a prévia da unidade: totais e roteiro completo exportado continuam abrangendo todas as providências sem conclusão declarada.
- [ ] Medida sem evolução mostra ausência de registro (não presume que algo deixou de ser realizado).
- [ ] Pesquisa por nome e INEP, filtros, acesso direto à medida e exports PDF/XLSX/CSV funcionam em sessões dos perfis autorizados.
- [ ] Dados textuais nos exports não executam fórmulas de planilha.
- [ ] O sistema recusa consulta incompleta quando excedidos os limites atuais: 1.000 versões de visitas / 2.000 medidas / 5.000 evoluções por unidade e 5.000 medidas pendentes na rede.
- [ ] Leitor da ficha escolar recusa por inteiro um JSON com registros de outra unidade, medida sem visita lógica válida ou evolução sem medida conhecida; nunca exibe/exporta um histórico parcialmente corrigido no navegador.
- [ ] Consultas de panorama e gráficos rejeitam escola ou situação duplicada, contagens negativas/ausentes e meses fora do período, em vez de exibir totais artificiais, `NaN` ou `undefined`.
- [ ] O quadro de providências rejeita integralmente uma resposta com medida duplicada, escola/descrição ausente, data inválida, situação concluída ou inconsistência entre situação e última evolução; a pesquisa e a exportação não mostram uma lista parcialmente validada.
- [ ] Com visita nova parcialmente preenchida, a troca de escola e o fechamento da ficha são recusados sem apagar textos; **Descartar preenchimento** limpa apenas depois de ação explícita.
- [ ] Com retificação aberta, uma tentativa de retificar outra visita ou mudar de escola preserva a primeira.
- [ ] Com medida adicional em edição, trocar visita ou escola preserva os dados até salvar ou cancelar; os botões de cancelar ficam desabilitados durante o envio.
- [ ] Enquanto qualquer formulário (visita, medida ou evolução) está enviando dados, todos os campos, datas, seletores e botões internos ficam desabilitados; em erro voltam a ser editáveis com os valores preservados.
- [ ] Após uma falha de conexão, repetir exatamente o mesmo registro mantém o identificador de solicitação; editar o diagnóstico antes de repetir inicia outra solicitação. Nenhuma duplicação institucional deve ser produzida pela mesma chave (validar em ambiente de teste).
- [ ] Com evolução em edição, trocar medida ou escola preserva os campos; uma evolução limpa pode ser cancelada sem criar evento.
- [ ] Com visita/medida/evolução em edição, **recarregar ou fechar a aba** aciona confirmação nativa nos navegadores que a suportem; após salvar/cancelar, o alerta deixa de ser apresentado. Conferir limites em smartphones e que nenhum texto é persistido offline.
- [ ] Com formulário não salvo, mudar para **outra rota interna** do SIGEM abre confirmação institucional; cancelar preserva o formulário e confirmar permite a saída. Sem rascunho, não há bloqueio. Validar também quando a interface de confirmação estiver indisponível.
- [ ] Em cada confirmação destrutiva (descarte de visita, remoção de medida, cancelamento de medida ou evolução), modificar o texto enquanto o diálogo está aberto e confirmar: a operação antiga deve ser recusada e os novos dados preservados, com aviso para solicitar nova confirmação.
- [ ] UI é conferida em navegador real, inclusive smartphone, com sessão de cada perfil.

## 5. Critérios de publicação e contingência

Só liberar a PR do estado **draft** e considerar merge após: (a) CI da última revisão integralmente verde; (b) compatibilidade da migration validada em clone de esquema integral; (c) homologação da política nominal de leitura/escrita; (d) teste funcional com usuários de teste para os perfis autorizados; (e) plano de deploy, backup e reversão documentados pela equipe responsável.

**Falha operacional:** preferir reverter a publicação da interface ou desabilitar temporariamente as capacidades homologadas. Não apagar tabelas, revisões ou ledgers de acompanhamento, que são append-only e formam trilha de auditoria. Não aplicar `DROP TABLE` como rotina de rollback. Qualquer reversão de estrutura deve ser avaliada como intervenção separada, com backup e aprovação explícita.

**Separação de responsabilidades:** a equipe de acompanhamento registra fatos e evolução; o Gabinete consulta e decide providências pelos processos institucionais existentes. Este módulo não realiza cobranças, sanções ou homologações automáticas.

### Conciliação dos indicadores entre consultas independentes (05/11/2026)

As RPCs de panorama, série mensal e situações das ações são independentes: suas respostas podem representar momentos diferentes após registros, retificações ou mudanças de acesso. A interface não deve combinar números incompatíveis como se fossem um único retrato da rede. Antes dos gráficos, confere que (1) a soma de visitas por mês coincide com as visitas do período no panorama, (2) a soma de todas as situações coincide com o número total de ações e (3) as ações declaradas concluídas coincidem com o total de concluídas apresentado no panorama. Se falhar, os gráficos são ocultados, a contagem derivada da distribuição de situações não é apresentada e uma mensagem orienta atualizar; a lista de escolas do panorama autorizado permanece consultável. Os testes cobrem divergência, total de situações coincidente mas conclusão divergente e recuperação por atualização.

**Limite:** consistência numérica não prova leitura transacional nem protege contra discrepâncias que preservem todos esses totais. RLS e verificações de escopo seguem obrigatórias na origem; um snapshot comum na RPC é uma evolução posterior, sujeita a homologação de SQL em clone completo.

### Reconciliação por unidade escolar, mesmo com total global correto (05/11/2026)

O quadro de providências deve fechar **por unidade**, não apenas no total municipal. Para cada `school_id` retornado pela rede autorizada, confronta o número de medidas ainda não concluídas (`actions - completed`) com o número de linhas da RPC de pendências daquela escola; também confronta os respectivos vencimentos (`overdue`). Assim, uma medida ausente na escola A e outra excedente em B não se anulam na auditoria; o mesmo vale para vencimentos deslocados entre escolas. A interface oculta a relação inteira e suas exportações até nova leitura coerente, sem trocar a escola de uma medida no cliente.

Testes unitários e de interface simulam ambos os cenários com somas globais idênticas, além da recuperação após atualização. A medida de proteção não é substituta de RLS, validação de autoria ou de consulta SQL transacional em ambiente institucional homologado.

### Reconciliação numérica do quadro transversal (05/11/2026)

Além de validar cada `school_id` contra o panorama autorizado, o SIGEM agora compara os totais entre as RPCs de panorama e de pendências: **providências não concluídas = todas as ações menos as concluídas declaradas**, e **providências vencidas = medidas com prazo anterior à data operacional de São Paulo, ainda não declaradas concluídas**. Caso uma linha falte ou os prazos não coincidam, o quadro de providências do Gabinete e suas exportações são bloqueados com aviso; o panorama escolar continua consultável. Isso evita o falso relatório de pendências integral com dados de épocas distintas, mesmo quando ambos os leitores retornam o mesmo conjunto de escolas.

Testes isolados e de interface cobrem omissão de linha, mesma quantidade com vencimentos discordantes, leitura íntegra e restauração após `Atualizar`. A comparação reduz inconsistências visíveis, mas não garante transação entre RPCs; homologar a fonte SQL em um clone institucional integral antes da publicação.

### Consistência de escopo no quadro de providências (05/11/2026)

O quadro transversal consulta uma RPC específica, independente do panorama de escolas. Para impedir divulgação ou exportação de pendências do escopo anterior após uma revogação parcial, a interface exige que o panorama esteja atualizado e confronte **todos** os `school_id` das pendências com as unidades confirmadas no panorama. Havendo divergência, recusa o quadro inteiro e informa que é necessário atualizar as consultas; não filtra silenciosamente linhas, porque isso produziria relatórios incompletos apresentados como integrais. Uma falha ou atualização em andamento no panorama também oculta o quadro, mesmo se a RPC de pendências ainda conservar dados em cache.

Testes de integração simulam a rede A+B passando somente a B enquanto a RPC de pendências ainda retorna A; também simulam erro na atualização da rede. A verificação do navegador é defesa complementar: não substitui as permissões das RPCs SQL nem a homologação de mudanças de acesso em um clone integral.

### Revogação parcial de escola após atualização da rede (05/11/2026)

Uma resposta ainda bem-sucedida da RPC escolar **não autoriza**, sozinha, exibir um cache antigo se a consulta atualizada da rede já deixou de listar a unidade. A página verifica a interseção do `school_id` selecionado com o panorama recém-confirmado antes de renderizar a ficha, formulários, medidas ou oferecer exportações. Quando a escola deixa de estar no escopo, exibe apenas uma orientação sem conteúdo institucional antigo. Se existirem rascunhos locais, estes só são descartados após confirmação explícita; confirmações obsoletas não apagam preenchimentos modificados. Isso cobre revogação parcial e mudanças de vínculo no mesmo login sem depender da falha da RPC individual.

Os testes simulados exercitam uma rede inicialmente A+B que passa a B, mantendo a resposta anterior de A no leitor escolar, e verificam bloqueio de exportações/escrita, cancelamento do arquivo em execução e descarte seguro. Ainda é necessário ensaiar os mesmos cenários com contas reais e políticas efetivas em um clone integral isolado.

### Quadro de providências: cancelamento por atualização ou troca de contexto (05/11/2026)

O quadro transversal do Gabinete também cancela exportações PDF/Excel/CSV se a consulta autorizada for recarregada, a escola selecionada mudar, o usuário editar pesquisa/filtro, abrir uma medida, a data operacional mudar ou o componente for desmontado (inclusive na troca de sessão). O cancelamento é imediato para eventos do próprio painel e é verificado pelo sinal na função exportadora antes do download. Promessas antigas não podem liberar a interface nem prejudicar uma exportação mais recente. Um aviso explica que é necessário conferir os dados e exportar novamente. Testes de interface com promessas controladas cobrem atualização do quadro, filtro, troca de escola, navegação e resolução tardia do arquivo anterior. A validação não substitui o ensaio de revogação com usuários reais no clone integral.

### Exportações gerais canceladas ao mudar de contexto (revisão de 05/11/2026)

As exportações **PDF, Excel e CSV** do panorama, da ficha escolar e da visita individual agora conferem `AbortSignal` antes do download. A página cancela a exportação ao trocar de escola, sair do módulo, alterar filtros/período ou receber nova resposta autorizada. O cancelamento ocorre de forma síncrona antes da troca de escola, e a conclusão tardia de uma conversão antiga não libera nem interfere no arquivo novo. A função do quadro de providências também admite o sinal opcional, para uso por interfaces que controlam seu ciclo de vida. A conversão pode terminar em memória, mas não entrega um arquivo obsoleto.

Testes com promessas assíncronas controladas comprovam que PDFs e planilhas cancelados não produzem downloads, e que a exportação de uma nova escola continua independente da anterior. Os testes não equivalem a uma simulação de revogação real de sessão no Supabase nem à homologação em clone integral.

### Integridade das cadeias de retificações (revisão de 05/11/2026)

O leitor de ficha escolar agora confere não só o vínculo das ações a visitas vigentes, mas também a **cadeia completa das versões**: cada visita vigente deve percorrer suas antecessoras por `supersedes_id` até a versão original (`version = 1`), com versões consecutivas e um mesmo `logical_id`. O JSON completo é rejeitado se faltar versão histórica, existir predecessor incorreto, cadeia órfã ou retificação com versão saltada. Há regressões automatizadas para uma visita com três versões, duas visitas independentes e diferentes histórias malformadas. Esta validação da interface não altera a escrita append-only do banco nem substitui a homologação da migration sobre o esquema completo.

### Validação de datas e cronologia nas leituras (revisão de 05/11/2026)

Os contratos da ficha escolar e do quadro de providências rejeitam **dias inexistentes no calendário** (não apenas strings com máscara `AAAA-MM-DD`) e timestamps de registro inválidos, incluindo casos em que a conversão automática de JavaScript normalizaria 30 de fevereiro para março. Há testes para data bissexta válida, dia impossível de visita, prazo de medida, data de evolução e datas de criação. O contrato também confere a **cronologia entre registros**: prazo da medida não antecede a visita de origem vigente; evolução não antecede a origem ou o retorno vinculado; retorno associado à medida não pode anteceder a visita de origem. Retificações continuam referenciadas pelo mesmo ID lógico. A suíte cobre exemplos válidos e inválidos. Uma resposta inválida interrompe a leitura integral antes de apresentar ou exportar o histórico. Essa verificação é defesa de interface e não substitui as RPCs de autorização no banco.

### Testes de integração da página (sessões simuladas)

A suíte `src/features/school-institutional-followup/page-integration.test.tsx` cobre consulta pelo Gabinete sem botões de escrita, registro de visita e plano por servidor, ausência de acesso sem sessão e prevenção de perda de diagnóstico durante troca de escola. Ela executa a página React com respostas e capacidades **simuladas**, sem acessar nem alterar Supabase. Os testes não comprovam políticas de autorização do banco, escopo real, autenticação institucional ou navegação em navegador físico; a matriz de aceite manual acima continua pendente.

### Cancelamento imediato de relatórios do quadro na atualização explícita (05/11/2026)

Além de cancelar relatórios gerais, o comando **Atualizar** agora interrompe também o PDF/Excel/CSV ainda em geração do quadro de providências **no próprio evento**, antes de iniciar as invalidações de consultas. A troca de escola também interrompe imediatamente a exportação do quadro; o componente preserva a proteção adicional que aborta quando recebe novos dados, filtros ou autorização. A comunicação entre página e painel é um callback registrado em ref e desregistrado ao desmontar, sem compartilhar dados ou alterar escopos. Testes de integração simulados verificam o sinal já abortado no início de `invalidateQueries` e impedem que a conclusão tardia da exportação antiga interfira na nova. O cancelamento protege downloads futuros, não arquivos já baixados, e não substitui a validação real em clone institucional.


## Auditoria de ambientes Lovable Cloud — 05/11/2026

Registro de consultas **somente leitura** efetuadas nos projetos Lovable conectados. Estes dados são evidências de estado observado e não autorizam publicação nem implantação de banco.

| Critério | Resultado observado |
| --- | --- |
| Branch de trabalho | `feat/acompanhamento-unidades-escolares`, PR #7, HEAD `eccf035d6832b251b69372505ab98e019df5762f`, **rascunho, sem merge** |
| GitHub Actions no HEAD | Execução [42128502934](https://github.com/psicofilos96-prog/s.i.g.e.m/actions/runs/42128502934) concluída com sucesso: jobs `required`, `deep`, `followup-contract` e `followup-sql` |
| Lovable isolado | Projeto `9968079a-eab7-4f27-aec9-a049cb8e159b` (“SIGEM Homologação Escolar”); PostgreSQL **17.11**, **11 tabelas públicas** e 27 tabelas no esquema `auth`; **não equivale ao esquema integral do SIGEM** |
| Isolado: tabelas de 0613 | As quatro tabelas `school_institutional_followup_{visits,actions,updates,bundles}` existem, com **RLS habilitada em todas** |
| Isolado: acesso direto | `has_table_privilege` para `anon`, `authenticated`, `service_role`: nenhuma das quatro tabelas concede **SELECT/INSERT/UPDATE/DELETE** diretamente a esses papéis |
| Isolado: funções e resíduos | Exatamente **13** funções da família `school_institutional_followup_*` / `record_school_institutional_followup_*`; contagem real de registros **0** em cada uma das quatro tabelas |
| Outro projeto Lovable | `SIGEM 2.0` (`2a288ac3-f204-4816-b0e2-123b6b6673d9`): PostgreSQL **17.6**, **75 tabelas públicas**, **20** iniciadas por `institutional_` e nenhuma das quatro tabelas da 0613; inspeção somente leitura |
| Compatibilidade preliminar do SIGEM 2.0 | Há `institutional_schools`, identificadores, versões, pessoas, vínculos e `effective_scope_capabilities(date)`, mas **não há `sigem_capability_catalog`** e o campo **`institutional_persons.actor_nature`** não existe nessa instância. Portanto, **falha nos pré-requisitos estruturais mínimos da 0613** e não pode ser assumido como clone homologado |
| Outros projetos | Dois bancos adicionais não puderam ser inspecionados via Lovable (`query_error`: possivelmente indisponíveis). Ausência de resposta **não comprova** ausência de dados ou de esquema |
| Divergência do clone | O projeto isolado possui commit Lovable próprio após ajustes locais de backend (SHA `f9a46eb553306909b8b5a604ad61a18d3d02a0f0`); CI do GitHub aprova o HEAD do PR, não automaticamente esse commit local |

**Fronteira dos resultados:** esta auditoria verificou RLS, concessões diretas, contagem de funções, resíduos e estado do CI; o relato de execução dos roteiros SQL no ambiente isolado consta de sessão anterior. Não foi repetido aqui o fluxo completo de autenticação com usuários finais, nem o ensaio de 0613 sobre um **clone integral**. Não confundir a compatibilidade da fixture sintética com a do esquema de produção.

**Pendências bloqueadoras para sair de rascunho:** identificar inequivocamente o Cloud de destino realmente associado à aplicação institucional; produzir clone **integral e separado** do esquema desse destino (sem importar dados pessoais) ou reconstruí-lo por migrações canônicas verificadas; executar pré/pós-checks e testes SQL no clone completo; homologar a política nominal dos dois servidores e leitores do Gabinete; validar o login e os fluxos reais com usuários sintéticos e sessões distintas; confirmar plano de publicação/reversão. **Não conceder capabilities, aplicar 0613, fazer merge nem publicar sobre o ambiente institucional antes dessas etapas.**


## Homologação SQL contra clone integral do esquema SIGEM — 05/11/2026

Foi identificado **o projeto Lovable publicado S.I.G.E.M**, ID `a5d0ed94-feb8-485b-8fe0-2d52377f3418`, no workspace `ed2c2a3a5d924615ae51`, com `latest_commit_sha=21145ca9902b31433b892887adaeb66520520732` (main do PR #7) e `supabase/config.toml` = `crfqhyqkujhhlbiyhdbc`. Diferentemente do Remix antigo com o mesmo identificador de arquivo, **o banco deste projeto publicado respondeu às consultas SQL somente leitura**. Não foi executado SQL de escrita sobre o projeto publicado.

Foi identificado **o clone Lovable de homologação PR7**, ID `f17b6abd-c100-4603-bb6b-2fec9aa47dda`, Cloud próprio `nyupdcodzfmwkpxpourt`. PostgreSQL 17.11 nos dois projetos. O clone não tinha registros de `auth.users`, `institutional_schools`, `institutional_persons` ou `user_person_links` antes dos testes, nem após eles. Comparação por consulta e impressão digital MD5 de *definições de catálogo*, excluindo somente os objetos da família do novo módulo:

| Objeto existente antes da 0613 | Publicado | Clone | Resultado |
| --- | ---: | ---: | --- |
| Tabelas públicas | 820 | 820 | mesmos nomes |
| Colunas das tabelas | 7.895 | 7.895 | mesma assinatura de nome, tipo, nulidade e default |
| Índices | 1.887 | 1.887 | assinaturas completas iguais |
| Políticas RLS | 671 | 671 | assinaturas completas iguais |
| Funções do schema `public` | 1.694 | 1.694 | definições completas iguais |
| Gatilhos não internos | 915 | 915 | definições completas iguais |
| Restrições | 5.223 | 5.223 | **uma única diferença textual** na forma de parênteses de `dev_waitlist_criteria_versions_keys_check` (agrupamento equivalente de expressões `AND`); outras definições conferem |

Essas comparações de catálogo aumentam a confiança na **correspondência estrutural do clone**. Não são prova de cópia dos dados (intencionalmente não copiados), de equivalência de parâmetros globais de servidor ou de sessão Auth pelo navegador.

**Testes executados diretamente no banco do clone integral, sem escrita persistente:**

1. `supabase/tests/0613_followup_clone_postflight_readonly.sql` — **PASSOU**, com `BEGIN TRANSACTION READ ONLY` e `ROLLBACK`.
2. `supabase/tests/0613_school_institutional_followup.sql` — **PASSOU** sem adaptação, incluindo negações e isolamento básico, com `BEGIN/ROLLBACK`.
3. `supabase/tests/0613_followup_isolated_positive.sql` — **PASSOU**, com fixture de duas escolas e cinco identidades sintéticas montada dentro da transação; a fixture utiliza as **tabelas institucionais reais**, `capability_policies`, `capability_policy_rules`, `institutional_engagements` e a função original `effective_scope_capabilities(date)`. O início/fim transacional do script foram incorporados ao invólucro único `BEGIN/ROLLBACK`.
4. `supabase/tests/0613_followup_two_visitors.sql` — **PASSOU**, também com fixture da autoridade **canônica** do SIGEM. A única adaptação operacional foi substituir a remoção de grant da tabela *exclusiva da fixture CI* (`test_followup_capabilities`, ausente do esquema real) pelo **encerramento temporal do vínculo sintético de B** em `institutional_engagements`, com `valid_until` anterior ao dia de São Paulo. A revogação passou na mesma sessão simulada; a escrita/consulta cruzadas foram negadas; o Gabinete continuou leitor das duas unidades.

**Importante:** a fixture homologou duas políticas `draft → homologated` **dentro da própria transação de ensaio**, mantendo todos os gatilhos e validadores institucionais; não substituiu a função de autoridade original. Tentativa inicial de inserir regras após homologação foi corretamente rejeitada pelo gatilho imutável `guard_homologated_rules()`. O teste final respeitou a ordem correta. No teste de revogação, a data foi expressa em `America/Sao_Paulo` para coincidir com a data operacional usada pela RPC, evitando falso resultado quando o dia UTC difere do local.

**Contagens após os testes:** 0 registros em `auth.users`, `institutional_schools`, `institutional_persons`, `institutional_engagements` e nas quatro tabelas `school_institutional_followup_*` do clone. As quatro tabelas do módulo mantêm RLS habilitada.

**CI GitHub:** execução [42140224026](https://github.com/psicofilos96-prog/s.i.g.e.m/actions/runs/42140224026) — **concluída com sucesso** no commit `2ff6762f`.

**O que permanece não homologado:** login real via Auth e navegação/fluxos UI da branch do PR no clone integral; políticas nominais aprovadas para os servidores reais e Gabinete; implementação/reversão na aplicação publicada. Um projeto Lovable de homologação contém o esquema integral com 0613, mas a árvore de código daquele projeto ainda era uma cópia da aplicação anterior ao PR no começo desta etapa. Foi aberta uma tarefa de atualização **somente nele**, com proteção explícita para não importar a referência ao backend original. Não confundir sessão de SQL com claims sintéticos com login real em navegador.

**Decisão:** manter PR #7 em rascunho até concluir Auth/UX e aceite institucional; não executar migration 0613 nem modificar políticas ou dados no banco publicado por esta auditoria.


### Pré-checagem da base publicada (somente leitura)

Na mesma rodada de 05/11/2026, o roteiro versionado `supabase/tests/0613_followup_clone_preflight_readonly.sql` foi executado **sem modificações de SQL** contra o banco do projeto Lovable publicado `a5d0ed94-feb8-485b-8fe0-2d52377f3418`, estritamente dentro de `BEGIN TRANSACTION READ ONLY` e `ROLLBACK`. **Resultado: PASSOU**, sem exceções. Este resultado confirma os pré-requisitos estruturais exigidos para uma instalação futura e que a família de objetos da 0613 ainda não se encontra instalada nesse destino. Não houve execução da migration nem qualquer escrita no ambiente publicado. A pré-checagem **não** concede capacidade, não garante ausência de divergências futuras e não autoriza deploy automático.

A configuração `vite.config.ts` do projeto publicado contém a referência canônica `crfqhyqkujhhlbiyhdbc`. No clone integral, a configuração `supabase/config.toml` aponta para o Cloud isolado `nyupdcodzfmwkpxpourt`, **mas o `vite.config.ts` ainda continha fallback com `crfqhyqkujhhlbiyhdbc` quando inspecionado**. Por isso, o aceite de navegação com login foi conscientemente **bloqueado até corrigir o fallback no clone** e comprovar que a compilação aponta exclusivamente para o banco de homologação. Não imprimir ou versionar chaves do `.env`.

