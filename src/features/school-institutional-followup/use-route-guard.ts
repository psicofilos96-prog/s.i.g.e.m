import { useBlocker } from "@tanstack/react-router";
import { confirmAction } from "@/components/sigem/confirm-action";

/**
 * Proteção de navegação interna, em complemento ao alerta beforeunload.
 * Não armazena dados do formulário e não bloqueia a leitura do Gabinete.
 */
export function useFollowupRouteGuard(hasUnsavedChanges: boolean, isSubmitting = false): void {
  useBlocker({
    shouldBlockFn: async () => {
      // Nunca oferecer descarte durante envio ativo: a RPC pode já estar confirmando.
      if (isSubmitting) return true;
      if (!hasUnsavedChanges) return false;
      try {
        const discard = await confirmAction({
          title: "Sair do acompanhamento sem salvar?",
          consequence: "Existem informações ou registros em andamento nesta ficha. Sair agora pode descartar o preenchimento ainda não registrado.",
          actionLabel: "Sair e descartar",
          destructive: true,
        });
        return !discard;
      } catch {
        // Na ausência de confirmação funcional, preservar os registros em edição.
        return true;
      }
    },
    // O beforeunload é instalado separadamente pelo hook já existente:
    // não registrar dois listeners para o mesmo evento.
    enableBeforeUnload: false,
  });
}
