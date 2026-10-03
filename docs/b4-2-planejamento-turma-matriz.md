# B4.2 — Turma → Matriz (planejamento; NÃO iniciada)

Nenhum schema, código ou dado criado. Consome `curricular_matrices_at` (B4.1).

## Decidido
- **Origem normativa:** matrizes vêm de deliberação (proveniência: Deliberação CME nº 3/2026 de Itaperuna, art. 1º–2º, Anexos I–V); construção no SIGEM pela Supervisão Escolar; alterações por nova deliberação preservando versão, vigência, ato e histórico. `gestao-pedagogica-da-rede` é a atuação da Supervisão Escolar (D4 reconciliada, sem alteração de política). Cada versão pode trazer o quadro do anexo (B4.1.2).
- **D2-aplicação (decisão do usuário, 2026-10-03):** a matriz normativa é aplicada **automaticamente conforme o enquadramento**, sem vínculo manual por turma. Correspondência declarada pelo usuário para a deliberação vigente:
  - Educação Infantil → matriz da Educação Infantil;
  - Ensino Fundamental regular, 1º ao 5º ano → Anexo EF 1º segmento;
  - Ensino Fundamental regular, 6º ao 9º ano → Anexo EF 2º segmento;
  - EJA, fases I a V → Anexo EJA 1º segmento;
  - EJA, fases VI a IX → Anexo EJA 2º segmento;
  - e equivalentes conforme deliberações futuras.

  Essa correspondência é **norma configurada**, não código: deve ser registrada como dado versionado (com ato e vigência) que relaciona valores de classificação a uma matriz, para que nova deliberação mude a correspondência sem alterar o motor. Nenhum valor desta lista foi cadastrado nem fixado como enumeração.

- **D2-cardinalidade (revisada pela autoridade institucional, 2026-10-03):** substitui a formulação anterior "no máximo uma matriz vigente por turma×data", que fica **retirada**, assim como a recusa genérica de sobreposição de matrizes na mesma turma.
  - Em turma multisseriada/multietapas, **etapa/ano/fase é fato individual da alocação/enturmação do estudante**. A turma reúne etapas; nunca atribui artificialmente uma etapa única a todos.
  - As matrizes aplicáveis a uma turma numa data decorrem das **etapas efetivamente presentes** (pelas alocações vigentes) e das matrizes oficiais vigentes: uma única matriz pode abranger todas as colunas pertinentes, **ou** podem ser necessárias várias matrizes oficiais na mesma turma/data. Ambos os casos são válidos; o SIGEM não cria norma escolhendo um deles.
  - Obrigatoriedade de haver matriz para toda etapa presente/data **não decidida**. Ausência nunca é preenchida por default e a leitura a sinaliza.

- **AEE e atividade complementar:** são naturezas de turma distintas, **fora** da associação automática às cinco matrizes regulares. AEE não é etapa e pode coexistir com matrícula regular. Nenhuma matriz específica é inventada: se surgir fonte institucional específica, a associação será explícita e versionada (ato, vigência, proveniência); sem fonte, a leitura indica "não registrada" ou "não aplicável", conforme o contexto.

## Inventário técnico (estado atual, sem alteração)
- **Turma institucional** (`institutional_classes` + `class_at`): identidade com escola e ano letivo; não carrega etapa, ano/fase, modalidade nem jornada.
- **Oferta B2.6** (`class_offering_versions` + `class_offering_axis_values`, lida por `class_offering_at`): fato histórico da turma com **eixos abertos**, cada valor referenciando catálogo homologado. Classificação no nível da turma não substitui o fato individual de etapa/ano/fase do estudante em turma multietapas; seu papel na correspondência continua pendente (D1).
- **Cadeia B3** (inscrição → participação → alocação): **não contém fato canônico homologado de etapa/ano/fase em cada alocação**. Por isso a associação automática permanece **bloqueada** e não pode ser inferida por nome, código ou etapa agregada da turma.
- **`stageId`/`offerId` legados:** não servem; não têm contrato com os eixos abertos e com sessão são `null` (B2.7).
- **Turno B2.6** (`class_shift_at`): é horário de funcionamento e **não** equivale a jornada parcial/integral.
- **Catálogos oficiais:** todos vazios — nenhum valor homologado de oferta, turno, unidade de carga ou elemento de matriz.
- **Matrizes:** zero registradas na Cloud; nenhuma aplicabilidade gravada.

## Dados mínimos de classificação que o motor precisará
Necessidades; **nenhum existe hoje como ID canônico** e nenhum nome abaixo é enumeração do sistema:
1. **Etapa/segmento**, por alocação do estudante (com distinção de segmento quando o anexo distingue).
2. **Ano ou fase**, por alocação do estudante.
3. **Modalidade** (ex.: regular × EJA).
4. **Natureza da turma** (regular × AEE × atividade complementar), para excluir as não regulares da associação automática.
5. **Jornada**, apenas quando o anexo distingue parcial/integral (distinta de turno).

Cada um deverá ser valor homologado de catálogo, com vigência e proveniência, para que o motor só **compare** referências.

## Bloqueio concreto restante
- **Fato de etapa/ano/fase por alocação:** ausente no B3; sem ele não há base comparável e o motor é fail-closed.
- **D1 / catálogos:** não está decidido onde residem e quais eixos representam etapa/segmento, ano/fase, modalidade, natureza e jornada, nem existem valores homologados.
- **Critério de correspondência como dado:** falta homologar a tabela enquadramento → matriz (registro, ato, vigência, competência).
- **Turmas/alocações sem classificação registrada:** permanecem sem matriz (ausência sinalizada).
- Homologação da matriz construída (fluxo não decidido) e homologação da política v2 (hoje draft).

## Contrato previsto (após decisões)
Aplicação derivada (não gravada por turma): para cada estudante/alocação vigente na data, matriz = correspondência homologada vigente × classificação individual vigente (bitemporal `validOn/knownAt`). As matrizes da turma na data são a união das matrizes resolvidas para as etapas presentes.
- **Integridade por cobertura:** cada etapa presente deve ser coberta por matriz resolvida; etapa sem cobertura ⇒ ausência sinalizada (nunca default).
- **Ambiguidade por estudante×etapa×data:** zero correspondências ⇒ ausência sinalizada; duas ou mais para o mesmo estudante/etapa/data ⇒ inconsistência fail-closed, recusada também na homologação da correspondência. Várias matrizes distintas na mesma turma não são, por si, inconsistência.
- Turmas de AEE/atividade complementar não entram na associação automática regular.
- Correções posteriores não reescrevem consultas históricas; proveniência e auditoria preservadas.
