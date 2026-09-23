import { expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

it("dbg", async () => {
  const user = userEvent.setup();
  renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
  const cb = await screen.findByRole("combobox", { name: "Tipo de contexto organizacional" });
  await user.click(cb);
  console.log(document.body.innerHTML.slice(0, 500));
  console.log("OPTIONS", screen.queryAllByRole("option").length, cb.outerHTML.slice(0,300));
  expect(true).toBe(true);
});
