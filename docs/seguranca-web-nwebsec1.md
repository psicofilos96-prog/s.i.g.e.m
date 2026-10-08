# Segurança do frontend e cabeçalhos — NWEBSEC.1

## Situação atual
Registro de lote (2026-10-08).

- Cabeçalhos aplicados pelo próprio app (`src/lib/security-headers.ts`, middleware em `src/start.ts`) a páginas públicas e internas: `frame-ancestors` (só o próprio site e o editor/preview da plataforma podem embutir — clickjacking), `object-src 'none'`, `base-uri 'self'`, `upgrade-insecure-requests`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (geolocalização, microfone, pagamento, USB desligados; câmera mantida para a foto do estudante).
- Cache: páginas HTML, JSON e funções do servidor saem com `private, no-store`; arquivos estáticos não mudam.
- CSP de script NÃO aplicada: a montagem da página injeta scripts inline sem nonce; aplicar quebraria o app. PENDENTE técnico de suporte da plataforma.
- Mixed content: nenhum endereço `http://` no código. Links externos: nenhum `target="_blank"` em âncora; arquivos privados abrem com `noopener`; janelas de impressão são páginas em branco do próprio site.
- Fora do repositório (não alterado): HSTS e cabeçalhos da hospedagem/CDN.
- Testes: `src/lib/security-headers.test.ts`; conferido por requisição em `/`, `/auth`, `/alunos`, `/publico/x` e no navegador sem erro de página.
