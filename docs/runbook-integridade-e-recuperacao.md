# Runbook — integridade, continuidade e recuperação (AW)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Registro técnico, não fonte normativa. Nenhum procedimento aqui apaga dado real, reescreve migration histórica ou contorna writer.

## Estado de backup/restauração
- **PLATFORM_BACKUP_RESTORE_VALIDATION_PENDING.** Backups do banco são responsabilidade da plataforma (Lovable Cloud). O projeto não tem acesso para disparar nem testar uma restauração; nenhuma restauração foi testada. Não afirmar o contrário.
- Exportação de dados: Cloud → Advanced settings → Export data (pela plataforma). Nenhum dump com PII é guardado no repositório; exportações da Central de Relatórios seguem a ACL do reader e **não** são backup.

## Verificações de integridade
- Puras e testadas com dados sintéticos: `src/features/support/integrity-checks.ts` (cadeia de versões, head único, predecessor órfão, vigência impossível, referência órfã, fingerprint SHA-256, drift de migrations).
- Drift de migrations: manifesto `src/test/invariants/migration-hashes.json` + invariantes (`test` e `test:deep`); divergência falha o CI, nunca é "corrigida".
- Execução real (2026-10-06, só leitura): 55 versões cadastrais de escola, 0 predecessores órfãos, 55 cadeias com head único; 1 estado de ano sem sequência duplicada; tabelas versionadas de AEE/inclusão/restrições/ofertas/turnos/participações/capacidade/autorização vazias (nada a verificar).

## Procedimentos
1. **Migration falhou ao aplicar:** a ferramenta desfaz o arquivo e o journal; nada fica aplicado. Corrigir o SQL e reaplicar como nova chamada. Nunca editar migration já aplicada.
2. **Deploy incompatível com o banco:** o banco recebe migrations antes da publicação e não há staging. Corrigir por migration aditiva compatível com a versão publicada (nova coluna/função; a antiga fica como DEPRECATED). Republicar a versão anterior do app pelo histórico de versões da plataforma, quando disponível.
3. **Importação interrompida:** staging é imutável e único por adaptador+versão+hash; reenviar o mesmo arquivo é idempotente. Nada é aplicado sem confirmação humana; lote incompleto não vira fato.
4. **Writer com bug:** suspender o uso na tela (sem alterar ACL para "abrir"), corrigir com nova versão da função por migration (`search_path=''`), e registrar correções de fatos como nova versão append-only pelo próprio writer, com justificativa. Nunca UPDATE/DELETE direto.
5. **Corrupção lógica detectada:** registrar o achado (check, chave, horário, código `op-…`), não corrigir em silêncio. Diagnosticar com consultas somente leitura; corrigir por versão nova via writer canônico ou migration aditiva revisada.
6. **Rollback de release:** código — restaurar versão anterior pelo histórico da plataforma. Banco — não há rollback de migration; só forward-fix aditivo.
