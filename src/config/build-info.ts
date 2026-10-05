// Identificação da versão em execução. Só contém dados públicos (commit curto e data de build);
// nunca segredo. Ausência => "desconhecida", nunca valor inventado.
export const BUILD_INFO = {
  commit: (import.meta.env.VITE_APP_COMMIT as string | undefined) || "desconhecido",
  builtAt: (import.meta.env.VITE_APP_BUILT_AT as string | undefined) || "desconhecida",
} as const;

export function buildLabel(): string {
  return `SIGEM · versão ${BUILD_INFO.commit} · build ${BUILD_INFO.builtAt}`;
}
