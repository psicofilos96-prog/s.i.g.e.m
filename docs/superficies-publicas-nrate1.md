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

## NRATE.2 (2026-10-09) — limite por origem: INFRAESTRUTURA_PENDENTE
- Rajada real: 200 códigos aleatórios simultâneos em `verify_school_document` (anon) em ~1,9 s ⇒ 200 respostas idênticas `nao-encontrado`; sem enumeração, mas também sem freio. Testes de regressão: 20/20.
- Por que não foi implementado: as verificações e o portal são funções do banco chamadas direto pelo navegador com a chave pública, então um limite no servidor do app seria contornado; no banco, a origem só vem de cabeçalho repassado (falsificável) e um limite por código bloquearia quem tem o documento legítimo. Contador em memória não vale (servidores sem estado). Qualquer desses seria proteção falsa.
- O que fecharia: limite por IP na borda da hospedagem/CDN (não configurável pelo repositório) ou primitiva de rate limit da plataforma. Alternativa ad hoc (tabela de contagem + rota própria no servidor do app, revogando o acesso anon direto) só com confirmação do proprietário, ciente de que conta por cabeçalho de origem.
- Mitigação vigente: códigos de 64 bits (documento) e ~40 bits (carteirinha), formato validado antes de chamar o servidor, respostas uniformes.
