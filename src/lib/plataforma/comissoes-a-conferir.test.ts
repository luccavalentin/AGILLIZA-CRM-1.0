/**
 * Comissão "a_conferir" (migração 0481 do Corretor): a base veio só do valor que a
 * conta informou. A tela de comissões dos assinantes mostra o selo "Em conferência",
 * filtra, soma à parte e confere — com a base corrigida se preciso — passando para
 * "a pagar" pela função da 0495 (`plataforma.conferir_comissao_assinante`).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BASE_MAXIMA_CONFERENCIA,
  calcularComissao,
  normalizarTotais,
  observacaoDaConferencia,
  problemaNaBase,
  STATUS_COMISSAO_ASSINANTE,
} from "./comissoes-assinantes.functions";

const SRC = join(__dirname, "..", "..");
const fns = readFileSync(join(SRC, "lib/plataforma/comissoes-assinantes.functions.ts"), "utf8");
const tela = readFileSync(join(SRC, "routes/_authenticated/plataforma.comissoes.tsx"), "utf8");

describe("comissões em conferência", () => {
  it("a situação a_conferir é filtrável", () => {
    expect(STATUS_COMISSAO_ASSINANTE).toContain("a_conferir");
    expect(fns).toContain("status: z.enum(STATUS_COMISSAO_ASSINANTE).nullable().optional()");
  });

  it("o total em conferência vem à parte e não some com banco antigo", () => {
    expect(normalizarTotais({ a_pagar: 10, a_conferir: 7.5, pagas: 3, quantidade: 4 })).toEqual({
      a_pagar: 10,
      a_conferir: 7.5,
      pagas: 3,
      quantidade: 4,
    });
    expect(normalizarTotais({ a_pagar: 10, pagas: 3, quantidade: 2 }).a_conferir).toBe(0);
    expect(normalizarTotais(null)).toEqual({ a_pagar: 0, a_conferir: 0, pagas: 0, quantidade: 0 });
  });

  it("conferir não aceita voltar para a conferir: só a pagar, paga ou cancelada", () => {
    const atualizar = fns.slice(fns.indexOf("export const atualizarComissaoAssinante"));
    expect(atualizar).toContain('status: z.enum(["a_pagar", "paga", "cancelada"])');
    expect(atualizar).toContain("plataforma.atualizar_comissao_assinante($1, $2, $3)");
  });

  it("a observação da conferência substitui o 'A conferir' e registra a base", () => {
    const o = observacaoDaConferencia("  conferido   com o contrato ", 250000);
    expect(o).toMatch(
      /^Conferida no Agilliza: base de R\$\s?250\.000,00\. conferido com o contrato$/,
    );
    expect(observacaoDaConferencia("", 1000)).toMatch(
      /^Conferida no Agilliza: base de R\$\s?1\.000,00\.$/,
    );
    expect(observacaoDaConferencia("x".repeat(900), 1).length).toBeLessThanOrEqual(500);
  });

  it("comissão recalculada como o banco: percentual guardado, a centavo, meio centavo para cima", () => {
    expect(calcularComissao(333333.33, 0.25)).toBe(833.33); // 833,333325 (o mesmo do teste 623)
    expect(calcularComissao(2, 0.25)).toBe(0.01); // 0,005 → 0,01
    expect(calcularComissao(400000, 0.25)).toBe(1000);
    expect(calcularComissao(1234567.89, 0.3333)).toBe(4114.81); // 4114,814...
    expect(calcularComissao(0, 0.25)).toBe(0);
    expect(calcularComissao(-10, 0.25)).toBe(0);
  });

  it("a base conferida segue as regras do banco (0495): maior que zero, até R$ 100 milhões", () => {
    expect(BASE_MAXIMA_CONFERENCIA).toBe(100_000_000);
    expect(problemaNaBase(0)).toMatch(/maior que zero/);
    expect(problemaNaBase(-1)).toMatch(/maior que zero/);
    expect(problemaNaBase(Number.NaN)).toMatch(/maior que zero/);
    expect(problemaNaBase(100_000_000.01)).toMatch(/100 milhões/);
    expect(problemaNaBase(100_000_000)).toBeNull();
    expect(problemaNaBase(0.01)).toBeNull();
    const conferir = fns.slice(fns.indexOf("export const conferirComissaoAssinante"));
    expect(conferir).toContain('exigirPermissao(["saas.comissoes", "edit"])');
    expect(conferir).toContain(".positive(");
    expect(conferir).toContain(".max(BASE_MAXIMA_CONFERENCIA");
    expect(conferir).toContain("plataforma.conferir_comissao_assinante($1, $2, $3)");
  });

  it("a tela mostra o selo, o filtro, o total e a conferência com a base editável", () => {
    expect(tela).toMatch(/a_conferir: \{ rotulo: "Em conferência"/);
    expect(tela).toContain('["a_conferir", "a_pagar", "paga", "cancelada", "todas"]');
    expect(tela).toMatch(
      /rotulo="Em conferência"\s+valor=\{formatBRL\(Number\(q\.data\?\.totais\.a_conferir/,
    );
    const conferir = tela.slice(tela.indexOf("function ConferirComissao"));
    // Campo preenchido com a base informada; comissão recalculada ao vivo.
    expect(conferir).toContain("useState(() => maskBRLInput(Number(comissao.base)))");
    expect(conferir).toContain("calcularComissao(baseConferida, Number(comissao.percentual))");
    expect(conferir).toContain("useServerFn(conferirComissaoAssinante)");
    expect(conferir).toMatch(/base: baseConferida/);
    expect(conferir).toContain("disabled={conferir.isPending || !!problema}");
  });

  it("em conferência, a linha só oferece Conferir (ou Cancelar): sem atalho para a pagar/paga", () => {
    const linha = tela.slice(
      tela.indexOf("function LinhaComissao"),
      tela.indexOf("function CancelarComissao"),
    );
    const conferir = linha.indexOf('c.status === "a_conferir" ?');
    expect(conferir).toBeGreaterThan(0);
    expect(conferir).toBeLessThan(linha.indexOf('mudar.mutate("paga")'));
    expect(conferir).toBeLessThan(linha.indexOf('mudar.mutate("a_pagar")'));
    // O banco (0498) recusa o atalho com 55000, e a frase dele passa pela ponte.
    expect(fns).toMatch(/só sai daqui CANCELADA/);
    expect(readFileSync(join(SRC, "lib/plataforma/ponte.server.ts"), "utf8")).toContain('"55000"');
  });
});
