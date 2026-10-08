# NRATE.1 — Superfícies públicas contra abuso

## Situação atual
Classe: Registro de lote (2026-10-08). Conteúdo público não mudou; nada passou a exigir login.

## Superfícies públicas (anon)
- `verify_school_document` — código de 16 hex (64 bits); payload sem aluno, nota, saúde, endereço ou id da escola.
- `verify_student_card` — `<10 A-Z0-9>.<versão>` (~40 bits); inexistente/cancelada pedida ⇒ `indisponivel`.
- `public_portal_list/get` — só a última versão publicada; inexistente/rascunho/revogado ⇒ `indisponivel`.
- `/api/public/v1/*` — já tem limite por minuto por chave de máquina (NINT).

## Correções
- Documento: formato inválido e inexistente mostram o mesmo texto; formato fora de 16 hex não chama o servidor.
- Carteirinha: leitor do QR aceitava 4–64 caracteres; agora exige o formato do banco e normaliza maiúsculas; lixo não chama o servidor.
- Teste: `src/features/public-portal/public-codes.test.ts` (rajada de 10.000 códigos aleatórios, injeção, tamanho excessivo).

## Pendências
- DEPENDE_DECISAO: limite de requisições por IP nas verificações. A plataforma não tem mecanismo padrão de rate limit; um limite ad hoc (tabela de contagem no banco) só com confirmação do proprietário.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: abrir QR real no celular.
