import { describe, expect, it, vi } from "vitest";
import {
  contaDestinoDosDados,
  DADOS_RAPIDA_NA_CONTA,
  levarSimulacaoParaContaServidor,
  type DependenciasNaConta,
} from "./simulacao-na-conta.server";
import { ENTRADA_LEVAR, ENTRADA_RAPIDA } from "./simulacao-na-conta.functions";

vi.mock("@tanstack/react-start", () => {
  const corrente = () => {
    const o: Record<string, unknown> = {};
    o.middleware = () => o;
    o.inputValidator = () => o;
    o.handler = (h: unknown) => h;
    o.server = () => o;
    return o;
  };
  return { createServerFn: corrente, createMiddleware: corrente };
});
vi.mock("@/integrations/supabase/exigir-permissao", () => ({ exigirPermissao: () => ({}) }));

const CONTA = "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const SIM = "11111111-2222-4333-8444-555555555555";
const UID = "99999999-8888-4777-8666-555555555555";

type Tx = { consultar: ReturnType<typeof vi.fn>; uma: ReturnType<typeof vi.fn> };

function deps(over: Record<string, unknown> = {}) {
  const tx: Tx = { consultar: vi.fn(), uma: vi.fn() };
  const d = {
    comConta: vi.fn(async (_u: string, _l: string, fn: (t: Tx) => Promise<unknown>) => {
      tx.uma.mockResolvedValueOnce({ r: { simulacao_id: "copia", codigo: "SIM-9", ja_existia: false } });
      return fn(tx);
    }),
    comPlataforma: vi.fn(async (_u: string, fn: (t: Tx) => Promise<unknown>) => {
      tx.uma.mockResolvedValueOnce({ r: { contas: [{ nome: "Imobiliária Alfa" }] } });
      return fn(tx);
    }),
    marcar: vi.fn(async () => undefined),
    ...over,
  };
  return { d: d as unknown as DependenciasNaConta & typeof d, tx };
}

describe("criarSimulacao: conta de destino (C29)", () => {
  it("sem conta (ausente, nula ou vazia) é a sua base", () => {
    expect(contaDestinoDosDados({})).toBeNull();
    expect(contaDestinoDosDados({ conta_assinante_id: null })).toBeNull();
    expect(contaDestinoDosDados({ conta_assinante_id: "" })).toBeNull();
    expect(contaDestinoDosDados(undefined)).toBeNull();
  });

  it("ATAQUE: conta torta é recusada (nunca cai na base própria em silêncio)", () => {
    for (const v of ["x' or 1=1", "123", 42, { id: CONTA }, [CONTA]]) {
      expect(() => contaDestinoDosDados({ conta_assinante_id: v })).toThrow("Conta de destino inválida.");
    }
    expect(contaDestinoDosDados({ conta_assinante_id: CONTA.toUpperCase() })).toBe(CONTA);
  });

  it("sem conta, a ponte nem é chamada", async () => {
    const { d } = deps();
    expect(await levarSimulacaoParaContaServidor(d, { userId: UID, simulacaoId: SIM, licenca: null })).toBeNull();
    expect(d.comConta).not.toHaveBeenCalled();
    expect(d.comPlataforma).not.toHaveBeenCalled();
    expect(d.marcar).not.toHaveBeenCalled();
  });

  it("com conta, cria a cópia pela conta aberta e marca a simulação", async () => {
    const { d, tx } = deps();
    const r = await levarSimulacaoParaContaServidor(d, { userId: UID, simulacaoId: SIM, licenca: CONTA });
    expect(r?.ok).toBe(true);
    expect(d.comConta).toHaveBeenCalledWith(UID, CONTA, expect.any(Function));
    expect(tx.uma).toHaveBeenCalledWith("select plataforma.simulacao_do_agilliza_na_conta($1, $2) as r", [
      SIM,
      UID,
    ]);
    expect(d.marcar).toHaveBeenCalledWith(SIM, {
      conta_assinante_id: CONTA,
      conta_assinante_simulacao_id: "copia",
      conta_assinante_nome: "Imobiliária Alfa",
    });
  });

  it("ponte fora: a simulação do Agilliza não falha, só avisa e guarda a marca para levar de novo", async () => {
    const { d } = deps({
      comConta: vi.fn(async () => {
        throw new Error("A plataforma não respondeu agora.");
      }),
    });
    const r = await levarSimulacaoParaContaServidor(d, { userId: UID, simulacaoId: SIM, licenca: CONTA });
    expect(r?.ok).toBe(false);
    expect(r?.mensagem).toMatch(/Levar à conta de novo/);
    expect(d.marcar).toHaveBeenCalledWith(SIM, {
      conta_assinante_id: CONTA,
      conta_assinante_nome: "Imobiliária Alfa",
    });
  });

  it("nome da conta indisponível não impede a cópia", async () => {
    const { d } = deps({
      comPlataforma: vi.fn(async () => {
        throw new Error("sem permissão");
      }),
    });
    const r = await levarSimulacaoParaContaServidor(d, { userId: UID, simulacaoId: SIM, licenca: CONTA });
    expect(r?.ok).toBe(true);
    expect(r?.conta_nome).toBeNull();
  });
});

describe("entradas das ações (zod)", () => {
  const rapida = {
    valor_imovel: 500000,
    valor_financiamento: 400000,
    prazo: 360,
    resultado: [{ banco: "Bradesco", parcela: 4000 }],
  };

  it("levar: simulação e conta precisam ser uuid", () => {
    expect(ENTRADA_LEVAR.safeParse({ simulacaoId: "x", licenca: CONTA }).success).toBe(false);
    expect(ENTRADA_LEVAR.safeParse({ simulacaoId: SIM, licenca: "x" }).success).toBe(false);
    expect(ENTRADA_LEVAR.safeParse({ simulacaoId: SIM }).success).toBe(true);
  });

  it("rápida válida passa, com produto e sistema padrão", () => {
    const r = ENTRADA_RAPIDA.safeParse({ licenca: CONTA, dados: rapida });
    expect(r.success).toBe(true);
    if (r.success) expect([r.data.dados.produto, r.data.dados.sistema]).toEqual(["financiamento", "SAC"]);
  });

  it("ATAQUE: rápida torta ou grande demais é recusada", () => {
    const tortos = [
      { ...rapida, valor_financiamento: 600000 },
      { ...rapida, prazo: 6 },
      { ...rapida, prazo: 421 },
      { ...rapida, prazo: 360.5 },
      { ...rapida, valor_imovel: Number.NaN },
      { ...rapida, valor_imovel: -1 },
      { ...rapida, resultado: "x" },
      { ...rapida, resultado: Array.from({ length: 21 }, () => ({ banco: "B", parcela: 1 })) },
      { ...rapida, resultado: [{ banco: "x".repeat(61), parcela: 1 }] },
      { ...rapida, documento: "<script>" },
      { ...rapida, uf: "SPX" },
      { ...rapida, nascimento: "31/12/1990" },
    ];
    for (const t of tortos) expect(DADOS_RAPIDA_NA_CONTA.safeParse(t).success).toBe(false);
    expect(ENTRADA_RAPIDA.safeParse({ licenca: "lixo", dados: rapida }).success).toBe(false);
  });
});
