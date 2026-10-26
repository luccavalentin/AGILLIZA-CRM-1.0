/**
 * Trocar o e-mail de acesso pela própria pessoa (02/11/2026): a senha atual é conferida no
 * Auth com um cliente descartável; as regras (freio, e-mail em uso, token) são do banco (0601
 * do Corretor); a confirmação troca no Auth e no perfil, conclui e encerra as sessões.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ponte = vi.hoisted(() => ({
  pedirTrocaDeEmailNaPlataforma: vi.fn(),
  abrirTrocaDeEmailNaPlataforma: vi.fn(),
  concluirTrocaDeEmailNaPlataforma: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
const admin = vi.hoisted(() => ({
  updateUserById: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/lib/plataforma/ponte.server", () => ponte);
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth })) }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { updateUserById: admin.updateUserById } },
    rpc: admin.rpc,
    from: () => ({ update: (v: unknown) => (admin.update(v), { eq: admin.eq }) }),
  },
}));

import {
  MENSAGENS_TROCA,
  confirmarTroca,
  pedirTroca,
  senhaAtualConfere,
} from "./trocar-email.server";

const UID = "0192f0a0-0000-7000-8000-0000000000bb";
const OUTRO = "0192f0a0-0000-7000-8000-0000000000cc";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789";
const TROCA = "0192f0a0-0000-7000-8000-0000000000dd";

let logs: string[] = [];

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://crm.agillizatech.com.br");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "chave-publica");
  vi.stubEnv("VITE_SITE_URL", "https://crm.agillizatech.com.br");
  for (const f of [...Object.values(ponte), ...Object.values(auth), ...Object.values(admin)])
    f.mockReset();
  auth.signInWithPassword.mockResolvedValue({
    data: { session: { access_token: "x" }, user: { id: UID } },
    error: null,
  });
  auth.signOut.mockResolvedValue({ error: null });
  ponte.pedirTrocaDeEmailNaPlataforma.mockResolvedValue("enviado");
  ponte.abrirTrocaDeEmailNaPlataforma.mockResolvedValue({
    situacao: "ok",
    trocaId: TROCA,
    authUid: UID,
    emailNovo: "nova@exemplo.com",
  });
  ponte.concluirTrocaDeEmailNaPlataforma.mockResolvedValue({
    situacao: "confirmada",
    emailMascarado: "n•••@exemplo.com",
  });
  admin.updateUserById.mockResolvedValue({ data: {}, error: null });
  admin.eq.mockResolvedValue({ error: null });
  admin.rpc.mockResolvedValue({ data: 2, error: null });
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

const pedido = (extra: Partial<Parameters<typeof pedirTroca>[0]> = {}) =>
  pedirTroca({
    authUid: UID,
    emailAtual: "Ana@Exemplo.com",
    novo: " Nova@Exemplo.com ",
    senha: "minha-senha-1",
    ip: "203.0.113.7",
    ...extra,
  });

describe("senha atual", () => {
  it("confere no Auth e encerra SÓ a sessão que abriu (escopo local)", async () => {
    expect(await senhaAtualConfere(UID, "ana@exemplo.com", "minha-senha-1")).toBe(true);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@exemplo.com",
      password: "minha-senha-1",
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("senha errada, erro do Auth ou outra pessoa não conferem", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { status: 400 },
    });
    expect(await senhaAtualConfere(UID, "ana@exemplo.com", "errada")).toBe(false);
    auth.signInWithPassword.mockRejectedValueOnce(new Error("rede"));
    expect(await senhaAtualConfere(UID, "ana@exemplo.com", "x")).toBe(false);
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: { access_token: "x" }, user: { id: OUTRO } },
      error: null,
    });
    expect(await senhaAtualConfere(UID, "ana@exemplo.com", "x")).toBe(false);
    expect(await senhaAtualConfere(UID, "ana@exemplo.com", "")).toBe(false);
  });
});

describe("pedido", () => {
  it("manda ao banco a senha conferida, o e-mail digitado, o IP e o endereço do Agilliza", async () => {
    expect(await pedido()).toEqual(MENSAGENS_TROCA.enviado);
    expect(ponte.pedirTrocaDeEmailNaPlataforma).toHaveBeenCalledWith({
      authUid: UID,
      novo: "Nova@Exemplo.com",
      senhaConfere: true,
      ip: "203.0.113.7",
      endereco: "https://crm.agillizatech.com.br",
    });
  });
  it("senha errada também vai ao banco (conta no freio) e volta a frase certa", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { status: 400 },
    });
    ponte.pedirTrocaDeEmailNaPlataforma.mockResolvedValueOnce("senha_errada");
    expect(await pedido()).toEqual({ ok: false, mensagem: "A senha atual não confere." });
    expect(ponte.pedirTrocaDeEmailNaPlataforma.mock.calls[0]![0].senhaConfere).toBe(false);
  });
  it("cada resposta do banco tem a sua frase; 'em uso' não diz de quem é", async () => {
    for (const s of Object.keys(MENSAGENS_TROCA) as (keyof typeof MENSAGENS_TROCA)[]) {
      ponte.pedirTrocaDeEmailNaPlataforma.mockResolvedValueOnce(s);
      expect(await pedido()).toEqual(MENSAGENS_TROCA[s]);
    }
    expect(MENSAGENS_TROCA.email_em_uso.mensagem).not.toMatch(/outra pessoa|cadastrad|existe/i);
  });
  it("sem senha ou com e-mail inválido nem chega ao Auth nem ao banco", async () => {
    expect((await pedido({ senha: "" })).ok).toBe(false);
    expect((await pedido({ novo: "sem-arroba" })).mensagem).toBe("Informe um e-mail válido.");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(ponte.pedirTrocaDeEmailNaPlataforma).not.toHaveBeenCalled();
  });
  it("IP forjado vira nulo; e-mail e senha nunca vão para o log", async () => {
    ponte.pedirTrocaDeEmailNaPlataforma.mockRejectedValueOnce(new Error("falhou"));
    await expect(pedido({ ip: "abc" })).rejects.toThrow();
    expect(ponte.pedirTrocaDeEmailNaPlataforma.mock.calls[0]![0].ip).toBeNull();
    for (const l of logs) expect(l).not.toMatch(/exemplo\.com|minha-senha/i);
  });
});

describe("confirmação", () => {
  it("troca no Auth e no perfil, conclui e encerra todas as sessões", async () => {
    expect(await confirmarTroca(TOKEN)).toEqual({ ok: true, email: "n•••@exemplo.com" });
    expect(admin.updateUserById).toHaveBeenCalledWith(UID, {
      email: "nova@exemplo.com",
      email_confirm: true,
    });
    expect(admin.update).toHaveBeenCalledWith({ email: "nova@exemplo.com" });
    expect(admin.eq).toHaveBeenCalledWith("id", UID);
    expect(ponte.concluirTrocaDeEmailNaPlataforma).toHaveBeenCalledWith(TROCA, true);
    expect(admin.rpc).toHaveBeenCalledWith("encerrar_sessoes_auth", { _user_id: UID });
  });
  it("token malformado não chega ao banco", async () => {
    for (const t of [undefined, "", "curto", "a b c d e f g h i j k l m n o p", 42]) {
      const r = await confirmarTroca(t);
      expect(r.ok).toBe(false);
    }
    expect(ponte.abrirTrocaDeEmailNaPlataforma).not.toHaveBeenCalled();
  });
  it("link usado, vencido, concorrente ou em uso: nada muda no Auth", async () => {
    for (const situacao of ["invalido", "vencido", "concorrente", "email_em_uso"]) {
      ponte.abrirTrocaDeEmailNaPlataforma.mockResolvedValueOnce({
        situacao,
        trocaId: null,
        authUid: null,
        emailNovo: null,
      });
      const r = await confirmarTroca(TOKEN);
      expect(r).toMatchObject({ ok: false, linkRuim: true });
    }
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("o Auth recusou (e-mail já registrado): fecha como recusada e não toca no perfil", async () => {
    admin.updateUserById.mockResolvedValueOnce({
      data: null,
      error: {
        status: 422,
        code: "email_exists",
        message: "A user with this email address has already been registered",
      },
    });
    const r = await confirmarTroca(TOKEN);
    expect(r).toMatchObject({ ok: false, linkRuim: true });
    expect(ponte.concluirTrocaDeEmailNaPlataforma).toHaveBeenCalledWith(
      TROCA,
      false,
      "email_em_uso",
    );
    expect(admin.update).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("falha no meio depois da reserva: fecha como recusada (não fica presa)", async () => {
    admin.updateUserById.mockRejectedValueOnce(new Error("rede"));
    const r = await confirmarTroca(TOKEN);
    expect(r).toMatchObject({ ok: false, linkRuim: true });
    expect(ponte.concluirTrocaDeEmailNaPlataforma).toHaveBeenCalledWith(
      TROCA,
      false,
      "falha_no_servidor",
    );
    for (const l of logs) expect(l).not.toMatch(/nova@exemplo|AbCdEf/);
  });
});
