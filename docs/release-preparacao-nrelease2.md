# NRELEASE.2 — Preparação de release do HEAD (sem publicar)

## Situação atual
Classe: Registro de lote (2026-10-08). Atualiza `release-checklist-nrelease1.md` (que segue Referência vigente para o checklist). **Nada publicado, 2027 não aberto, produção não iniciada.** Sem segredos.

## Instantâneo gerado (`node scripts/release-report.mjs`)

- Commit: 4fff607c · data do commit: 2026-10-08T21:08:03Z
- Versão do app: não definida (DEPENDE_DECISAO)
- Esquema: 300 migrations (251 drizzle + 49 supabase), última 0250_ndb4_drop_exact_duplicate_indexes_revoke_deprecated_install.sql
- Manifesto congelado: 300 hashes; fora do manifesto: nenhuma
- Migrations com DROP TABLE/COLUMN ou RENAME (histórico, revisar se novas): nenhuma
- Pastas privadas esperadas (NFILE.2 + migrations; conferir privacidade com o script NFILE.2): fotos-estudantes, inclusao-sensivel, planejamento-docente, avaliacao-docente, alimentacao-evidencias
- Arquivos de teste: 466 · documentos: 246 · arquivos em src/assets: 5

Gates a anexar: `npm run verify` (PASS/FAIL/NOT RUN por etapa) e `SIGEM_DEEP=1`.
Nada foi publicado; 2027 não foi aberto; produção não iniciada.


## Resultado dos gates (`npm run verify`)
- PASS: índice da documentação, integridade de migrations, tipos, suíte completa, invariantes profundas, acessibilidade, SQL de segurança, segredos no código, diferenças, PDFs, verificações de dados (CAL.COUNT.1 200 dias), build de produção, smoke de rotas.
- NOT RUN: harness institucional (credencial técnica) e telas por estação no navegador com login.
- Veredito: **PASS PARCIAL**.
- Corrigido neste lote antes do PASS: erro de tipo em `AbsenceState` (NEMPTY.3) e trilha de navegação (NNAV.2) quebrando telas sem provedor de consultas (testes de Unidades).

## Changelog técnico
`bun run release:notes <commit-da-última-homologação>`; lotes desde NRELEASE.1: NPERM.4, NEMPTY.3, NNAV.2, NASSET.2, NBUNDLE.2, NDEP.2, NDOCS.3 (detalhes em cada documento do mapa).

## Checklist (estado no HEAD)
- Migrations: 300 congeladas, nenhuma fora do manifesto; última 0250 (só remove índices idênticos e revoga EXECUTE) — compatível com o app publicado.
- Storage: 5 pastas privadas esperadas; privacidade conferida em NFILE.2 (revalidar com o script antes da homologação).
- Segurança: anon sem privilégio de tabela (NSEC.4, guardado por NTEST.4); 25 avisos RLS_EXPOSURE aguardam decisão.
- Assets: 5 arquivos em `src/assets`, todos referenciados (NASSET.2).
- Rollback: app = restaurar versão anterior pelo histórico; banco = forward-fix; restauração de backup completo: INFRAESTRUTURA_PENDENTE.

## Pendências não técnicas
- DEPENDE_DECISAO: numeração de versão do app; regras do Mapa; catálogo rota → capacidade de leitura; avisos RLS_EXPOSURE.
- DEPENDE_DADO: formatos oficiais (matrícula Educacenso, GPE, DP); origem da foto do Cristo de Itaperuna.
- TEMPLATE_INSTITUCIONAL_PENDENTE: documentos da Secretaria/PEI/PAEE.
- ASSIGNMENT_PENDING: perfis sintéticos de Supervisão/Avaliação/Alimentação.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: roteiro com login real.
- Abertura de 2027 e início de produção: decisão do proprietário, fora deste lote.
