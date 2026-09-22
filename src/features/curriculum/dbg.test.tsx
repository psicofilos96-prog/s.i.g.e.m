import { describe, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderOperationalRoutes } from "@/test/router-harness";

describe("dbg", () => {
  it("workspace", async () => {
    renderOperationalRoutes("/matrizes-curriculares/nova-versao/mc-ef2-2");
    await new Promise((r) => setTimeout(r, 300));
    console.log(document.body.textContent?.slice(0, 900));
    screen.debug(undefined, 0);
  });
});
