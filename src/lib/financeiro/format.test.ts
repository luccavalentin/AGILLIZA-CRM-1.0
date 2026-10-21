import { describe, expect, it } from "vitest";
import { formatData, somarMesesISO } from "./format";

describe("somarMesesISO", () => {
  it("mantém o dia quando ele existe no mês de destino", () => {
    expect(somarMesesISO("2026-10-15", 1)).toBe("2026-11-15");
    expect(somarMesesISO("2026-10-15", 3)).toBe("2027-01-15");
  });
  it("usa o último dia do mês quando o dia não existe", () => {
    expect(somarMesesISO("2026-10-31", 1)).toBe("2026-11-30");
    expect(somarMesesISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMesesISO("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMesesISO("2026-10-31", 2)).toBe("2026-12-31");
  });
  it("zero meses devolve a própria data", () => {
    expect(somarMesesISO("2026-10-31", 0)).toBe("2026-10-31");
  });
});

describe("formatData", () => {
  it("data civil é lida como está, sem deslocar o dia", () => {
    expect(formatData("2026-08-01")).toBe("01/08/2026");
  });
  it("vazio vira travessão", () => {
    expect(formatData(null)).toBe("—");
    expect(formatData("")).toBe("—");
  });
});
