// Identificação da versão em execução. Só dados públicos (commit curto e data de build);
// nunca segredo. Ausência => "desconhecido", nunca valor inventado.
declare const __SIGEM_APP_VERSION__: string | undefined;
declare const __SIGEM_COMMIT__: string | undefined;
declare const __SIGEM_BUILT_AT__: string | undefined;

export const BUILD_INFO = {
  appVersion: (typeof __SIGEM_APP_VERSION__ !== "undefined" && __SIGEM_APP_VERSION__) || "não definida",
  commit: (typeof __SIGEM_COMMIT__ !== "undefined" && __SIGEM_COMMIT__) || "desconhecido",
  builtAt: (typeof __SIGEM_BUILT_AT__ !== "undefined" && __SIGEM_BUILT_AT__) || "desconhecida",
} as const;

export function buildLabel(): string {
  return `SIGEM · versão ${BUILD_INFO.commit} · build ${BUILD_INFO.builtAt}`;
}

/** Versão do esquema = nome da última migration do repositório (ordem lexical = ordem de aplicação). */
export function schemaVersion(migrationPaths: readonly string[]): string {
  const names = migrationPaths.map((p) => p.split("/").pop() ?? "").filter((n) => n.endsWith(".sql")).sort();
  return names.length ? names[names.length - 1]!.replace(/\.sql$/, "") : "desconhecida";
}
