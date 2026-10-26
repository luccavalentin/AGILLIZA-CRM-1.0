/**
 * "Esqueci minha senha" (defeito de produção de 30/10/2026): o link vai pelo e-mail da
 * plataforma, não pelo SMTP do Auth. A resposta é sempre a mesma; os freios e o perfil são do
 * banco (0560 do Corretor); o e-mail e o link nunca vão para o log.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ponte = vi.hoisted(() => ({
  pedirRecuperacaoNaPlataforma: vi.fn(),
  enviarLinkDeRecuperacao: vi.fn(),
}));
const generateLink = vi.hoisted(() => vi.fn());

vi.mock("@/lib/plataforma/ponte.server", () => ponte);
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { admin: { generateLink } } },
}));

import {
  RESPOSTA_RECUPERACAO,
  enderecoDoAgilliza,
  normalizarEmail,
  pedirRecuperacao,
} from "./recuperar-senha.server";
import { problemaDaSenhaNova, sessaoDeRecuperacao, voltouDoLinkDeRecuperacao } from "./recuperacao";

const UID = "0192f0a0-0000-7000-8000-0000000000bb";
const LINK =
  "https://crm.agillizatech.com.br/auth/v1/verify?token=5f1c0e2a9b7d4c3e8a6f0b1d&type=recovery&redirect_to=https%3A%2F%2Fcrm.agillizatech.com.br%2Fauth%3Frecuperar%3D1";
const GENERICA = { ok: true, mensagem: RESPOSTA_RECUPERACAO };
const RAPIDO = { tempoMinimoMs: 0 };

let logs: string[] = [];

beforeEach(() => {
  vi.stubEnv("VITE_SITE_URL", "https://crm.agillizatech.com.br");
  ponte.pedirRecuperacaoNaPlataforma.mockReset();
  ponte.enviarLinkDeRecuperacao.mockReset().mockResolvedValue(true);
  generateLink.mockReset().mockResolvedValue({
    data: { user: { id: UID }, properties: { action_link: LINK } },
    error: null,
  });
  logs = [];
  for (const nivel of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, nivel).mockImplementation((...a: unknown[]) => {
      logs.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    });
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Nenhum log com o e-mail, o link ou o token. */
function semDadoNoLog(email: string) {
  for (const l of logs) {
    expect(l.toLowerCase()).not.toContain(email.toLowerCase());
    expect(l).not.toContain("verify?");
    expect(l).not.toContain("5f1c0e2a9b7d");
  }
}

