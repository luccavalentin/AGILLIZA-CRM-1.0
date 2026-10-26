/**
 * Decisão 15 do backtest de 23/10/2026: a senha provisória deixa de ser o próprio
 * e-mail. É sorteada no servidor, vai só para o e-mail da pessoa (fila de e-mail da
 * plataforma) e nunca volta para a tela de quem cadastrou. Troca obrigatória mantida.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gerarSenhaProvisoria } from "./senha-provisoria";
import { senhaProvisoriaPendente } from "./pessoas.functions";

const SRC = join(__dirname, "..", "..");
const ler = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("gerarSenhaProvisoria", () => {
  it("é forte: 16 caracteres com maiúscula, minúscula, dígito e símbolo", () => {
    for (let i = 0; i < 300; i++) {
      const s = gerarSenhaProvisoria();
      expect(s).toHaveLength(16);
      expect(s).toMatch(/[A-Z]/);
      expect(s).toMatch(/[a-z]/);
      expect(s).toMatch(/[2-9]/);
      expect(s).toMatch(/[!#$%*+\-=?@]/);
    }
  });

  it("passa na regra do banco (0494) e não tem caractere confuso nem de HTML", () => {
    for (let i = 0; i < 300; i++) {
      const s = gerarSenhaProvisoria();
      expect(s).toMatch(/^[\x21-\x7e]{12,128}$/);
      expect(s).not.toMatch(/[0O1lI&<>"'\s]/);
    }
  });

  it("não repete e não é o e-mail", () => {
    const vistas = new Set(Array.from({ length: 2000 }, () => gerarSenhaProvisoria()));
    expect(vistas.size).toBe(2000);
    expect([...vistas].some((s) => s.includes("@") && s.includes("."))).toBe(false);
  });

  it("respeita os limites de tamanho", () => {
    expect(gerarSenhaProvisoria(4)).toHaveLength(12);
    expect(gerarSenhaProvisoria(200)).toHaveLength(64);
    expect(gerarSenhaProvisoria(20)).toHaveLength(20);
  });
});

describe("cadastro, habilitar login e redefinir senha: a senha não volta para a tela", () => {
  const pessoas = ler("lib/admin/pessoas.functions.ts");

  it("nenhuma senha provisória é o e-mail", () => {
    expect(pessoas).not.toMatch(/const senha = (email|emailReal|\(alvo\.email)/);
    expect(pessoas).not.toMatch(/Math\.random/);
  });

  it("o resultado não leva a senha; as três ações mandam por e-mail", () => {
    expect(pessoas).not.toMatch(/senha_temporaria/);
    for (const fn of ["criarPessoaComAcesso", "habilitarLoginPessoa", "resetarSenhaPessoa"]) {
      const ini = pessoas.indexOf(`export const ${fn}`);
      expect(ini, fn).toBeGreaterThan(0);
      const fim = pessoas.indexOf("export const", ini + 10);
      const corpo = pessoas.slice(ini, fim > 0 ? fim : undefined);
      expect(corpo, fn).toContain("gerarSenhaProvisoria()");
      expect(corpo, fn).toContain("enviarSenha(");
      expect(corpo, fn).toMatch(/exigirEnvioDeEmail\(/);
      expect(corpo, fn).toMatch(/senha_provisoria: (true|comLogin)/); // troca obrigatória mantida
      expect(corpo, fn).not.toMatch(/return \{[^}]*\bsenha\s*[,:}]/);
    }
  });

  it("auditoria 26/10: sem e-mail configurado (credencial + remetente) nada muda no Auth", () => {
    const exigir = pessoas.slice(pessoas.indexOf("async function exigirEnvioDeEmail"));
    expect(exigir).toContain("emailConfiguradoNaPlataforma()");
    expect(exigir).toContain("Nada foi alterado.");
    const ponte = ler("lib/plataforma/ponte.server.ts");
    const conf = ponte.slice(ponte.indexOf("export async function emailConfiguradoNaPlataforma"));
    expect(conf).toContain('credencialDoSistema("email")');
    expect(conf).toMatch(/SENDPULSE_API_ID && s\.SENDPULSE_API_SECRET\) \|\| s\.RESEND_API_KEY/);
    expect(conf).toContain("EMAIL_REMETENTE");
  });

  it("auditoria 26/10: o freio e o perfil são conferidos ANTES de trocar a senha no Auth", () => {
    for (const [fn, ativo] of [
      ["resetarSenhaPessoa", "true"],
      ["habilitarLoginPessoa", "false"],
    ] as const) {
      const ini = pessoas.indexOf(`export const ${fn}`);
      const corpo = pessoas.slice(ini, pessoas.indexOf("export const", ini + 10));
      const conferir = corpo.indexOf(
        `exigirEnvioDeEmail({ authUid: data.id, perfilAtivo: ${ativo} })`,
      );
      const troca = corpo.indexOf("updateUserById(");
      expect(conferir, fn).toBeGreaterThan(0);
      expect(conferir, fn).toBeLessThan(troca);
    }
  });

  it("auditoria 26/10: trocar o e-mail avisa o antigo (e exige a ponte antes de trocar)", () => {
    const ini = pessoas.indexOf("export const alterarEmailPessoa");
    const corpo = pessoas.slice(ini, pessoas.indexOf("export const", ini + 10));
    expect(corpo.indexOf("ponteConfigurada()")).toBeLessThan(corpo.indexOf("updateUserById("));
    expect(corpo).toContain("registrarTrocaDeEmail(data.id, antigo, data.email)");
    expect(ler("components/admin/editar-pessoa-dialog.tsx")).toContain("r.aviso");
  });

  it("auditoria 26/10: senhas provisórias antigas — só topo, conta antes, freio antes da troca", () => {
    const ini = pessoas.indexOf("export const redefinirSenhasProvisoriasAntigas");
    const corpo = pessoas.slice(ini, pessoas.indexOf("export const", ini + 10));
    expect(corpo).toContain('_roles: ["admin", "correspondente"]');
    expect(corpo).toContain("if (!data.confirmar || pendentes.length === 0) return resultado;");
    expect(corpo).toContain("senhaProvisoriaPendente(u?.user)");
    expect(corpo.indexOf("conferirEnvioDeSenha(p.id, true)")).toBeLessThan(
      corpo.indexOf("updateUserById("),
    );
    expect(corpo).toContain("gerarSenhaProvisoria()");
    expect(corpo).not.toMatch(/return \{[^}]*\bsenha\s*[,:}]/);
  });

  it("senha provisória pendente: só quem ainda tem a troca obrigatória e login de verdade", () => {
    expect(senhaProvisoriaPendente({ app_metadata: { senha_provisoria: true } })).toBe(true);
    expect(senhaProvisoriaPendente({ app_metadata: { senha_provisoria: false } })).toBe(false);
    expect(senhaProvisoriaPendente({ app_metadata: {} })).toBe(false);
    expect(senhaProvisoriaPendente(null)).toBe(false);
    const banida = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      senhaProvisoriaPendente({ app_metadata: { senha_provisoria: true }, banned_until: banida }),
    ).toBe(false);
    const vencida = new Date(Date.now() - 86_400_000).toISOString();
    expect(
      senhaProvisoriaPendente({ app_metadata: { senha_provisoria: true }, banned_until: vencida }),
    ).toBe(true);
  });

  it("as telas não mostram nem copiam senha", () => {
    for (const tela of [
      "routes/_authenticated/admin.pessoas.tsx",
      "components/crm/criar-vinculo-inline.tsx",
      "components/admin/nova-pessoa-inline.tsx",
      "components/admin/senhas-provisorias-antigas.tsx",
    ]) {
      const s = ler(tela);
      expect(s, tela).not.toMatch(/senha_temporaria/);
      expect(s, tela).not.toMatch(/clipboard\.writeText\([^)]*senha/);
    }
  });

  it("a tela de entrada do Agilliza não mudou de regra (só e-mail e senha)", () => {
    const auth = ler("routes/auth.tsx");
    expect(auth).toMatch(/signInWithPassword/);
    expect(auth).not.toMatch(/senha_provisoria|gerarSenhaProvisoria/);
  });
});

describe("envio da senha pela ponte", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("pg");
  });

  it("sem a ponte configurada: não lança e diz que não enviou", async () => {
    vi.stubEnv("PONTE_DATABASE_URL", "");
    const { enviarSenhaProvisoriaPorEmail, ponteConfigurada } =
      await import("@/lib/plataforma/ponte.server");
    expect(ponteConfigurada()).toBe(false);
    const r = await enviarSenhaProvisoriaPorEmail(
      "00000000-0000-0000-0000-000000000001",
      "Kq7#mT9vR2xP4wZs",
    );
    expect(r.ok).toBe(false);
  });

  it("chama a função do banco com a pessoa, a senha e o endereço do Agilliza — e o erro não vaza a senha", async () => {
    vi.stubEnv("PONTE_DATABASE_URL", "postgres://ponte@127.0.0.1:1/x");
    vi.stubEnv("VITE_SITE_URL", "https://crm.agillizatech.com.br");
    const chamadas: { sql: string; params: unknown[] }[] = [];
    let falhar: { code: string; message: string } | null = null;
    vi.doMock("pg", () => {
      class Pool {
        on() {}
        listenerCount() {
          return 1;
        }
        async query(sql: string, params: unknown[]) {
          chamadas.push({ sql, params });
          if (falhar) throw Object.assign(new Error(falhar.message), { code: falhar.code });
          return { rows: [{}] };
        }
      }
      return { default: { Pool }, Pool };
    });
    const erros: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
      erros.push(a.map(String).join(" "));
    });
    const { enviarSenhaProvisoriaPorEmail } = await import("@/lib/plataforma/ponte.server");
    const uid = "00000000-0000-0000-0000-000000000002";

    expect(await enviarSenhaProvisoriaPorEmail(uid, "Kq7#mT9vR2xP4wZs")).toEqual({ ok: true });
    expect(chamadas[0]!.sql).toContain("plataforma.enviar_senha_provisoria_agilliza");
    expect(chamadas[0]!.params).toEqual([
      uid,
      "Kq7#mT9vR2xP4wZs",
      "https://crm.agillizatech.com.br",
    ]);

    falhar = {
      code: "P0001",
      message: "Muitos envios de senha para esta pessoa. Aguarde uma hora e tente de novo.",
    };
    const r = await enviarSenhaProvisoriaPorEmail(uid, "Outra#Senha-2345");
    expect(r).toEqual({ ok: false, motivo: falhar.message });

    falhar = { code: "XX000", message: "erro interno com Outra#Senha-2345" };
    const r2 = await enviarSenhaProvisoriaPorEmail(uid, "Outra#Senha-2345");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.motivo).not.toContain("Outra#Senha");
    expect(erros.join("\n")).not.toContain("Senha-2345");
    spy.mockRestore();
  });

  it("e-mail configurado só com credencial E remetente (sem segredo no retorno)", async () => {
    vi.stubEnv("PONTE_DATABASE_URL", "postgres://ponte@127.0.0.1:1/x");
    vi.stubEnv("CORRETOR_KEK", "kek-de-teste");
    let segredo: Record<string, string> | null = null;
    vi.doMock("pg", () => {
      const cliente = {
        async query(sql: string) {
          if (/credencial_do_sistema/.test(sql))
            return { rows: [{ c: segredo ? { base_url: null, segredo } : null }] };
          return { rows: [] };
        },
        release() {},
      };
      class Pool {
        on() {}
        listenerCount() {
          return 1;
        }
        async connect() {
          return cliente;
        }
        async query() {
          return { rows: [] };
        }
      }
      return { default: { Pool }, Pool };
    });
    const { emailConfiguradoNaPlataforma } = await import("@/lib/plataforma/ponte.server");
    expect(await emailConfiguradoNaPlataforma()).toBe(false);
    segredo = { SENDPULSE_API_ID: "id", SENDPULSE_API_SECRET: "s" };
    expect(await emailConfiguradoNaPlataforma()).toBe(false); // sem remetente
    segredo = { SENDPULSE_API_ID: "id", SENDPULSE_API_SECRET: "s", EMAIL_REMETENTE: "a@b.com" };
    expect(await emailConfiguradoNaPlataforma()).toBe(true);
    segredo = { RESEND_API_KEY: "k", EMAIL_REMETENTE: "a@b.com" };
    expect(await emailConfiguradoNaPlataforma()).toBe(true);
    segredo = { SENDPULSE_API_ID: "id", EMAIL_REMETENTE: "a@b.com" };
    expect(await emailConfiguradoNaPlataforma()).toBe(false); // provedor incompleto
  });

  it("conferir o envio: a frase do banco chega à tela e nada é trocado", async () => {
    vi.stubEnv("PONTE_DATABASE_URL", "postgres://ponte@127.0.0.1:1/x");
    vi.doMock("pg", () => {
      class Pool {
        on() {}
        listenerCount() {
          return 1;
        }
        async query() {
          throw Object.assign(
            new Error("Muitos envios de senha para esta pessoa. Aguarde uma hora e tente de novo."),
            {
              code: "P0001",
            },
          );
        }
      }
      return { default: { Pool }, Pool };
    });
    const { conferirEnvioDeSenha } = await import("@/lib/plataforma/ponte.server");
    await expect(
      conferirEnvioDeSenha("00000000-0000-0000-0000-000000000003", true),
    ).rejects.toThrow(/Muitos envios de senha.*Nada foi alterado\./);
  });
});
