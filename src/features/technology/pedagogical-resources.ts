// L20 Tecnologia — catálogo e avaliação de recursos pedagógicos digitais (0493). Recurso = serviço L15 vigente
// com público estudantes/professores; avaliação só contra a rubrica aprovada vigente. Nada é gravado aqui.
import { catalog, lgpdAttention, type Approval, type ServiceVersion } from "./digital-catalog";

export interface Evaluation { serviceVersionId: string; rubricVersionId: string; verdict: "recomendado" | "recomendado-com-ressalvas" | "nao-recomendado"; personId: string; createdAt: string }

export function pedagogicalCatalog(vs: readonly ServiceVersion[], as: readonly Approval[], evals: readonly Evaluation[], currentRubricId: string | null) {
  return catalog(vs, as)
    .filter((e) => e.approved && e.status !== "descontinuado" && (e.audience.includes("estudantes") || e.audience.includes("professores")))
    .map((e) => {
      // Só avaliações da versão vigente do recurso e da rubrica vigente; mudou o recurso ou a rubrica ⇒ "sem avaliação vigente".
      const cur = evals.filter((x) => x.serviceVersionId === e.id && x.rubricVersionId === currentRubricId);
      const count = (v: Evaluation["verdict"]) => cur.filter((x) => x.verdict === v).length;
      return {
        serviceKey: e.serviceKey, name: e.name,
        evaluations: cur.length,
        recomendado: count("recomendado"), ressalvas: count("recomendado-com-ressalvas"), naoRecomendado: count("nao-recomendado"),
        // Divergência é mostrada, nunca resolvida por média.
        divergent: new Set(cur.map((x) => x.verdict)).size > 1,
        situation: cur.length === 0 ? "sem avaliação vigente" : "avaliado",
        lgpdAttention: lgpdAttention(e),
      };
    });
}
