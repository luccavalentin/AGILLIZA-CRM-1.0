import { describe, expect, it } from "vitest";
import { modoTetoIdade, prazoMaximoParaProponentes } from "./prazo";

/**
 * Regra de negócio: quem dita o teto de idade depende da composição de renda.
 * Compor renda MARCADO mantém a regra conservadora (mais velho); DESMARCADO
 * passa a contar pelo proponente mais novo, entre todos os proponentes.
 */
const HOJE = new Date("2026-09-01T12:00:00");

const titular = { nome: "Titular", vinculo: "Titular", dataNascimento: "1986-03-10" }; // ~40 anos
const conjugeVelho = { nome: "Cônjuge", vinculo: "cônjuge", dataNascimento: "1968-05-20" }; // ~58 anos
const coproIdoso = { nome: "Coproponente", vinculo: "copro", dataNascimento: "1961-02-02" }; // ~65 anos

describe("modoTetoIdade", () => {
  it("compor renda marcado usa o mais velho", () => {
    expect(modoTetoIdade(true)).toBe("mais_velho");
  });

  it("compor renda desmarcado usa o mais novo", () => {
    expect(modoTetoIdade(false)).toBe("mais_novo");
    expect(modoTetoIdade(null)).toBe("mais_novo");
    expect(modoTetoIdade(undefined)).toBe("mais_novo");
  });
});

describe("prazoMaximoParaProponentes", () => {
  it("com um único proponente os dois modos coincidem", () => {
    const velho = prazoMaximoParaProponentes([titular], HOJE, "mais_velho");
    const novo = prazoMaximoParaProponentes([titular], HOJE, "mais_novo");
    expect(velho?.prazo).toBe(novo?.prazo);
  });

  it("com composição de renda, o cônjuge mais velho limita o prazo", () => {
    const res = prazoMaximoParaProponentes([titular, conjugeVelho], HOJE, "mais_velho");
    expect(res?.limitador?.nome).toBe("Cônjuge");
    expect(res?.prazo).toBeLessThan(420);
  });

  it("sem composição de renda, o proponente mais novo dita o prazo", () => {
    const res = prazoMaximoParaProponentes([titular, conjugeVelho], HOJE, "mais_novo");
    expect(res?.limitador?.nome).toBe("Titular");
    expect(res?.prazo).toBe(420);
  });

  it("sem composição de renda, olha todos os proponentes — não só o casal", () => {
    const comRenda = prazoMaximoParaProponentes(
      [titular, conjugeVelho, coproIdoso],
      HOJE,
      "mais_velho",
    );
    const semRenda = prazoMaximoParaProponentes(
      [titular, conjugeVelho, coproIdoso],
      HOJE,
      "mais_novo",
    );
    expect(comRenda?.limitador?.nome).toBe("Coproponente");
    expect(semRenda?.limitador?.nome).toBe("Titular");
    expect(semRenda!.prazo).toBeGreaterThan(comRenda!.prazo);
  });

  it("o padrão continua sendo o mais velho quando o modo não é informado", () => {
    const res = prazoMaximoParaProponentes([titular, conjugeVelho], HOJE);
    expect(res?.limitador?.nome).toBe("Cônjuge");
  });

  it("sem data de nascimento válida não há restrição por idade", () => {
    expect(
      prazoMaximoParaProponentes(
        [{ nome: "X", vinculo: "Titular", dataNascimento: null }],
        HOJE,
        "mais_novo",
      ),
    ).toBeNull();
  });

  it("nunca ultrapassa o prazo máximo de contrato", () => {
    const bebe = { nome: "Jovem", vinculo: "Titular", dataNascimento: "2005-01-01" };
    const res = prazoMaximoParaProponentes([bebe], HOJE, "mais_novo");
    expect(res?.prazo).toBeLessThanOrEqual(420);
  });
});
