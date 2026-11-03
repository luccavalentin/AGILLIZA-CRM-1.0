import { describe, expect, it } from "vitest";
import { fupsNovos } from "./fup-homefin";

const laudo = {
  idFupOportunidade: 284,
  tipoFup: "E",
  titulo: "Laudo Solicitado da proposta - 5566680",
  comentario: "Informamos que o laudo de avaliação foi solicitado.",
  dataHoraCriacao: "2026-10-08T19:20:30.000Z",
};
const nossoTeste = {
  idFupOportunidade: 278,
  tipoFup: "E",
  titulo: "Teste integração",
  comentario: "Teste1",
  dataHoraCriacao: "2026-10-04T22:03:53.000Z",
};

describe("fupsNovos", () => {
  it("traz o retorno da HomeFin e pula o que saiu do próprio CRM", () => {
    const novos = fupsNovos(
      [laudo, nossoTeste],
      [{ tipo: "externo", titulo: "Teste integração", comentario: "Teste1", created_at: "2026-10-04T22:03:50Z" }],
    );
    expect(novos).toEqual([
      {
        titulo: "Laudo Solicitado da proposta - 5566680",
        comentario: "Informamos que o laudo de avaliação foi solicitado.",
        created_at: "2026-10-08T19:20:30.000Z",
      },
    ]);
  });

  it("não reimporta o que já foi gravado", () => {
    const novos = fupsNovos(
      [laudo],
      [{ tipo: "homefin_fup", titulo: laudo.titulo, comentario: laudo.comentario, created_at: laudo.dataHoraCriacao }],
    );
    expect(novos).toEqual([]);
  });

  it("o mesmo recado em outro dia entra de novo", () => {
    const novos = fupsNovos(
      [{ ...laudo, dataHoraCriacao: "2026-10-20T10:00:00.000Z" }],
      [{ tipo: "homefin_fup", titulo: laudo.titulo, comentario: laudo.comentario, created_at: laudo.dataHoraCriacao }],
    );
    expect(novos).toHaveLength(1);
  });

  it("ignora resposta que não é lista e itens sem data ou texto", () => {
    expect(fupsNovos({} as any, [])).toEqual([]);
    expect(fupsNovos([{ titulo: "x" }, { dataHoraCriacao: laudo.dataHoraCriacao }], [])).toEqual([]);
  });
});
