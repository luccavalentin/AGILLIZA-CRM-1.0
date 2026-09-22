import { describe, expect, it, vi } from "vitest";
import { comContextoDaRequisicao, emSegundoPlano } from "./segundo-plano.server";

describe("emSegundoPlano", () => {
  it("entrega a tarefa ao waitUntil da requisição, mesmo depois de awaits", async () => {
    const waitUntil = vi.fn();
    const request = { waitUntil };
    await comContextoDaRequisicao(request, undefined, async () => {
      await Promise.resolve();
      emSegundoPlano("teste", async () => "ok");
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBe("ok");
  });

  it("usa o ctx quando a requisição não traz waitUntil", () => {
    const waitUntil = vi.fn();
    comContextoDaRequisicao({}, { waitUntil }, () => emSegundoPlano("teste", async () => 1));
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("não derruba nada quando a tarefa falha nem quando não há contexto", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    emSegundoPlano("falha", async () => {
      throw new Error("x");
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
