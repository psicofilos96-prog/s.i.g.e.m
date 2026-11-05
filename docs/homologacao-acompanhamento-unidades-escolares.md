# Homologação — Acompanhamento institucional das unidades escolares

**Módulo:** `/acompanhamento-unidades` · **PR:** #7 · **Estado:** implementação em revisão, sem implantação no banco institucional.

## 1. Evidências já obtidas (não substituem homologação)

O GitHub Actions executa em cada revisão:

- `required`: integridade das migrations, TypeScript, testes e build;
- `deep`: suíte de testes aprofundados;
- `followup-sql`: PostgreSQL 17 descartável, esquema mínimo de teste, migration `0613` e provas SQL negativas/positivas.

A prova PostgreSQL verifica escrita por servidor natural, leitura de rede pelo Gabinete, isolamento entre escolas, retificação append-only, autoria, datas, idempotência, transação atômica e limites explícitos de volume. Um teste adicional verifica que **identidade de órgão/setor não pode registrar visita**, ainda que a política lhe conceda capacidade de escrita. A fixture não reproduz todas as migrations do SIGEM; portanto, **CI verde não valida compatibilidade com o esquema institucional completo**.

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
- `supabase/tests/0613_followup_clone_postflight_readonly.sql` — rodar no **clone depois de aplicar 0613**. Confere quatro tabelas privadas com RLS, negação de DML/SELECT aos papéis cliente, RPCs abertas exclusivamente a `authenticated`, funções auxiliares privadas, `SECURITY DEFINER` e `search_path` declarado.

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

O GitHub Actions agora usa essas mesmas verificações na fixture mínima, o que testa o roteiro técnico, **mas não fornece o clone institucional nem uma execução no esquema real**. O pós-check não comprova os escopos das pessoas nem o comportamento da UI: a matriz de aceite abaixo permanece obrigatória. Se o pré-check reprovar, parar e analisar diferenças, sem adaptar funções ou alterar permissões em produção.

## 3. Matriz de aceitação institucional

| Perfil testado | Acesso à escola própria | Acesso a outras escolas | Registra/retifica/evolui | Exporta |
| --- | --- | --- | --- | --- |
| Servidor 1 (pessoa natural, atribuição escola A) | Sim | Não | Sim, somente onde autorizado | Somente escola A |
| Servidor 2 (pessoa natural, escopo homologado) | Conforme o escopo | Conforme o escopo | Conforme o escopo | Conforme o escopo |
| Gabinete, com capacidade de consulta da rede | Sim | Sim, dentro do escopo | **Não** | Sim, somente dados autorizados |
| Conta sem capacidade | Não | Não | Não | Não |
| Identidade institucional que recebeu capacidade de registro | Leitura conforme autorização | Conforme autorização | **Não** (exige pessoa natural) | Conforme autorização |

As políticas de concessão devem ser homologadas pelos responsáveis institucionais. **Nenhuma capacidade nova é distribuída automaticamente**. A autoria corresponde à pessoa natural autenticada; o campo de participantes é apenas texto declarado, sem assinatura ou delegação.

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
- [ ] Pesquisa por nome e INEP, filtros, acesso direto à medida e exports PDF/XLSX/CSV funcionam em sessões dos perfis autorizados.
- [ ] Dados textuais nos exports não executam fórmulas de planilha.
- [ ] O sistema recusa consulta incompleta quando excedidos os limites atuais: 1.000 versões de visitas / 2.000 medidas / 5.000 evoluções por unidade e 5.000 medidas pendentes na rede.
- [ ] Com visita nova parcialmente preenchida, a troca de escola e o fechamento da ficha são recusados sem apagar textos; **Descartar preenchimento** limpa apenas depois de ação explícita.
- [ ] Com retificação aberta, uma tentativa de retificar outra visita ou mudar de escola preserva a primeira.
- [ ] Com medida adicional em edição, trocar visita ou escola preserva os dados até salvar ou cancelar; os botões de cancelar ficam desabilitados durante o envio.
- [ ] Com evolução em edição, trocar medida ou escola preserva os campos; uma evolução limpa pode ser cancelada sem criar evento.
- [ ] Com visita/medida/evolução em edição, **recarregar ou fechar a aba** aciona confirmação nativa nos navegadores que a suportem; após salvar/cancelar, o alerta deixa de ser apresentado. Conferir limites em smartphones e que nenhum texto é persistido offline.
- [ ] Com formulário não salvo, mudar para **outra rota interna** do SIGEM abre confirmação institucional; cancelar preserva o formulário e confirmar permite a saída. Sem rascunho, não há bloqueio. Validar também quando a interface de confirmação estiver indisponível.
- [ ] UI é conferida em navegador real, inclusive smartphone, com sessão de cada perfil.

## 5. Critérios de publicação e contingência

Só liberar a PR do estado **draft** e considerar merge após: (a) CI da última revisão integralmente verde; (b) compatibilidade da migration validada em clone de esquema integral; (c) homologação da política nominal de leitura/escrita; (d) teste funcional com usuários de teste para os perfis autorizados; (e) plano de deploy, backup e reversão documentados pela equipe responsável.

**Falha operacional:** preferir reverter a publicação da interface ou desabilitar temporariamente as capacidades homologadas. Não apagar tabelas, revisões ou ledgers de acompanhamento, que são append-only e formam trilha de auditoria. Não aplicar `DROP TABLE` como rotina de rollback. Qualquer reversão de estrutura deve ser avaliada como intervenção separada, com backup e aprovação explícita.

**Separação de responsabilidades:** a equipe de acompanhamento registra fatos e evolução; o Gabinete consulta e decide providências pelos processos institucionais existentes. Este módulo não realiza cobranças, sanções ou homologações automáticas.

### Testes de integração da página (sessões simuladas)

A suíte `src/features/school-institutional-followup/page-integration.test.tsx` cobre consulta pelo Gabinete sem botões de escrita, registro de visita e plano por servidor, ausência de acesso sem sessão e prevenção de perda de diagnóstico durante troca de escola. Ela executa a página React com respostas e capacidades **simuladas**, sem acessar nem alterar Supabase. Os testes não comprovam políticas de autorização do banco, escopo real, autenticação institucional ou navegação em navegador físico; a matriz de aceite manual acima continua pendente.