describe("pedirRecuperacao (servidor)", () => {
  it("conta ativa: gera o link de recuperação e enfileira pela ponte — resposta genérica", async () => {
    ponte.pedirRecuperacaoNaPlataforma.mockResolvedValue({ situacao: "enviar", authUid: UID });
    const r = await pedirRecuperacao({ email: "  Ana@Exemplo.COM ", ip: "203.0.113.9" }, RAPIDO);
    expect(r).toEqual(GENERICA);
    expect(ponte.pedirRecuperacaoNaPlataforma).toHaveBeenCalledWith(
      "ana@exemplo.com",
      "203.0.113.9",
    );
    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "ana@exemplo.com",
      options: { redirectTo: "https://crm.agillizatech.com.br/auth?recuperar=1" },
    });
    expect(ponte.enviarLinkDeRecuperacao).toHaveBeenCalledWith(UID, LINK);
    semDadoNoLog("ana@exemplo.com");
  });

  it("e-mail sem conta (ou inativo, sem login): nada é gerado e a resposta é a MESMA", async () => {
    ponte.pedirRecuperacaoNaPlataforma.mockResolvedValue({ situacao: "sem_conta", authUid: null });
    const r = await pedirRecuperacao({ email: "ninguem@exemplo.com", ip: "203.0.113.9" }, RAPIDO);
    expect(r).toEqual(GENERICA);
    expect(generateLink).not.toHaveBeenCalled();
    expect(ponte.enviarLinkDeRecuperacao).not.toHaveBeenCalled();
    semDadoNoLog("ninguem@exemplo.com");
  });

  it.each(["freio_email", "freio_ip", "sem_ponte", "falha"])(
    "%s: nada é gerado (o link novo invalidaria o anterior) e a resposta é a mesma",
    async (situacao) => {
      ponte.pedirRecuperacaoNaPlataforma.mockResolvedValue({ situacao, authUid: null });
      expect(await pedirRecuperacao({ email: "ana@exemplo.com", ip: null }, RAPIDO)).toEqual(
        GENERICA,
      );
      expect(generateLink).not.toHaveBeenCalled();
      expect(ponte.enviarLinkDeRecuperacao).not.toHaveBeenCalled();
      semDadoNoLog("ana@exemplo.com");
    },
  );

  it("texto que não é e-mail: nem pergunta ao banco", async () => {
    for (const email of ["", "   ", "sem-arroba", "a@b", 42, null, { email: "x@y.com" }]) {
      expect(await pedirRecuperacao({ email, ip: null }, RAPIDO)).toEqual(GENERICA);
    }
    expect(ponte.pedirRecuperacaoNaPlataforma).not.toHaveBeenCalled();
  });

  it("IP forjado no cabeçalho vira nulo (o banco conta como pedido sem IP)", async () => {
    ponte.pedirRecuperacaoNaPlataforma.mockResolvedValue({ situacao: "sem_conta", authUid: null });
    await pedirRecuperacao({ email: "ana@exemplo.com", ip: "abc'; drop" }, RAPIDO);
    expect(ponte.pedirRecuperacaoNaPlataforma).toHaveBeenCalledWith("ana@exemplo.com", null);
  });

  it("Auth falhou ao gerar: não enfileira, responde igual e o log não tem o e-mail", async () => {
    ponte.pedirRecuperacaoNaPlataforma.mockResolvedValue({ situacao: "enviar", authUid: UID });
    generateLink.mockResolvedValue({
      data: { user: null, properties: null },
      error: { status: 404, message: "User with email ana@exemplo.com not found" },
    });
    expect(await pedirRecuperacao({ email: "ana@exemplo.com", ip: null }, RAPIDO)).toEqual(
      GENERICA,
    );
    expect(ponte.enviarLinkDeRecuperacao).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("link não gerado"))).toBe(true);
    semDadoNoLog("ana@exemplo.com");
  });

  it("o Auth achou outra pessoa pelo e-mail: o link não sai", async () => {
    ponte.pedirRecuperacaoNaPlataforma.mockResolvedValue({ situacao: "enviar", authUid: UID });
    generateLink.mockResolvedValue({
      data: {
        user: { id: "0192f0a0-0000-7000-8000-0000000000ff" },
        properties: { action_link: LINK },
      },
      error: null,
    });
    await pedirRecuperacao({ email: "ana@exemplo.com", ip: null }, RAPIDO);
    expect(ponte.enviarLinkDeRecuperacao).not.toHaveBeenCalled();
    semDadoNoLog("ana@exemplo.com");
  });

  it("exceção em qualquer etapa: responde igual, sem vazar a mensagem", async () => {
    ponte.pedirRecuperacaoNaPlataforma.mockRejectedValue(new Error("falhou com ana@exemplo.com"));
    expect(await pedirRecuperacao({ email: "ana@exemplo.com", ip: null }, RAPIDO)).toEqual(
      GENERICA,
    );
    ponte.pedirRecuperacaoNaPlataforma.mockResolvedValue({ situacao: "enviar", authUid: UID });
    generateLink.mockRejectedValue(new Error(`rede caiu em ${LINK}`));
    expect(await pedirRecuperacao({ email: "ana@exemplo.com", ip: null }, RAPIDO)).toEqual(
      GENERICA,
    );
    semDadoNoLog("ana@exemplo.com");
  });

  it("tempo mínimo: com e sem conta, a resposta não sai antes do piso", async () => {
    ponte.pedirRecuperacaoNaPlataforma.mockResolvedValue({ situacao: "sem_conta", authUid: null });
    const t0 = Date.now();
    await pedirRecuperacao({ email: "ninguem@exemplo.com", ip: null }, { tempoMinimoMs: 120 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(110);
  });

  it("endereço de volta: VITE_SITE_URL https (ou localhost); qualquer outra coisa cai no padrão", () => {
    vi.stubEnv("VITE_SITE_URL", "https://homolog.agillizatech.com.br/");
    expect(enderecoDoAgilliza()).toBe("https://homolog.agillizatech.com.br");
    vi.stubEnv("VITE_SITE_URL", "http://localhost:3740");
    expect(enderecoDoAgilliza()).toBe("http://localhost:3740");
    for (const v of ["", "http://evil.com", "javascript:alert(1)", "nada"]) {
      vi.stubEnv("VITE_SITE_URL", v);
      expect(enderecoDoAgilliza()).toBe("https://crm.agillizatech.com.br");
    }
  });

  it("normalizarEmail", () => {
    expect(normalizarEmail(" A@B.com ")).toBe("a@b.com");
    expect(normalizarEmail("a b@c.com")).toBeNull();
    expect(normalizarEmail(`${"a".repeat(250)}@b.com`)).toBeNull();
  });
});

