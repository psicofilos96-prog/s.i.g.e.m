## Encerramento do ciclo e da turma (`src/features/cycle-closing/`)

O encerramento vive em módulo próprio, fora de `assessment/`, porque é
orquestrador de integridade e não motor acadêmico: ele não calcula nota,
frequência, situação nem deliberação.

- Requisito é resolvido por avaliador registrado (`evaluatorId`); nunca
  `switch (requirement.kind)` — nova exigência entra como avaliador registrado.
- Avaliadores nativos são primitivas genéricas; `sourceKind`, estados, capacidades
  e naturezas de ato são identificadores abertos, declarados por configuração.
- Situação acadêmica terminal é exigência opcional da política; nenhuma situação
  é criada para permitir o encerramento.
- Snapshot guarda fatos materializados e referências com versão. Congelamento em
  memória é defesa da implementação; a imutabilidade real virá de persistência
  append-only versionada.
- Fronteira de sessão (B4.6.2b.1): sessão incerta só carrega; só o laboratório (sem sessão) observa calendário local; com sessão a origem é explícita e fonte indisponível entra por `sourceAvailability` genérico (requisito que a declare fica inconclusivo), porque negação de leitura não é inexistência.
- O corpo do encerramento recebe `ClosingOrigin` da fronteira e nunca chama outra instância de sessão, porque duas leituras de sessão podem divergir e selecionar política/ator demonstrativos.

- B4.6.2b.1.2: respostas de leitura só têm efeito com contexto (identidade+turma+enabled) ativo e geração atual; erro nunca hidrata, porque efeito tardio sobre store global corrompe o contexto novo.
