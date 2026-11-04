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
- [ ] Evoluções distinguem previsto, em andamento, concluída, não realizada e suspensa, sem inferir que ausência de registro equivale a omissão.
- [ ] Evolução pode se vincular a visita posterior da mesma escola; vínculo e histórico resistem a retificações.
- [ ] Retificação da própria visita exige justificativa e preserva a versão original.
- [ ] Gabinete visualiza rede, gráfico mensal, situações, quadro de pendências e histórico por unidade, sem poder gravar.
- [ ] Pesquisa por nome e INEP, filtros, acesso direto à medida e exports PDF/XLSX/CSV funcionam em sessões dos perfis autorizados.
- [ ] Dados textuais nos exports não executam fórmulas de planilha.
- [ ] O sistema recusa consulta incompleta quando excedidos os limites atuais: 1.000 versões de visitas / 2.000 medidas / 5.000 evoluções por unidade e 5.000 medidas pendentes na rede.
- [ ] UI é conferida em navegador real, inclusive smartphone, com sessão de cada perfil.

## 5. Critérios de publicação e contingência

Só liberar a PR do estado **draft** e considerar merge após: (a) CI da última revisão integralmente verde; (b) compatibilidade da migration validada em clone de esquema integral; (c) homologação da política nominal de leitura/escrita; (d) teste funcional com usuários de teste para os perfis autorizados; (e) plano de deploy, backup e reversão documentados pela equipe responsável.

**Falha operacional:** preferir reverter a publicação da interface ou desabilitar temporariamente as capacidades homologadas. Não apagar tabelas, revisões ou ledgers de acompanhamento, que são append-only e formam trilha de auditoria. Não aplicar `DROP TABLE` como rotina de rollback. Qualquer reversão de estrutura deve ser avaliada como intervenção separada, com backup e aprovação explícita.

**Separação de responsabilidades:** a equipe de acompanhamento registra fatos e evolução; o Gabinete consulta e decide providências pelos processos institucionais existentes. Este módulo não realiza cobranças, sanções ou homologações automáticas.
