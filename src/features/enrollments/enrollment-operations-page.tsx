import { OperationsConsole } from "@/components/sigem/operations-console";
import { OPERATION_STAGES } from "./enrollment-operations";
import { ENROLLMENT_LOOKUPS } from "./enrollment-lookups";

export function EnrollmentOperationsPage() {
  return (
    <OperationsConsole ns="op-matr" eyebrow="Matrículas" title="Central de matrículas" stages={OPERATION_STAGES} lookups={ENROLLMENT_LOOKUPS}
      description="Organize campanhas, confira inscrições, acompanhe protocolos, distribua vagas, confirme pedidos e encaminhe alunos para as turmas. O sistema confere sua autorização antes de salvar cada alteração." />
  );
}
