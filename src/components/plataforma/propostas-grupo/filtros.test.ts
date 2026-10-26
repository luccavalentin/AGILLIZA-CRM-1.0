/**
 * C31 (26/10/2026): "teste todos os filtros… e a interligação". Cada filtro das propostas dos
 * assinantes, a URL, e o caminho fila → levar ao Agilliza → envio → retorno do status.
 *
 * O lado do banco tem pgTAP no Agilliza Tech: 710 (grupo, licença de outro grupo, ID H.,
 * "sem_no_agilliza"), 711 (contrato registrado), 712 (o envio do Agilliza acha a simulação e o
 * banco da conta), 523/524 (etapas e acompanhamento), 592/623 (vínculo e comissão no registro).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROTULO_PROPOSTA_ASSINANTE } from "@/lib/plataforma/rotulos-proposta-assinante";
import {
  chipsAtivos,
  etapaDaEsteira,
  FILTROS_VAZIOS,
  lerFiltrosDaUrl,
  normalizarFiltros,
  paramsDosFiltros,
  passoDaInterligacao,
  payloadDosFiltros,
  rotuloIdH,
  semFiltro,
  statusValido,
  validarBuscaPropostas,
} from "./filtros";

const CONTA = "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const PESSOA = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const assinantes = { grupo: "assinantes" as const, licenca: null, semNoAgilliza: false };
const umaConta = { grupo: "assinantes" as const, licenca: CONTA, semNoAgilliza: false };

describe("cada filtro", () => {
  it("situação: só as que existem no Agilliza Tech", () => {
    expect(statusValido("aprovada")).toBe("aprovada");
    expect(statusValido("registrado")).toBe("registrado");
    expect(statusValido("aprovada'; drop table x")).toBeNull();
    expect(statusValido("toString")).toBeNull(); // nada do protótipo do objeto
    expect(statusValido(" ")).toBeNull();
  });
  it("as situações cobrem toda a régua do banco (inclusive Contrato registrado)", () => {
    // Mesma lista do CHECK de operacional.propostas.status (Agilliza Tech).
    expect(Object.keys(ROTULO_PROPOSTA_ASSINANTE).sort()).toEqual(
      [
        "aguardando_correspondente", "em_envio", "enviada", "em_analise", "aguardando_documentos",
        "condicionada", "aprovada", "recusada", "erro_envio", "formularios", "engenharia_vistoria",
        "analise_juridica", "contrato", "registrado", "cancelada",
      ].sort(),
    );
    expect(ROTULO_PROPOSTA_ASSINANTE.registrado).toBe("Contrato registrado");
    expect(JSON.stringify(ROTULO_PROPOSTA_ASSINANTE)).not.toMatch(/homefin/i);
  });
  it("banco: id do Agilliza Tech, nada torto", () => {
    expect(normalizarFiltros({ banco: "bradesco" }).banco).toBe("bradesco");
    expect(normalizarFiltros({ banco: "Bradesco" }).banco).toBeNull();
    expect(normalizarFiltros({ banco: "x' or 1=1" }).banco).toBeNull();
  });
  it("período: data inválida some; invertido é trocado", () => {
    expect(normalizarFiltros({ de: "2026-02-31" }).de).toBeNull();
    expect(normalizarFiltros({ de: "31/10/2026" }).de).toBeNull();
    const n = normalizarFiltros({ de: "2026-10-20", ate: "2026-10-01" });
    expect([n.de, n.ate]).toEqual(["2026-10-01", "2026-10-20"]);
  });
  it("responsável: só vale com uma conta escolhida", () => {
    const f = normalizarFiltros({ usuario: PESSOA });
    expect(payloadDosFiltros(f, assinantes)?.usuario).toBeNull();
    expect(payloadDosFiltros(f, umaConta)?.usuario).toBe(PESSOA);
    expect(normalizarFiltros({ usuario: "eu" }).usuario).toBeNull();
  });
  it("analista: uuid ou \"sem\"", () => {
    expect(normalizarFiltros({ analista: "sem" }).analista).toBe("sem");
    expect(normalizarFiltros({ analista: PESSOA.toUpperCase() }).analista).toBe(PESSOA);
    expect(normalizarFiltros({ analista: "todos" }).analista).toBeNull();
  });
  it("aceite e página", () => {
    expect(normalizarFiltros({ aceite: "pendentes" }).aceite).toBe("pendentes");
    expect(normalizarFiltros({ aceite: "outra" }).aceite).toBe("todas");
    expect(normalizarFiltros({ pagina: "3" }).pagina).toBe(3);
    expect(normalizarFiltros({ pagina: "-1" }).pagina).toBe(1);
    expect(normalizarFiltros({ pagina: "1e9" }).pagina).toBe(1);
    expect(normalizarFiltros({ pagina: "2.5" }).pagina).toBe(1);
  });
  it("busca: acento, ID H. e tamanho", () => {
    expect(normalizarFiltros({ termo: "  João  " }).termo).toBe("João");
    expect(payloadDosFiltros(normalizarFiltros({ termo: "7106543" }), assinantes)?.termo).toBe("7106543");
    expect(normalizarFiltros({ termo: "x".repeat(500) }).termo).toHaveLength(120);
    expect(payloadDosFiltros(FILTROS_VAZIOS, assinantes)?.termo).toBeNull();
  });
  it("grupo: sem grupo não consulta nada; Sua base esconde o que já veio ao Agilliza", () => {
    expect(payloadDosFiltros(FILTROS_VAZIOS, { grupo: null, licenca: null, semNoAgilliza: false })).toBeNull();
    expect(
      payloadDosFiltros(FILTROS_VAZIOS, { grupo: "vinculados", licenca: null, semNoAgilliza: true }),
    ).toMatchObject({ grupo: "vinculados", semNoAgilliza: true });
  });
});

describe("URL", () => {
  it("ida e volta sem perda; padrão não suja o endereço", () => {
    expect(paramsDosFiltros(FILTROS_VAZIOS)).toEqual({});
    const f = normalizarFiltros({
      status: "aprovada", banco: "itau", de: "2026-10-01", ate: "2026-10-20", usuario: PESSOA,
      analista: "sem", aceite: "minhas", termo: "Ana", pagina: 2,
    });
    expect(lerFiltrosDaUrl(paramsDosFiltros(f))).toEqual(f);
  });
  it("URL torta vira filtro vazio, sem erro", () => {
    expect(lerFiltrosDaUrl({ situacao: 1, banco: {}, de: [], pag: "abc", aceite: null })).toEqual(FILTROS_VAZIOS);
    expect(lerFiltrosDaUrl(null)).toEqual(FILTROS_VAZIOS);
  });
  it("rota: o endereço antigo ?aba=assinantes abre Assinantes; lixo é descartado", () => {
    expect(validarBuscaPropostas({ aba: "assinantes" })).toEqual({ base: "assinantes" });
    expect(validarBuscaPropostas({ base: "assinantes", conta: CONTA, situacao: "aprovada", x: "1" })).toEqual({
      base: "assinantes",
      conta: CONTA,
      situacao: "aprovada",
    });
    expect(validarBuscaPropostas({ conta: "lixo", situacao: "nada" })).toEqual({});
  });
});

describe("chips", () => {
  it("um chip por filtro, e tirar um volta à página 1", () => {
    const f = normalizarFiltros({ status: "aprovada", banco: "itau", de: "2026-10-01", analista: "sem", pagina: 4 });
    const chips = chipsAtivos(f);
    expect(chips.map((c) => c.rotulo)).toEqual(["Aprovada", "Itaú", "Desde 01/10/2026", "Sem analista"]);
    const sem = semFiltro(f, "banco");
    expect(sem.banco).toBeNull();
    expect(sem.pagina).toBe(1);
    expect(semFiltro(normalizarFiltros({ de: "2026-10-01", ate: "2026-10-05" }), "ate")).toMatchObject({ de: null, ate: null });
  });
  it("nomes de responsável e analista aparecem quando conhecidos", () => {
    const f = normalizarFiltros({ usuario: PESSOA, analista: PESSOA });
    expect(chipsAtivos(f, { usuarios: { [PESSOA]: "Bia" }, analistas: { [PESSOA]: "Rui" } }).map((c) => c.rotulo)).toEqual([
      "Responsável: Bia",
      "Analista: Rui",
    ]);
  });
});

describe("identificação e esteira (C33/C12)", () => {
  it("ID H., nunca o nome do provedor", () => {
    expect(rotuloIdH("7106543")).toBe("ID H. 7106543");
    expect(rotuloIdH(null)).toBe("ID H. —");
    expect(rotuloIdH("  ")).toBe("ID H. —");
  });
  it("Contrato registrado é a última etapa", () => {
    expect(etapaDaEsteira("registrado")).toBe(6);
    expect(etapaDaEsteira("contrato")).toBe(5);
    expect(etapaDaEsteira("cancelada")).toBe(-1);
  });
});

describe("interligação fila → levar ao Agilliza → envio → retorno", () => {
  it("pendente: alguém precisa assumir", () => {
    expect(passoDaInterligacao({ status: "aguardando_correspondente", pendente: true, minha: false })).toBe("assumir");
  });
  it("minha e aguardando: levar ao Agilliza e enviar (o erro de envio volta para cá)", () => {
    expect(passoDaInterligacao({ status: "aguardando_correspondente", pendente: false, minha: true })).toBe("levar_e_enviar");
    expect(passoDaInterligacao({ status: "erro_envio", pendente: false, minha: true })).toBe("levar_e_enviar");
  });
  it("de outro analista: não é minha para enviar", () => {
    expect(passoDaInterligacao({ status: "aguardando_correspondente", pendente: false, minha: false })).toBe("com_outro");
  });
  it("já enviada pelo Agilliza: acompanha (o status volta ao assinante pela 0179)", () => {
    expect(
      passoDaInterligacao({ status: "em_analise", pendente: false, minha: true, proposta_agilliza_id: CONTA }),
    ).toBe("acompanhar");
    expect(
      passoDaInterligacao({ status: "registrado", pendente: false, minha: true, proposta_agilliza_id: CONTA }),
    ).toBe("acompanhar");
  });
  it("encerrada sem passar pelo Agilliza", () => {
    expect(passoDaInterligacao({ status: "cancelada", pendente: false, minha: false })).toBe("encerrada");
  });

  const fonte = (p: string) => readFileSync(join(__dirname, "..", "..", "..", p), "utf8");
  it("as ações da fila são as do fluxo do Agilliza (preparar → enviar para aprovação → acompanhar)", () => {
    const hooks = fonte("components/plataforma/fila-assinantes/hooks.ts");
    expect(hooks).toContain("prepararFn({ data: { id: p.id, assumir: p.pendente } })");
    expect(hooks).toContain("enviarAprovacao({");
    expect(hooks).toContain('to: "/operacional/propostas/$id"');
  });
  it("o painel recarrega com as ações (mesma chave da fila) e lê pela função do banco", () => {
    expect(fonte("components/plataforma/propostas-grupo/painel.tsx")).toContain('["plataforma-fila", "grupo"');
    const fn = fonte("lib/plataforma/filtro-base.functions.ts");
    expect(fn).toContain("plataforma.consultar_propostas($1::jsonb)");
    expect(fn).toContain("anotarVinculoAgilliza(tx");
    // Responsável só vai ao banco com uma conta escolhida (os usuários são da conta).
    expect(fn).toContain("usuario: data.licenca ? (data.usuario ?? null) : null");
  });
  it("nenhuma tela das propostas dos assinantes escreve o nome do provedor", () => {
    for (const p of [
      "components/plataforma/propostas-grupo/painel.tsx",
      "components/plataforma/fila-assinantes/lista.tsx",
      "components/plataforma/fila-assinantes/detalhe.tsx",
    ]) {
      expect(fonte(p).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")).not.toMatch(/HomeFin/);
    }
  });
});
