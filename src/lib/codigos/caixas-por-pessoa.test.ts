/**
 * Decisão 16 do backtest de 23/10/2026: cada pessoa vê só as caixas de e-mail
 * vigiadas que foram liberadas para ela; quem gere as caixas (`operacional.codigos
 * › edit`) vê todas e libera. A regra mora no banco (migração 20261026150000) e o
 * servidor só lê por ela — esconder na tela não protege nada.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const fns = readFileSync(join(SRC, "lib/codigos/codigos.functions.ts"), "utf8");
const migracao = readFileSync(
  join(SRC, "..", "supabase/migrations/20261026150000_codigos_caixas_por_pessoa.sql"),
  "utf8",
);

function corpo(nome: string): string {
  const ini = fns.indexOf(`export const ${nome}`);
  expect(ini, nome).toBeGreaterThan(0);
  const fim = fns.indexOf("export const", ini + 10);
  return fns.slice(ini, fim > 0 ? fim : undefined);
}

describe("códigos de acesso: caixas por pessoa (servidor)", () => {
  it("os códigos vêm filtrados pelo banco, nunca da tabela inteira", () => {
    const c = corpo("listarCodigos");
    expect(c).toContain('rpc("codigos_recebidos_visiveis"');
    expect(c).toContain("_user_id: context.userId");
    expect(c).not.toMatch(/from\("codigos_recebidos"\)/);
  });

  it("as caixas listadas são só as visíveis para a pessoa", () => {
    const c = corpo("listarCaixas");
    expect(c).toContain("caixasVisiveis(db, context.userId)");
    expect(c).toMatch(/\.in\("id", ids\)/);
    // Quem está liberado em cada caixa só vai para quem gere as caixas.
    expect(c).toMatch(/if \(await geraCaixas\(db, context\.userId\)\)/);
    expect(fns).toContain('rpc("codigos_caixas_visiveis"');
    expect(fns).toContain('rpc("codigos_ve_todas_caixas"');
  });

  it("liberar passa pela função do banco, com quem libera; e só quem edita lista a equipe", () => {
    const s = corpo("salvarCaixa");
    expect(s).toContain('rpc("codigos_definir_liberados"');
    expect(s).toContain("_por: context.userId");
    expect(s).not.toMatch(/from\("codigos_caixas_liberadas"\)\s*\.(insert|upsert|delete)/);
    const p = corpo("listarPessoasParaCaixas");
    expect(p).toContain('exigirPermissao(["operacional.codigos", "edit"])');
    expect(p).toContain('rpc("codigos_pessoas_para_liberar", { _por: context.userId })');
  });

  it("toda server function dos códigos segue exigindo a equipe interna", () => {
    for (const nome of [
      "listarCodigos",
      "listarCaixas",
      "listarPessoasParaCaixas",
      "salvarCaixa",
      "removerCaixa",
    ]) {
      expect(corpo(nome), nome).toContain("await exigirEquipeInterna(context.userId)");
    }
  });
});

describe("códigos de acesso: caixas por pessoa (banco)", () => {
  it("quem edita vê todas; quem só vê precisa estar liberado; parceiro/bloqueado nunca", () => {
    expect(migracao).toMatch(
      /codigos_ve_todas_caixas[\s\S]*codigos_equipe_interna\(_user_id\)\s*and public\.usuario_tem_permissao\(_user_id, 'operacional\.codigos', 'edit'\)/,
    );
    expect(migracao).toMatch(
      /codigos_caixas_visiveis[\s\S]*usuario_tem_permissao\(_user_id, 'operacional\.codigos', 'view'\)[\s\S]*codigos_caixas_liberadas l/,
    );
    expect(migracao).toMatch(
      /p\.acesso_tipo = 'sistema'[\s\S]*p\.bloqueado_em is null and p\.deleted_at is null/,
    );
  });

  it("liberar exige quem gere e só aceita equipe interna do mesmo correspondente", () => {
    expect(migracao).toMatch(
      /if not public\.codigos_ve_todas_caixas\(_por\) then[\s\S]*errcode = '42501'/,
    );
    expect(migracao).toMatch(/correspondente_id is not distinct from v_corresp/);
  });

  it("nada abre para o navegador: tabela e funções só para o client de serviço", () => {
    expect(migracao).toMatch(
      /revoke all on public\.codigos_caixas_liberadas from anon, authenticated;/,
    );
    for (const f of [
      "codigos_equipe_interna(uuid)",
      "codigos_ve_todas_caixas(uuid)",
      "codigos_caixas_visiveis(uuid)",
      "codigos_recebidos_visiveis(uuid, timestamptz, int)",
      "codigos_definir_liberados(uuid, uuid[], uuid)",
      "codigos_pessoas_para_liberar(uuid)",
    ]) {
      expect(migracao, f).toContain(
        `revoke all on function public.${f} from public, anon, authenticated;`,
      );
      expect(migracao, f).toContain(`grant execute on function public.${f} to service_role;`);
    }
  });
});
