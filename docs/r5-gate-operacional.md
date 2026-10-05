# R5 — Gate operacional antes de importar/homologar as 22 posições e matrizes

Estado (2026-10-04): **R5 RESOLVIDO institucionalmente e implementado no repositório**. A decisão é que `gestao-pedagogica-da-rede` (Supervisão Escolar) constrói e homologa E1–E4. A migration `0059_r5_curricular_writers_policy_v4.sql` ainda precisa ser aplicada e validada na Cloud antes de o gate técnico ser fechado. Nenhum dado curricular real foi importado e a política v4 não foi homologada.

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

A v4 nasce `draft`: 213 regras = 199 da v3 + 7 capabilities novas × {Supervisão Escolar, Administrador Geral} em `[network]`, totalizando 85 capabilities distintas. A v3 homologada permanece imutável. Uma v4 já existente só é aceita pela migration se continuar draft, sem homologação, superseder v3 e possuir exatamente o conjunto esperado.

## RPCs

E1 reutiliza `record_curricular_matrix_version` e acrescenta `homologate_curricular_matrix_version`. E2 usa `record_correspondence_profile_version` e `homologate_correspondence_profile_version`. E3 usa `record_position_matrix_correspondence_version` e `homologate_position_matrix_correspondence_version`. E4 usa `record_class_specific_matrix_association_version` e `homologate_class_specific_matrix_association_version`.

Os novos RPCs são SECURITY DEFINER com `search_path=''`, EXECUTE somente para `authenticated`, e o poder efetivo depende de capability `[network]` proveniente de política **homologada**. `anon` e `service_role` não recebem EXECUTE. Helpers internos ficam fechados.

## O que falta

1. Aplicar a 0059 e executar `r5_curricular_writers.sql` + regressões B4.2.x com rollback, verificando resíduos depois.
2. Homologar a política v4 somente quando houver **ato institucional real**; não inventar `act_ref`.
3. Comprovar a publicação da Deliberação CME nº 3/2026 para definir `valid_from`; 1º de abril de 2026 continua sendo apenas a data do ato.
4. Homologar os catálogos/valores necessários às 22 posições e os componentes curriculares.
5. Registrar/homologar as matrizes E1 e, depois, E2/E3. E4 permanece exceção explícita por turma.

Observação: enquanto v4 estiver draft, **E1 construção continua possível pela capability já homologada na v3**; E1 homologação e E2–E4 permanecem fechados.
