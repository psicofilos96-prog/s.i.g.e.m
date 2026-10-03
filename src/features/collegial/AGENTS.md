## Colegiados e deliberações (`src/features/collegial/`)

Infraestrutura genérica de colegiados fica em `src/features/collegial/`, separada
de `assessment/`, porque a mesma máquina de sessão → pauta → deliberação → ata
atenderá outros colegiados além do Conselho de Classe.

- Sessão, pauta, deliberação e ata são entidades distintas; colegiado não é
  sinônimo de "alterar situação de aluno".
- Requisitos de composição, quórum, forma de decisão, assinatura e provocação
  formal são opcionais na configuração: nada declarado ⇒ nada exigido.
- Competência para produzir situação acadêmica vem apenas do `DeliberationBody`
  da regra de situação homologada (12I), nunca da configuração do colegiado.
- Ata encerrada é imutável: correção gera nova versão encadeada. Formatação,
  A4 e PDF pertencem ao Capítulo 15.
- B4.10.0a: `useCloudCollegial` aceita resposta só do contexto vigente (identidade+turma) e `meta` pertence ao contexto que a leu; commit sem meta própria não envia.
