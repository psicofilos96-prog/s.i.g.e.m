# B2.5.2 — identidade e histórico cadastral da Turma

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Implementação concluída e congelada após o merge do PR #3
(`871a051806dc1ed3d217f9eb26a47baa51d52ca4`). A migration
`20260930185526_b2_5_2_class_record_history.sql` está aplicada e registrada
uma vez na Lovable Cloud oficial. A validação operacional com login
institucional real permanece pendente. O contrato institucional da B2.5.1
continua em `docs/b2-5-1-turmas-contrato-autorizacao.md`.

## Fontes e fronteiras

`institutional_classes.id`, `school_id` e `academic_year_id` são a identidade
estrutural imutável. A migration acrescenta a FK do ano. Os campos planos
`code`, `name`, `valid_from`, `valid_until` e rótulos permanecem na linha
legada somente como fotografias da criação, porque a tabela atual os exige e
consumidores antigos ainda os leem. Eles nunca são atualizados para refletir o
estado cadastral corrente.

`institutional_class_record_versions` é a única fonte canônica nova para
código, nome, situação administrativa (`ativa`/`inativa`) e vigência cadastral.
Não contém escola, ano, classificação, turno ou Organização de Períodos.
Oferta/turno conservam suas fontes próprias; Turma → Organização pertence à
B2.5.3; interface completa à B2.5.4; classificação à B2.6; telas
demonstrativas à B2.7; matrícula/enturmação à B3; grade e Calendário à B4.

Na criação, a escola oficial deve possuir versão aplicável e ativa em
`valid_from`. O ano letivo oficial também deve possuir versão aplicável e
ativa nessa data. Para uma vigência de turma com fim informado, cada trecho
entre mudanças de `valid_from` do ano é validado pela versão do ano aplicável
naquele trecho (maior número de versão já vigente). O trecho inteiro deve
estar dentro de `starts_on`/`ends_on` e a versão deve estar ativa. Versões
futuras não alteram retroativamente a regra de trechos anteriores. Os
extremos são inclusivos. Na correção ou transição, cada linha nova — esquerda,
alvo e direita quando existirem — passa individualmente pela mesma validação
da escola aplicável em seu início e do ano segmentado, antes da inserção.
Se `valid_until` for `NULL`, apenas
`valid_from` é validado; o fim não é presumido nem convertido em infinito.
Leitores institucionais não podem interpretar esse `NULL` como permissão
para produzir efeitos fora do ano letivo.

## Dois tempos

`class_at(classId, validOn, knownAt)` responde qual versão era válida em
`validOn` segundo os fatos conhecidos até `knownAt`. O leitor descarta
registros posteriores a `knownAt`, identifica a cabeça então conhecida de
**cada** segmento por `supersedes_id`, filtra a vigência inclusiva e exige no
máximo uma cabeça aplicável. `knownAt = NULL` significa conhecimento atual;
zero respostas significa indisponibilidade; múltiplas são erro. A maior
`version` global jamais seleciona, sozinha, o fato aplicável.

Uma correção parcial acrescenta uma nova versão do segmento base e, quando
necessário, segmentos técnicos para as partes restantes. Todas as peças do
mesmo ato recebem um único `created_at` capturado no banco e a mesma
proveniência. Inativação e reativação seguem o mesmo mecanismo. Nenhuma linha
histórica sofre `UPDATE` ou `DELETE`. O escritor serializa por `classId`,
exige base não substituída e rejeita sobreposição entre cabeças atuais.

Uma `CONSTRAINT TRIGGER` diferida verifica no banco, ao fim da operação, que
nenhuma dupla de cabeças atuais da mesma turma possui vigência sobreposta.
Ela ignora versões substituídas, permite as peças de uma retificação atômica
e recusa inclusive uma raiz sobreposta inserida diretamente pelo proprietário.
Usa o mesmo advisory lock transacional por `classId` do escritor. A verificação
exige isolamento `READ COMMITTED`: um snapshot antigo em `REPEATABLE READ`
não pode atestar ausência de uma escrita concorrente após a espera pelo lock.
O leitor `class_at` continua recusando ambiguidades como defesa adicional.

## Autorização

