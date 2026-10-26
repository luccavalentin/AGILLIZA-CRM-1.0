import { describe, expect, it, vi } from "vitest";
import { executarTeste, type CaixaParaTeste, type DependenciasTeste } from "./teste-conexao";

const AGORA = Date.parse("2026-10-26T12:00:00Z");

const caixa = (p: Partial<CaixaParaTeste> = {}): CaixaParaTeste => ({
  id: "c1",
  email: "equipe@agilliza.com.br",
  usuario: null,
  imap_host: "imap.uhserver.com",
  imap_port: 993,
  imap_ssl: true,
  pasta: "INBOX",
  tem_senha: true,
  status: "aguardando",
  espera_ate: null,
  teste_em: null,
  ...p,
});

function deps(p: Partial<DependenciasTeste> = {}) {
  const d = {
    agora: () => AGORA,
    hostPermitido: vi.fn(async () => true),
    assumir: vi.fn(async () => true),
    soltar: vi.fn(async () => {}),
    conectar: vi.fn(async () => ({ mensagens: 12 })),
    ...p,
  };
  return d;
}

describe("Testar conexão (sem servidor de verdade)", () => {
  it("conecta, conta as mensagens da pasta e solta o aluguel", async () => {
    const d = deps();
    const r = await executarTeste(caixa(), d);
    expect(r).toMatchObject({ ok: true, tentou: true });
    expect(r.mensagem).toContain("12 mensagem");
    expect(d.soltar).toHaveBeenCalledOnce();
  });

  it("sem senha não tenta", async () => {
    const d = deps();
    const r = await executarTeste(caixa({ tem_senha: false }), d);
    expect(r).toMatchObject({ ok: false, tentou: false });
    expect(d.conectar).not.toHaveBeenCalled();
  });

  it("em espera depois de recusa do provedor não faz login", async () => {
    const d = deps();
    const r = await executarTeste(caixa({ espera_ate: new Date(AGORA + 5 * 60_000).toISOString() }), d);
    expect(r.tentou).toBe(false);
    expect(r.mensagem).toMatch(/prolongaria o bloqueio/);
    expect(d.conectar).not.toHaveBeenCalled();
  });

  it("dois testes em menos de um minuto: o segundo é recusado", async () => {
    const d = deps();
    const r = await executarTeste(caixa({ teste_em: new Date(AGORA - 20_000).toISOString() }), d);
    expect(r).toMatchObject({ ok: false, tentou: false });
    expect(d.assumir).not.toHaveBeenCalled();
  });

  it("servidor de rede interna é recusado antes de qualquer login", async () => {
    const d = deps({ hostPermitido: vi.fn(async () => false) });
    const r = await executarTeste(caixa({ imap_host: "imap.interno.com" }), d);
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/rede interna/);
    expect(d.assumir).not.toHaveBeenCalled();
    expect(d.conectar).not.toHaveBeenCalled();
  });

  it("leitor conectado na caixa: confirma sem segundo login", async () => {
    const d = deps({ assumir: vi.fn(async () => false) });
    const r = await executarTeste(caixa({ status: "conectado" }), d);
    expect(r.ok).toBe(true);
    expect(d.conectar).not.toHaveBeenCalled();
    expect(d.soltar).not.toHaveBeenCalled();
  });

  it("outro processo lendo (sem estar conectado): não força login", async () => {
    const d = deps({ assumir: vi.fn(async () => false) });
    const r = await executarTeste(caixa({ status: "erro" }), d);
    expect(r).toMatchObject({ ok: false, tentou: false });
    expect(d.conectar).not.toHaveBeenCalled();
  });

  it("login recusado vira mensagem clara e o aluguel é solto", async () => {
    const d = deps({
      conectar: vi.fn(async () => {
        throw Object.assign(new Error("Command failed"), { authenticationFailed: true });
      }),
    });
    const r = await executarTeste(caixa(), d);
    expect(r).toMatchObject({ ok: false, tentou: true });
    expect(r.mensagem).toMatch(/recusou o login/);
    expect(d.soltar).toHaveBeenCalledOnce();
  });

  it("pasta inexistente é dita pelo nome", async () => {
    const d = deps({
      conectar: vi.fn(async () => {
        throw new Error("Mailbox does not exist");
      }),
    });
    const r = await executarTeste(caixa({ pasta: "Bancos" }), d);
    expect(r.mensagem).toBe('A pasta "Bancos" não existe nesta caixa.');
  });

  it("falha de rede mostra servidor e porta", async () => {
    const d = deps({
      conectar: vi.fn(async () => {
        throw new Error("ETIMEDOUT");
      }),
    });
    const r = await executarTeste(caixa(), d);
    expect(r.mensagem).toContain("imap.uhserver.com:993");
  });
});
