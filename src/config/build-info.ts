// Identificação da versão em execução. Só dados públicos (commit curto e data de build);
// nunca segredo. Ausência => "desconhecido", nunca valor inventado.
declare const __SIGEM_COMMIT__: string | undefined;
declare const __SIGEM_BUILT_AT__: string | undefined;

export const BUILD_INFO = {
  commit: (typeof __SIGEM_COMMIT__ !== "undefined" && __SIGEM_COMMIT__) || "desconhecido",
  builtAt: (typeof __SIGEM_BUILT_AT__ !== "undefined" && __SIGEM_BUILT_AT__) || "desconhecida",
} as const;

export function buildLabel(): string {
  return `SIGEM · versão ${BUILD_INFO.commit} · build ${BUILD_INFO.builtAt}`;
}
