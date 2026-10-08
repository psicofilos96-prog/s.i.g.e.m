# R5 — Gate operacional antes de importar/homologar as 22 posições e matrizes

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Estado (2026-10-04): **R5 RESOLVIDO institucional e tecnicamente**. `gestao-pedagogica-da-rede` (Supervisão Escolar) constrói e homologa E1–E4. `0059_r5_curricular_writers_policy_v4.sql` e o hardening append-only `0060_r5_effective_window_overlap_guards.sql` estão ativos na Cloud. As suítes R5/B4.2.1/B4.2.2a/B4.2.2b/B4.2.3 passaram com rollback e sem resíduos. `0061_owner_decision_governance.sql` homologou a v4 por **decisão do proprietário** (`homologation_origin='decisao-do-proprietario'`, sem `act_ref`, vigência desde 2026-10-04): as 7 capabilities R5 estão efetivas. Nenhum dado curricular real foi importado.

## Capabilities

| Conceito | Capability |
|---|---|
| E1 construir versão de matriz | `manter-matrizes-curriculares` (já existente na v3) |
| E1 homologar versão de matriz | `homologar-matrizes-curriculares` |
| E2 construir perfil | `manter-perfis-correspondencia-curricular` |
| E2 homologar perfil | `homologar-perfis-correspondencia-curricular` |
| E3 construir correspondência posição→matriz | `manter-correspondencias-posicao-matriz` |
| E3 homologar correspondência | `homologar-correspondencias-posicao-matriz` |
| E4 construir associação específica | `manter-associacoes-especificas-matriz` |
| E4 homologar associação | `homologar-associacoes-especificas-matriz` |

A v4 nasceu `draft` e hoje está homologada: 213 regras = 199 da v3 + 7 capabilities novas × {Supervisão Escolar, Administrador Geral} em `[network]`, totalizando 85 capabilities distintas. A v3 homologada permanece imutável. Uma v4 já existente só é aceita pela migration se continuar draft, sem homologação, superseder v3 e possuir exatamente o conjunto esperado.

## RPCs

E1 reutiliza `record_curricular_matrix_version` e acrescenta `homologate_curricular_matrix_version`. E2 usa `record_correspondence_profile_version` e `homologate_correspondence_profile_version`. E3 usa `record_position_matrix_correspondence_version` e `homologate_position_matrix_correspondence_version`. E4 usa `record_class_specific_matrix_association_version` e `homologate_class_specific_matrix_association_version`.

Os novos RPCs são SECURITY DEFINER com `search_path=''`, EXECUTE somente para `authenticated`, e o poder efetivo depende de capability `[network]` proveniente de política **homologada**. `anon` e `service_role` não recebem EXECUTE. Helpers internos ficam fechados.

## O que falta

1. Comprovar a publicação da Deliberação CME nº 3/2026 para definir `valid_from`; 1º de abril de 2026 continua sendo apenas a data do ato.
2. D1/R1–R3 fechados (ver `docs/b4-2-d1-catalogo-proposto-22-posicoes.md`); pendente R4. Importar pela tela governada e homologar os catálogos/valores necessários às 22 posições, natureza/jornada quando aplicáveis, além dos componentes curriculares.
3. Registrar/homologar as matrizes E1 e, depois, E2/E3. E4 permanece exceção explícita por turma.

O teste R5 usa exclusivamente a turma sintética criada na própria transação; não seleciona turma arbitrária existente. Isso é requisito para continuar seguro quando a Cloud passar a conter escolas/turmas reais.

## Governança (decisão do proprietário, 2026-10-04)

A decisão expressa do proprietário/desenvolvedor do SIGEM governa construção, ativação e homologação internas; nenhuma Portaria, Decreto, Resolução ou "ato institucional" é pré-condição genérica. Documentos oficiais são registrados somente quando forem **fonte material** do conteúdo (ex.: deliberação que define uma matriz), como referência documental opcional (`homologation_act_ref`, `originating_act_ref`, `specific_act_ref` agora anuláveis; texto em branco continua recusado). Capability, escopo, vigência (`effective_from`/`valid_from`), motivo, cabeça esperada e append-only continuam obrigatórios.
