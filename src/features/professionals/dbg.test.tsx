import { expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

it("dbg", async () => {
  const user = userEvent.setup();
  renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
  const cb = await screen.findByRole("combobox", { name: "Tipo de contexto organizacional" });
  await user.click(cb);
  await user.click(screen.getByRole("option", { name: "Unidade escolar" }));
  const dest = screen.getByRole("combobox", { name: "Unidade ou contexto organizacional" });
  console.log("DISABLED", dest.getAttribute("disabled"), dest.getAttribute("data-disabled"));
  await user.click(dest);
  console.log("OPTIONS2", screen.queryAllByRole("option").length);
  expect(true).toBe(true);
});
