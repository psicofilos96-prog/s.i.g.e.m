# Infraestrutura escolar — fatos versionados (Frente B, migration 0105)

## Modelo
- `school_infrastructure_attribute_versions`: registry aberto (attribute_id, label, value_type boolean/integer/decimal/text/catalog, catalog_values, unit_label, source_field). Versões append-only; mudar tipo é recusado.
- `school_infrastructure_observations`: um valor tipado por (escola, atributo, valid_from, known_at), com source_hash, source_ref, source_locator e técnica ou autoria humana. Idempotência: único (source_hash, school_id, attribute_id, valid_from). Mesma chave com valor diferente é recusada.
- Sem observação = **não informado**. `false` e `0` são valores gravados. O núcleo recusa `null`.
- Nenhuma coluna rígida foi adicionada a `institutional_schools`. As colunas antigas own_building/hard_access/classroom_count continuam NULL.

## Caminhos de gravação
- Humano: `record_school_infrastructure_attribute` / `record_school_infrastructure_observation` (sessão + `manter-cadastro-unidade-escolar` em rede).
- Técnico: `technical_import_educacenso_2026_infrastructure(kind, source_hash, 2026-08-31, payload)`. Exige automação ligada, hash válido, manifesto coerente, escolas `inep-<INEP>` existentes, sem INEP+atributo duplicado e atributo declarado. É gravado no ledger 0100, e o retry é idempotente.
- Os dois caminhos usam os mesmos núcleos `school_infrastructure_*_core`. Nenhum role do app executa os núcleos nem a operação técnica, e não há DML direto.

## Preparação do payload
`src/features/schools/school-infrastructure.ts` (`buildInfrastructurePreview`): perfil, mapeamento, validação, erros por linha e contagens por escola e atributo. Célula vazia vira não informado. Rejeita escola inexistente, INEP duplicado, atributo desconhecido e valor fora do catálogo.

## Estado da carga real
**BLOQUEADA POR FONTE AUSENTE.** O ambiente do agente não recebeu os bytes de:
- Aspectos_Infraestrutura_municipais.xlsx
- Aspectos_Infraestrutura_conveniadas.xlsx
- Censo_Escolar_2026_Preliminar_Itaperuna.xlsx

Nenhum valor foi inventado. Quando os arquivos forem enviados: perfil das colunas → declaração dos atributos (sem PII de gestor/informante) → prévia → chamada da operação técnica com o SHA-256 do conjunto. Planilha bruta não é versionada.

## Prova
`supabase/tests/b2_1_4_school_infrastructure.sql` (termina em RAISE, com rollback) cobre: hash inválido, manifesto divergente, contagem, escola inexistente, duplicidade, atributo desconhecido, primeira carga, false/0/ausente, ausência de autoria humana, retry idempotente, payload divergente, mudança entre snapshots, catálogo, null, append-only, ledger imutável, privilégios e automação desabilitada.