As duas funções de escrita exigem, no banco,
`class_registry_school_grant('manter-cadastro-de-turmas', schoolId)`. Na
criação, `schoolId` é confrontado com o grant; depois, a escola vem
exclusivamente da identidade bloqueada. A atuação autorizadora e a política
efetiva ficam gravadas em cada versão. A v2 da Política de Capacidades ainda
está em `draft`; esta implementação não a homologa nem concede a capacidade.
Leitura da nova tabela segue o escopo de leitura da identidade. DML direto de
`anon`, `authenticated` e `service_role` é revogado, assim como `TRUNCATE`,
`TRIGGER` e os demais privilégios de tabela além de `SELECT`. A identidade
`institutional_classes` recebe a mesma restrição. Os escritores são
`SECURITY DEFINER`, com `search_path` vazio, objetos qualificados e `EXECUTE`
concedido apenas a `authenticated`; eles usam os privilégios de seu owner real
para inserir após verificar pessoa, atuação, política homologada e escola.
O papel auxiliar `sandbox_exec`, presente na Cloud, recebe `INSERT` nas
tabelas novas por privilégio padrão do owner `postgres` para o schema
`public`. A migration revoga sua escrita diretamente nas duas tabelas quando
o papel existe; não modifica os privilégios padrão do schema nem exige que o
papel exista em outros ambientes. Na Cloud auditada, `postgres` não tem a
opção `SET ROLE` para assumir `sandbox_exec`: o teste padrão comprova seus
privilégios efetivos por ACL. Uma prova adicional na Cloud concedeu essa
opção apenas dentro de uma transação revertida e executou tentativas reais
de `INSERT`, `UPDATE`, `DELETE` e `TRUNCATE` sob `sandbox_exec`; todas foram
recusadas pela ACL nas duas tabelas. Após `ROLLBACK`, a opção voltou a `false`.
Nos demais papéis, o teste padrão também verifica a recusa real dessas operações.
Na Cloud auditada, o owner é `postgres`; `service_role` não é o owner e não
recebe escrita direta. Um proprietário ou superusuário capaz de alterar o
próprio schema permanece fora dessa fronteira de proteção.

## Dívida de compatibilidade para a entrada em operação

- `src/features/diary/institutional-teaching.ts` ainda lê
  `institutional_classes.name`, `code` e `valid_until`; o último é usado
  para derivar uma situação de apresentação. Isso não representa as versões
  cadastrais nem os estados `ativa`/`inativa` após correção. O 6D permanece
  congelado neste PR.
- `src/features/ciece/ciece-query.functions.ts` e
  `src/features/statistical-map/statistical-map.functions.ts` ainda usam
  `institutional_classes.name` como rótulo. As classificações do CIECE/Mapa
  já usam oferta/turno próprios.
- `register_class_enrollment_episode` grava
  `class_label_snapshot` a partir do nome da identidade, portanto uma
  enturmação futura após renomeação capturaria o nome de criação. A correção
  desse consumidor pertence ao escopo posterior de B3.

Antes de pôr versões corrigidas em uso institucional real, os leitores desses
campos devem consumir a versão aplicável ou declarar indisponibilidade. Este
PR não sincroniza valores de volta para `institutional_classes` e não altera
consumidores congelados.

Os consumidores classificados como C na auditoria preparatória precisam de
reconciliação antes da primeira operação institucional real que dependa deles.
Os consumidores B precisam ler a versão cadastral aplicável antes da primeira
correção/versionamento real. Nenhuma turma real deve ser criada antes da
autorização do fluxo institucional correspondente; nenhuma correção real deve
ocorrer antes da reconciliação dos consumidores B.

**Dependência separada de B2.4:** `register_academic_year_version` valida os
períodos do ano, mas não confronta a nova versão com turmas já existentes.
Portanto uma versão futura do ano pode tornar incompatível uma turma antes
válida. O escritor do ano usa lock por ano; o escritor da turma usa lock por
turma, sem serialização entre ambos. A invariável precisa de auditoria
específica, inclusive de concorrência, antes de propor qualquer mudança na
B2.4 congelada. Esta microetapa não altera esse escritor.

## Validação

`supabase/tests/b2_5_2_class_record_history.sql` cobre as operações, o
controle escolar, vigência e a matriz bitemporal T1/T2/T3.
`supabase/tests/b2_5_2_class_record_chain.sql` cobre FKs, raiz única,
encadeamento, ciclos e recusa de escrita temporal ambígua.
`supabase/tests/b2_5_2_class_year_context.sql` cobre escola/ano oficiais,
vigência segmentada por versões do ano, extremos inclusivos, fim não informado
e recusa atômica.
`supabase/tests/b2_5_2_class_record_privileges.sql` verifica privilégios
efetivos e tenta DML/`TRUNCATE` sob `anon`, `authenticated` e `service_role`.
Quando existe, o mesmo teste também cobre `sandbox_exec`.
Os três encerram em `ROLLBACK`.
A corrida entre **duas sessões simultâneas** foi provada em PostgreSQL 18.4
local isolado, com a migration deste PR e dependências mínimas da autorização
escolar. A sessão A corrigiu a versão base e manteve a transação aberta por
três segundos; a sessão B iniciou durante esse intervalo e tentou corrigir
a mesma base. A confirmou, B recebeu `class:base-superseded`, e a consulta
final encontrou duas versões totais, **uma única sucessora da base** e
`class_at` retornando apenas o valor de A. A base de prova local foi removida.
O teste SQL de uma sessão verifica separadamente o lock declarado e a recusa
de base já substituída; a prova simultânea não foi feita na Cloud oficial.

Após o merge, o build da `main` passou e a suíte completa com dois workers
aprovou 139 arquivos e 2.333 testes. O Lovable sincronizou o commit de merge
e voltou a `ready`. A Cloud conservou v1 com 108 regras `draft` e v2 com 116
regras `draft`, sem v3 ou política homologada, e zero turmas, versões cadastrais
e vínculos Turma → Organização. Nenhum dado oficial foi criado. B2.5.3 não
foi iniciada neste fechamento.
