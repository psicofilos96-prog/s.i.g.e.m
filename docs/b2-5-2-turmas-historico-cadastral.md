# B2.5.2 — identidade e histórico cadastral da Turma

Implementação proposta no PR, **sem aplicação definitiva da migration e sem
congelamento**. O contrato institucional da B2.5.1 continua em
`docs/b2-5-1-turmas-contrato-autorizacao.md`.

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

## Autorização

As duas funções de escrita exigem, no banco,
`class_registry_school_grant('manter-cadastro-de-turmas', schoolId)`. Na
criação, `schoolId` é confrontado com o grant; depois, a escola vem
exclusivamente da identidade bloqueada. A atuação autorizadora e a política
efetiva ficam gravadas em cada versão. A v2 da Política de Capacidades ainda
está em `draft`; esta implementação não a homologa nem concede a capacidade.
Leitura da nova tabela segue o escopo de leitura da identidade. DML direto de
`anon`/`authenticated` é revogado.

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

## Validação

`supabase/tests/b2_5_2_class_record_history.sql` cobre as operações, o
controle escolar, vigência e a matriz bitemporal T1/T2/T3.
`supabase/tests/b2_5_2_class_record_chain.sql` cobre FKs, raiz única,
encadeamento, ciclos e erro de ambiguidade. Ambos encerram em `ROLLBACK`.
A prova de corrida entre **duas sessões simultâneas** ainda requer ambiente
isolado com duas conexões; o teste de uma sessão verifica lock declarado e
recusa de base substituída, sem alegar que provou escalonamento concorrente.
