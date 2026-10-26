import { describe, expect, it } from "vitest";
import { periodoDoAtalho, periodoValido, somarDias } from "./periodo";

describe("períodos do Financeiro do ImobMatch", () => {
  it("este mês, mês passado (inclusive virada de ano), 90 dias e este ano", () => {
    expect(periodoDoAtalho("mes", "2026-10-28")).toEqual({ de: "2026-10-01", ate: "2026-10-28" });
    expect(periodoDoAtalho("mes_passado", "2026-10-28")).toEqual({
      de: "2026-09-01",
      ate: "2026-09-30",
    });
    expect(periodoDoAtalho("mes_passado", "2026-01-05")).toEqual({
      de: "2025-12-01",
      ate: "2025-12-31",
    });
    expect(periodoDoAtalho("mes_passado", "2028-03-10")).toEqual({
      de: "2028-02-01",
      ate: "2028-02-29",
    });
    expect(periodoDoAtalho("90d", "2026-10-28")).toEqual({ de: "2026-07-31", ate: "2026-10-28" });
    expect(periodoDoAtalho("ano", "2026-10-28")).toEqual({ de: "2026-01-01", ate: "2026-10-28" });
  });

  it("somar dias atravessa mês e ano sem fuso", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("valida o período antes de pedir ao banco", () => {
    expect(periodoValido("2026-10-01", "2026-10-28")).toBeNull();
    expect(periodoValido("2026-10-28", "2026-10-01")).toMatch(/antes do fim/);
    expect(periodoValido("2020-01-01", "2026-10-28")).toMatch(/3 anos/);
    expect(periodoValido("", "2026-10-28")).toMatch(/duas datas/);
  });
});
