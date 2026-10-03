# B3.2 — Alocação com término atômico

## Estado

Implementada no checkout; **validação SQL real e aplicação da migration pendentes**.
Não declarar B3.2 concluída ou cadeia B3 operacional até executar o teste no
banco da Cloud e conferir o rollback. Nesta máquina, a URL pública do Supabase
responde, mas `LOVABLE_DB_MIGRATION_URL` e um executor SQL autorizado não estão
disponíveis. Nenhuma migration ou fixture foi aplicada à Cloud nesta etapa.

## Contrato técnico

`drizzle/migrations/0004_b3_2_atomic_class_allocation_ending.sql` acrescenta a
assinatura de oito argumentos de `record_class_allocation`, com `_ended_on date`
explícito. A assinatura antiga de sete argumentos delega com `NULL`, preservando
a criação aberta para participação aberta e a recusa de criação aberta sob
participação delimitada. Não há data final presumida.

O novo writer mantém sessão, capability escolar, escola e ano da turma,
participação, inscrição, locks do par inscrição/participação na ordem dos
escritores pais e releitura das versões após adquirir os locks, base esperada de correção,
cardinalidade sem norma e `class_fact_context` para todo o intervalo informado.
Depois de inserir a alocação, chama `record_class_allocation_ending` na **mesma
transação** para gravar a versão inicial do término. Qualquer falha desfaz as
duas inserções. Uma correção de alocação continua usando a base existente e seu
término versionado; passar outro `_ended_on` junto da correção é recusado.
Nenhuma cascata, capability, catálogo, política ou dado institucional foi criado.

A tela institucional oferece a data final opcional e a exige quando a
participação escolhida já tem `valid_until`. O banco revalida tudo: o controle
da tela não é uma autorização. As leituras `validOn`/`knownAt` e as estruturas
append-only permanecem as mesmas.
Sem data final, o cliente mantém a chamada de sete argumentos, que continua
funcionando antes da aplicação da migration para participações abertas.

## Validação

`supabase/tests/b3_2_atomic_allocation.sql` cobre intervalos abertos e
delimitados, igualdade do término ao fim do pai, limites da inscrição,
participação, turma e ano, sessão, capability, cardinalidade, DML direto,
append-only e leituras bitemporais. O script abre uma transação, cria apenas
fixtures temporárias, executa `ROLLBACK` e verifica ausência de resíduos. Deve
ser executado **após** a migration B3.2, com parada no primeiro erro; apenas
as mensagens `b32-tests-ok` e `b32-rollback-ok` comprovam a execução completa.

Até essa execução, os testes TypeScript, o typecheck e o build verificam somente
o código local. A homologação de valores e políticas, o login institucional
real e a bateria vertical continuam fora deste ajuste técnico.

Verificação local deste checkout: 2.442 testes em 149 arquivos passaram; os
33 testes direcionados B3/B3.1/B3.2, `tsc --noEmit`, build de produção e
`drizzle-kit check` também passaram. A sintaxe SQL externa dos dois arquivos
novos foi analisada; isso não executa PL/pgSQL nem substitui o teste Cloud.
