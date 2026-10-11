# Secretaria Escolar — Lote 2/4 (documentos e escrituração)

Situação atual: Registro de lote (2026-10-11).

## Já existente (não refeito)
- Studio de documentos (`/central-de-documentos`, `document-studio/`): modelo declarativo versionado, homologação, emissão congelada com hash, PDF A4 (`print-layout`), verificação pública `/verificar/documento/$codigo`.
- Emissão escolar só por `emit_school_document_v3` (idempotente); prontidão por documento em `document-readiness.ts`; GED (`ged-core.ts`); DocServ (`/docserv`); Livro de matrícula (`/secretaria/livro-matricula`); Diário (`/diario/livro`).

## Novo
- `src/features/school-secretariat/registry-books.ts` (+4 testes): livros de matrícula, resultados finais, atas e transferências; lançamento só de fato canônico da própria escola, com data e campos exigidos (nunca nota/data ausente); fechamento com hash; retificação anexada com motivo, preservando o original.

## Lacunas
- Tabelas e tela dos livros de escrituração: não criadas.
- Modelos oficiais de histórico, boletim, ficha individual, ata, atestado, ofício e recibo: aguardam texto da rede; só 2 tipos compostos no banco (declaração de matrícula e declaração escolar).
- Dados para resultados finais e atas: 0 fechamentos e 0 atas do Conselho registrados.
- Assinatura qualificada ICP-Brasil: não disponível; só assinatura simples rotulada.
- Testes de PDF em navegador e permissões escola A/B autenticados: não executados (sem conta sintética).
