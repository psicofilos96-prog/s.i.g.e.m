# B4.2 — Turma → Matriz (planejamento; NÃO iniciada)

Nenhum schema, código ou dado criado. Consome `curricular_matrices_at` (B4.1).

## Decidido
- **D2 (cardinalidade temporal):** "Só existe uma matriz vigente, nunca mais de uma" — para cada turma e data, nunca mais de UMA matriz vigente. Obrigatoriedade de haver matriz para toda turma/data **não decidida** (a aplicação automática abaixo vale para turmas enquadradas). Ausência nunca é preenchida por default e a leitura a sinaliza.
- **Origem normativa:** matrizes vêm de deliberação (proveniência: Deliberação CME nº 3/2026 de Itaperuna, art. 1º–2º, Anexos I–V); construção no SIGEM pela Supervisão Escolar; alterações por nova deliberação preservando versão, vigência, ato e histórico. `gestao-pedagogica-da-rede` é a atuação da Supervisão Escolar (D4 reconciliada, sem alteração de política). Cada versão pode trazer o quadro do anexo (B4.1.2).
- **D2-aplicação (decisão do usuário, 2026-10-03):** a matriz normativa é aplicada **automaticamente a todas as turmas conforme o seu enquadramento**, sem vínculo manual por turma. Correspondência declarada pelo usuário para a deliberação vigente:
  - Educação Infantil → matriz da Educação Infantil;
  - Ensino Fundamental regular, 1º ao 5º ano → Anexo EF 1º segmento;
  - Ensino Fundamental regular, 6º ao 9º ano → Anexo EF 2º segmento;
  - EJA, fases I a V → Anexo EJA 1º segmento;
  - EJA, fases VI a IX → Anexo EJA 2º segmento;
  - e equivalentes conforme deliberações futuras.

  Essa correspondência é **norma configurada**, não código: deve ser registrada como dado versionado (com ato e vigência) que relaciona valores de classificação a uma matriz, para que nova deliberação mude a correspondência sem alterar o motor. Nenhum valor desta lista foi cadastrado nem fixado como enumeração.

## Inventário técnico (estado atual, sem alteração)
- **Turma institucional** (`institutional_classes` + `class_at`): identidade com escola e ano letivo; não carrega etapa, ano/fase, modalidade nem jornada.
- **Oferta B2.6** (`class_offering_versions` + `class_offering_axis_values`, lida por `class_offering_at`): fato histórico próprio da turma com **eixos abertos**, cada valor referenciando catálogo homologado (`homologated_attribute_values`). É o lugar técnico previsto para a classificação, mas nenhum eixo tem significado normativo fixado.
- **`stageId`/`offerId` legados:** não servem; não têm contrato com os eixos abertos da Oferta e com sessão são `null` (B2.7).
- **Turno B2.6** (`class_shift_at`): é horário de funcionamento (ex.: manhã/tarde) e **não** equivale a jornada parcial/integral.
- **Catálogos oficiais:** todos vazios — nenhum valor homologado de oferta, turno, unidade de carga ou elemento de matriz.
- **Matrizes:** zero registradas na Cloud; nenhuma aplicabilidade gravada.

## Dados mínimos de classificação que o motor precisará
Listados como necessidades; **nenhum existe hoje como ID canônico** e nenhum nome abaixo é enumeração do sistema:
1. **Etapa/segmento** (ex.: Educação Infantil, Ensino Fundamental, com distinção de segmento quando o anexo distingue).
2. **Ano ou fase** da turma (ex.: ano do EF; fase da EJA; agrupamento da EI quando o anexo distingue colunas).
3. **Modalidade** (ex.: regular × EJA).
4. **Jornada**, apenas quando o anexo distingue parcial/integral (distinta de turno).

Cada um deverá ser valor homologado de catálogo (eixo da Oferta B2.6 ou equivalente decidido), com vigência, para que o motor só **compare** referências — sem conhecer etapa, modalidade ou ano.

## Bloqueio concreto restante
- **D1 / catálogos:** não está decidido **quais eixos** da Oferta representam etapa/segmento, ano/fase, modalidade e jornada, nem existem valores homologados para eles. Sem isso, nenhuma turma tem enquadramento comparável e o motor não pode aplicar matriz alguma (fail-closed).
- **Correspondência como dado:** falta homologar a tabela enquadramento → matriz (registro, ato, vigência e competência de quem a mantém).
- **Turmas sem Oferta registrada:** permanecem sem matriz (ausência sinalizada), até haver Oferta.
- Homologação da matriz construída (fluxo não decidido) e homologação da política v2 (hoje draft).

## Contrato previsto (após decisões)
Aplicação derivada (não gravada por turma): matriz da turma na data = correspondência homologada vigente × Oferta vigente da turma (`class_offering_at`, bitemporal). Zero correspondências ⇒ ausência sinalizada; duas ou mais ⇒ inconsistência fail-closed (D2), recusada também na homologação da correspondência por sobreposição. Correções posteriores não reescrevem consultas históricas.
