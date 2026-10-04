import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CalendarApplicabilityPanel } from "./calendar-applicability-panel";
import { projectCalendars2027 } from "./calendar-store";
import { saveCentralCalendar, type CentralEntry } from "./calendar-central";

vi.mock("./calendar-central", async (original) => ({
  ...await original<typeof import("./calendar-central")>(),
  readApplicabilityOptions: vi.fn().mockResolvedValue({ schools:[{schoolId:"school",name:"Escola registrada",active:true}],
    axisValues:[{schemeId:"axis",valueId:"value",version:1,label:"Etapa homologada"}],pending:null,scopes:[] }),
  saveCentralCalendar: vi.fn().mockResolvedValue({version:2}),
}));

it("combina a etapa e a escola no mesmo recorte, sem criar dois recortes alternativos", async () => {
  const cal=projectCalendars2027()[0]!;
  const entry={sourceKey:cal.id,latest:{versionId:"v1"}} as CentralEntry;
  render(<CalendarApplicabilityPanel entry={entry} cal={cal} unsaved={false} onSaved={vi.fn()} />);
  const value=await screen.findByLabelText("Vale para");
  fireEvent.change(value,{target:{value:"valor|axis|value|1"}});
  fireEvent.change(screen.getByLabelText("Limitar também à escola (opcional)"),{target:{value:"school"}});
  fireEvent.click(screen.getByRole("button",{name:"Adicionar"}));
  fireEvent.click(screen.getByRole("button",{name:"Gravar onde o calendário vale"}));
  await waitFor(()=>expect(saveCentralCalendar).toHaveBeenCalled());
  const scopes=vi.mocked(saveCentralCalendar).mock.calls[0]![0].applicability!;
  expect(scopes).toHaveLength(1);
  expect(scopes[0]!.conditions).toEqual([
    {kind:"valor-de-eixo",scheme_id:"axis",value_id:"value",value_version:1},
    {kind:"escola",school_id:"school"},
  ]);
});
