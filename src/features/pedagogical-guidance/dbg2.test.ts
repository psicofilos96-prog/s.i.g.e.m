import { it } from "vitest";
import { buildGuidanceWorkspaceProjection } from "/dev-server/src/features/pedagogical-guidance/guidance-workspace";
it("dbg", () => {
  const p = buildGuidanceWorkspaceProjection();
  console.log(p.authorizedItems.map(i=>[i.factKey,i.sensitivityLevelDefinitionId]));
  console.log(p.diagnostics);
});
