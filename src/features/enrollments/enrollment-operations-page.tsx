import { OperationsConsole } from "@/components/sigem/operations-console";
import { OPERATION_STAGES } from "./enrollment-operations";
import { ENROLLMENT_LOOKUPS } from "./enrollment-lookups";

export function EnrollmentOperationsPage() {
  return (
    <OperationsConsole ns="op-matr" eyebrow="Matrículas" title="Central operacional de matrículas" stages={OPERATION_STAGES} lookups={ENROLLMENT_LOOKUPS}
      description="Campanhas, conferência, protocolo, classificação, distribuição, reservas, listas, confirmação, recursos, enturmação e transferências. Toda gravação passa pelo writer do banco, que confere sua permissão, a sequência e a autoria." />
  );
}