describe("a tela e a server function", () => {
  const SRC = join(__dirname, "..", "..");
  const ler = (rel: string) => readFileSync(join(SRC, rel), "utf8");

  it("/auth não usa mais o SMTP do Auth e chama a server function", () => {
    const auth = ler("routes/auth.tsx");
    expect(auth).not.toContain("resetPasswordForEmail");
    expect(auth).toContain("pedirRecuperacaoDeSenha({ data: { email: email.trim() } })");
    expect(auth).toContain("NovaSenhaRecuperacao");
  });

  it("a server function é pública (sem login) e só repassa para o servidor", () => {
    const fn = ler("lib/auth/recuperar-senha.functions.ts");
    expect(fn).not.toMatch(/\.middleware\(/);
    expect(fn).toContain('await import("./recuperar-senha.server")');
    expect(fn).toContain("ipDoCliente(getRequestHeader)");
  });

  it("o formulário de senha nova não pede a senha atual e encerra as sessões no fim", () => {
    const c = ler("components/auth/NovaSenhaRecuperacao.tsx");
    expect(c).toContain("supabase.auth.updateUser({ password: nova })");
    expect(c).toContain('signOut({ scope: "global" })');
    expect(c).not.toContain("signInWithPassword");
  });
});

describe("volta do link (navegador)", () => {
  const token = (amr: unknown) =>
    `x.${Buffer.from(JSON.stringify({ sub: UID, amr })).toString("base64url")}.y`;
  const agora = Date.UTC(2026, 9, 30, 12, 0, 0);
  const s = agora / 1000;

  it("sessão aberta agora por link do e-mail: é recuperação", () => {
    expect(sessaoDeRecuperacao(token([{ method: "otp", timestamp: s - 30 }]), agora)).toBe(true);
    expect(sessaoDeRecuperacao(token([{ method: "recovery", timestamp: s - 30 }]), agora)).toBe(
      true,
    );
  });

  it("sessão de senha, link velho, token estranho: não é", () => {
    expect(sessaoDeRecuperacao(token([{ method: "password", timestamp: s - 30 }]), agora)).toBe(
      false,
    );
    expect(sessaoDeRecuperacao(token([{ method: "otp", timestamp: s - 7200 }]), agora)).toBe(false);
    expect(sessaoDeRecuperacao(token(null), agora)).toBe(false);
    expect(sessaoDeRecuperacao("nao-e-jwt", agora)).toBe(false);
    expect(sessaoDeRecuperacao(undefined, agora)).toBe(false);
  });

  it("?recuperar=1 marca a volta do link", () => {
    expect(voltouDoLinkDeRecuperacao("?recuperar=1")).toBe(true);
    expect(voltouDoLinkDeRecuperacao("")).toBe(false);
    expect(voltouDoLinkDeRecuperacao("?recuperar=0")).toBe(false);
  });

  it("regra da senha nova: a mesma da tela Segurança", () => {
    expect(problemaDaSenhaNova("curta1", "curta1", "a@b.com")).toMatch(/8 caracteres/);
    expect(problemaDaSenhaNova("somenteletras", "somenteletras", "a@b.com")).toMatch(
      /letras e números/,
    );
    expect(problemaDaSenhaNova("ana1@b.com", "ana1@b.com", "ANA1@b.com")).toMatch(/seu e-mail/);
    expect(problemaDaSenhaNova("Senha123", "Senha124", "a@b.com")).toMatch(/não coincidem/);
    expect(problemaDaSenhaNova("Senha123", "Senha123", "a@b.com")).toBeNull();
  });
});
