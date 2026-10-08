// NWEBSEC.1 — cabeçalhos de segurança aplicados pelo próprio app a toda resposta.
// Sem CSP de script: o SSR do TanStack injeta scripts inline de hidratação, e uma
// CSP sem nonce quebraria o app. frame-ancestors limita quem pode embutir o SIGEM
// (o próprio site e o editor/preview da plataforma).
export const FRAME_ANCESTORS = "'self' https://lovable.dev https://*.lovable.dev https://*.lovable.app";

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": `frame-ancestors ${FRAME_ANCESTORS}; object-src 'none'; base-uri 'self'; upgrade-insecure-requests`,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

/** Páginas e funções do servidor podem carregar dado privado: nunca guardar em cache compartilhado. */
export function cacheControlFor(pathname: string, contentType: string | null): string | null {
  if (pathname.startsWith("/_serverFn") || /text\/html|application\/json/.test(contentType ?? "")) {
    return "private, no-store";
  }
  return null;
}

export function withSecurityHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  const cache = cacheControlFor(pathname, headers.get("content-type"));
  if (cache) headers.set("Cache-Control", cache);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
