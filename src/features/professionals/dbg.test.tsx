import { expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

it("dbg0", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
  const cb = await screen.findByRole("combobox", { name: "Tipo de contexto organizacional" });
  await user.click(cb);
  console.log("A", screen.queryAllByRole("option").length);
  expect(true).toBe(true);
});

it("dbgkb", async () => {
  const user = userEvent.setup();
  renderOperationalRoutes("/profissionais/pro-008/vinculos/vf-008-b/lotacoes/nova");
  console.log("PE", JSON.stringify(document.body.style.pointerEvents), document.body.outerHTML.slice(0,200));
  const cb = await screen.findByRole("combobox", { name: "Tipo de contexto organizacional" });
  fireEvent.pointerDown(cb, { pointerType: "mouse", button: 0, ctrlKey: false });
  console.log("C", screen.queryAllByRole("option").length);
  await user.click(screen.getByRole("option", { name: "Unidade escolar" }));
  const dest = screen.getByRole("combobox", { name: "Unidade ou contexto organizacional" });
  fireEvent.keyDown(dest, { key: "Enter" });
  console.log("B", screen.queryAllByRole("option").length);
  expect(true).toBe(true);
});
