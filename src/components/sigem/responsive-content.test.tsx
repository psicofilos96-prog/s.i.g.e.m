import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DefinitionList, InformationPair } from "./operational";
import { SectionHeader, StatusBadge } from "./patterns";

const LONG_SCHOOL =
  "Escola Municipal Demonstrativa de Educação Infantil e Ensino Fundamental Professora Exemplo de Nome Institucional Muito Longo";
const LONG_FIELD =
  "Componente curricular demonstrativo de Linguagens, Produção Textual e Práticas Integradas de Leitura";
const LONG_PROFESSIONAL =
  "Profissional Demonstrativo com Nome Civil Excepcionalmente Longo para Validação Responsiva";

describe("conteúdo extremo no Design System", () => {
  it("usa o padrão responsivo compartilhado para rótulo e valor", () => {
    const { container } = render(
      <dl className="info-list">
        <InformationPair label="Componente/campo" value={LONG_FIELD} />
      </dl>,
    );

    expect(screen.getByText(LONG_FIELD)).toBeVisible();
    expect(container.querySelector("dl")).toHaveClass("info-list");
    expect(container.querySelector(".information-pair")).toBeInTheDocument();
    expect(screen.getByText(LONG_FIELD)).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
  });

  it("preserva listas com rótulos, escolas e profissionais multilinha", () => {
    render(
      <DefinitionList
        items={[
          { term: "Nome institucional completo da unidade escolar", detail: LONG_SCHOOL },
          { term: "Profissional responsável", detail: LONG_PROFESSIONAL },
        ]}
      />,
    );

    expect(screen.getByText(LONG_SCHOOL)).toBeVisible();
    expect(screen.getByText(LONG_PROFESSIONAL)).toBeVisible();
  });

  it("mantém ação e badge extensos íntegros", () => {
    render(
      <>
        <SectionHeader
          title={LONG_SCHOOL}
          description={LONG_FIELD}
          action={<Button>{`Abrir registro de ${LONG_PROFESSIONAL}`}</Button>}
        />
        <StatusBadge tone="warning">Consulta histórica com validação institucional pendente</StatusBadge>
        <Badge>Estado demonstrativo excepcionalmente detalhado</Badge>
      </>,
    );

    expect(screen.getByRole("button", { name: /abrir registro/i })).toBeVisible();
    expect(screen.getByText(/consulta histórica com validação/i)).toBeVisible();
    expect(screen.getByText(/estado demonstrativo excepcionalmente/i)).toBeVisible();
  });
});