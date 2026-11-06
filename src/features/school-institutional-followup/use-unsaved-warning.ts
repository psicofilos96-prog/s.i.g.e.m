import { useEffect } from "react";

/**
 * Alerta nativo em fechamento/recarregamento da aba.
 * Não armazena conteúdo em localStorage, sessionStorage nem outro cache local.
 * Navegação entre rotas SPA continua dependendo de bloqueio próprio do roteador.
 */
export function useUnsavedFollowupWarning(shouldWarn: boolean): void {
  useEffect(() => {
    if (!shouldWarn) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // O navegador escolhe o texto do diálogo; mensagens personalizadas são ignoradas.
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldWarn]);
}
