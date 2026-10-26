import { describe, expect, it } from "vitest";
import {
  analisarDocumento,
  disponibilidade,
  documentoDaConsulta,
  fatorDaRestricao,
  finalidadeCurta,
  finalidadeRegistrada,
  formularioValido,
  mascararDigitacao,
  quandoRelativo,
  resumirFicha,
  scoreNaEscala,
  situacaoDoHistorico,
  tomScore,
  validarFormulario,
  type FormularioConsulta,
} from "./logica";
import type { FichaBureau } from "@/lib/bureau/tipos";

// CPF e CNPJ de teste com dígitos verificadores corretos (não pertencem a ninguém real).
const CPF = "52998224725";
const CNPJ = "11222333000181";

const formBase: FormularioConsulta = {
  modo: "digitar",
  cliente: null,
  documento: CPF,
  finalidade: "Análise de crédito para financiamento imobiliário",
  base: "protecao_credito",
  autorizou: false,
};

describe("analisarDocumento", () => {
  it("aceita CPF e CNPJ válidos com ou sem pontuação, espaços e letras soltas", () => {
    expect(analisarDocumento("529.982.247-25")).toMatchObject({ tipo: "F", valido: true, erro: null });
    expect(analisarDocumento(" 529 982 247 25 ")).toMatchObject({ digitos: CPF, valido: true });
    expect(analisarDocumento("11.222.333/0001-81")).toMatchObject({ tipo: "J", valido: true });
    expect(analisarDocumento("cpf: 529x982y247z25")).toMatchObject({ valido: true });
  });

  it("recusa vazio, curto, intermediário (12–13 dígitos) e dígito verificador errado", () => {
    expect(analisarDocumento("").erro).toBe("Digite o CPF ou CNPJ.");
    expect(analisarDocumento(null).valido).toBe(false);
    expect(analisarDocumento("529982247").erro).toMatch(/Complete/);
    expect(analisarDocumento("529982247251").erro).toMatch(/Complete/);
    expect(analisarDocumento("52998224726").erro).toMatch(/inválido/);
    expect(analisarDocumento("11222333000182").valido).toBe(false);
  });

  it("recusa sequências repetidas (passam na conta mas não existem)", () => {
    expect(analisarDocumento("111.111.111-11").valido).toBe(false);
    expect(analisarDocumento("00000000000000").valido).toBe(false);
  });

  it("corta além de 14 dígitos em vez de aceitar documento colado duas vezes", () => {
    expect(analisarDocumento(CPF + CPF).digitos).toHaveLength(14);
  });
});

describe("mascararDigitacao", () => {
  it("pontua conforme o tamanho e ignora o que não é dígito", () => {
    expect(mascararDigitacao(CPF)).toBe("529.982.247-25");
    expect(mascararDigitacao(CNPJ)).toBe("11.222.333/0001-81");
    expect(mascararDigitacao("529a9")).toBe("529.9");
    expect(mascararDigitacao("")).toBe("");
  });
});

describe("validarFormulario", () => {
  it("formulário certo passa", () => {
    expect(formularioValido(validarFormulario(formBase))).toBe(true);
  });

  it("consentimento sem autorização bloqueia; outras bases não exigem", () => {
    const e = validarFormulario({ ...formBase, base: "consentimento" });
    expect(e.autorizacao).toMatch(/autorização/);
    expect(validarFormulario({ ...formBase, base: "consentimento", autorizou: true }).autorizacao).toBeNull();
  });

  it("finalidade curta, só espaços ou longa demais bloqueia", () => {
    expect(validarFormulario({ ...formBase, finalidade: "  ab  " }).finalidade).toMatch(/mínimo/);
    expect(validarFormulario({ ...formBase, finalidade: "x".repeat(301) }).finalidade).toMatch(/300/);
  });

  it("modo CRM sem cliente pede a escolha", () => {
    expect(validarFormulario({ ...formBase, modo: "crm" }).quem).toMatch(/Escolha/);
  });

  it("cliente do CRM com documento mascarado exige digitar; o digitado vai para o bureau", () => {
    const cliente = { id: "c1", nome: "Maria", documento: "***.***.247-**" };
    const sem = { ...formBase, modo: "crm" as const, cliente, documento: "" };
    expect(validarFormulario(sem).quem).toMatch(/não mostra o documento completo/);
    const com = { ...sem, documento: "529.982.247-25" };
    expect(validarFormulario(com).quem).toBeNull();
    expect(documentoDaConsulta(com)).toBe(CPF);
  });

  it("cliente do CRM sem documento cadastrado avisa e aceita o digitado", () => {
    const cliente = { id: "c1", nome: "Maria", documento: null };
    expect(validarFormulario({ ...formBase, modo: "crm", cliente, documento: "" }).quem).toMatch(
      /não tem CPF/,
    );
  });

  it("cliente do CRM com documento inteiro usa o do cadastro, mesmo com lixo no campo", () => {
    const f = { ...formBase, modo: "crm" as const, cliente: { id: "c", nome: "A", documento: CNPJ }, documento: "123" };
    expect(validarFormulario(f).quem).toBeNull();
    expect(documentoDaConsulta(f)).toBe(CNPJ);
  });

  it("cliente do CRM com documento inválido no cadastro não consulta", () => {
    const f = { ...formBase, modo: "crm" as const, cliente: { id: "c", nome: "A", documento: "12345678900" } };
    expect(validarFormulario(f).quem).toMatch(/inválido/);
  });
});

describe("finalidadeRegistrada", () => {
  it("grava finalidade, base legal e autorização num texto só, sem quebra de linha", () => {
    const t = finalidadeRegistrada("  Análise\n de crédito  ", "consentimento", true);
    expect(t).toBe(
      "Análise de crédito · Base legal: Consentimento do titular · autorização do titular confirmada",
    );
    expect(finalidadeCurta(t)).toBe("Análise de crédito");
  });

  it("base desconhecida não quebra e histórico antigo (sem base) aparece inteiro", () => {
    // @ts-expect-error base forjada vinda de fora da tela
    expect(finalidadeRegistrada("Cadastro", "inventada", false)).toMatch(/Não informada/);
    expect(finalidadeCurta("Cadastro de cliente")).toBe("Cadastro de cliente");
    expect(finalidadeCurta(null)).toBe("—");
  });

  it("corta finalidade gigante colada", () => {
    expect(finalidadeRegistrada("y".repeat(1000), "protecao_credito", false).length).toBeLessThan(400);
  });
});

describe("disponibilidade", () => {
  const catalogo = [
    { chave: "serasa", nome: "Serasa Experian", campos: [{ chave: "client_id" }, { chave: "client_secret" }] },
  ];
  it("sem configuração, sem provedor, inativo, sem chaves e sem adaptador ficam indisponíveis", () => {
    expect(disponibilidade(null).motivo).toBe("sem_provedor");
    expect(disponibilidade({ provedor: null, ativo: true, camposPreenchidos: [], catalogo }).motivo).toBe(
      "sem_provedor",
    );
    expect(
      disponibilidade({ provedor: "serasa", ativo: false, camposPreenchidos: [], catalogo }).motivo,
    ).toBe("inativo");
    const semChave = disponibilidade({
      provedor: "serasa",
      ativo: true,
      camposPreenchidos: ["client_id"],
      catalogo,
    });
    expect(semChave).toMatchObject({ motivo: "sem_credenciais", faltando: ["client_secret"] });
    expect(
      disponibilidade({
        provedor: "serasa",
        ativo: true,
        integrado: false,
        camposPreenchidos: ["client_id", "client_secret"],
        catalogo,
      }).motivo,
    ).toBe("nao_integrado");
  });

  it("tudo certo fica disponível e nomeia o fornecedor", () => {
    expect(
      disponibilidade({
        provedor: "serasa",
        ativo: true,
        integrado: true,
        camposPreenchidos: ["client_id", "client_secret"],
        catalogo,
      }),
    ).toMatchObject({ disponivel: true, fornecedor: "Serasa Experian" });
  });
});

describe("score", () => {
  it("leva escalas diferentes para 0–1.000 e prende fora da faixa", () => {
    expect(scoreNaEscala(850, 1000)).toBe(850);
    expect(scoreNaEscala(85, 100)).toBe(850);
    expect(scoreNaEscala(1200, 1000)).toBe(1000);
    expect(scoreNaEscala(-5, 1000)).toBe(0);
    expect(scoreNaEscala("700", null)).toBe(700);
    expect(scoreNaEscala(500, 0)).toBe(500);
  });
  it("valor ausente ou torto vira null, nunca zero", () => {
    expect(scoreNaEscala(null, 1000)).toBeNull();
    expect(scoreNaEscala("", 1000)).toBeNull();
    expect(scoreNaEscala("abc", 1000)).toBeNull();
    expect(scoreNaEscala(Number.NaN, 1000)).toBeNull();
  });
  it("tons nas mesmas faixas da Consulta Ficha dos assinantes", () => {
    expect(tomScore(701)).toBe("sucesso");
    expect(tomScore(700)).toBe("alerta");
    expect(tomScore(501)).toBe("alerta");
    expect(tomScore(500)).toBe("perigo");
    expect(tomScore(null)).toBe("neutro");
  });
});

describe("fatorDaRestricao", () => {
  it("separa protesto, cheque, ação e o resto como pendência, sem depender de acento/caixa", () => {
    expect(fatorDaRestricao({ origem: "Cartório", tipo: "PROTESTO" })).toBe("protestos");
    expect(fatorDaRestricao({ origem: "BACEN", tipo: "Cheque sem fundo (CCF)" })).toBe("cheques");
    expect(fatorDaRestricao({ origem: "TJSP", tipo: "Ação judicial" })).toBe("acoes");
    expect(fatorDaRestricao({ origem: "Serasa", tipo: "Falência requerida" })).toBe("acoes");
    expect(fatorDaRestricao({ origem: "SPC", tipo: "Dívida vencida" })).toBe("pendencias");
    expect(fatorDaRestricao(null)).toBe("pendencias");
  });
});

describe("resumirFicha", () => {
  const ficha: FichaBureau = {
    documento: CPF,
    tipoPessoa: "F",
    nome: "Maria da Silva",
    nascimentoOuFundacao: null,
    situacaoCadastral: "regular",
    score: { valor: 812, maximo: 1000, faixa: "alto", probabilidadeInadimplencia: 3.2, modelo: null },
    restricoes: [
      { origem: "SPC", tipo: "Dívida", descricao: null, valor: 100, credor: "Loja", data: null, local: null },
      { origem: "Cartório", tipo: "Protesto", descricao: null, valor: 250.5, credor: null, data: null, local: "SP" },
    ],
    totalRestricoes: 2,
    valorTotalRestricoes: 0,
    consultasAnteriores: [],
    participacoes: [],
    contatos: [],
    rendaPresumida: null,
    consultadoEm: "2026-10-26T10:00:00Z",
    provedor: "serasa",
  };

  it("ficha completa: score, faixa, fatores, apontamentos e valor somado da lista", () => {
    const r = resumirFicha(ficha);
    expect(r).toMatchObject({
      titulo: "Maria da Silva",
      score: 812,
      tom: "sucesso",
      faixa: "Risco baixo",
      apontamentos: 2,
      valorTotal: 350.5,
      situacao: "Situação regular",
      probabilidade: 3.2,
    });
    expect(r.fatores.find((f) => f.chave === "protestos")?.valor).toBe(1);
    expect(r.fatores.find((f) => f.chave === "cheques")?.valor).toBe(0);
  });

  it("sem lista de restrições: nada vira 'nada consta' — só o total informado aparece", () => {
    const r = resumirFicha({ ...ficha, restricoes: undefined as never, totalRestricoes: 3 });
    expect(r.apontamentos).toBe(3);
    expect(r.fatores.find((f) => f.chave === "protestos")?.valor).toBeNull();
    const vazio = resumirFicha({ ...ficha, restricoes: undefined as never, totalRestricoes: undefined as never });
    expect(vazio.apontamentos).toBeNull();
    expect(vazio.fatores.every((f) => f.valor == null)).toBe(true);
  });

  it("total maior que a lista conta a diferença como pendência", () => {
    const r = resumirFicha({ ...ficha, totalRestricoes: 5 });
    expect(r.apontamentos).toBe(5);
    expect(r.fatores.find((f) => f.chave === "pendencias")?.valor).toBe(4);
  });

  it("sem score, com score torto ou com probabilidade impossível", () => {
    expect(resumirFicha({ ...ficha, score: null }).score).toBeNull();
    expect(resumirFicha({ ...ficha, score: null }).tom).toBe("neutro");
    const torto = resumirFicha({ ...ficha, score: { valor: "N/D" as never, maximo: 1000, faixa: "xyz" as never, probabilidadeInadimplencia: 140, modelo: null } });
    expect(torto).toMatchObject({ score: null, faixa: null, probabilidade: null });
  });

  it("ficha nula, vazia ou com itens nulos na lista não quebra", () => {
    expect(resumirFicha(null).titulo).toBeNull();
    expect(resumirFicha({}).apontamentos).toBeNull();
    const r = resumirFicha({ ...ficha, restricoes: [null as never, ficha.restricoes[0]], totalRestricoes: 1 });
    expect(r.apontamentos).toBe(1);
  });

  it("valor total informado pelo fornecedor tem prioridade sobre a soma", () => {
    expect(resumirFicha({ ...ficha, valorTotalRestricoes: 999 }).valorTotal).toBe(999);
    expect(resumirFicha({ ...ficha, restricoes: [], totalRestricoes: 0 }).valorTotal).toBeNull();
  });
});

describe("situacaoDoHistorico", () => {
  const agora = Date.parse("2026-10-26T12:00:00Z");
  it("traduz cada código do servidor", () => {
    expect(situacaoDoHistorico({ sucesso: true, erro: null, created_at: "" }).texto).toBe("Concluída");
    expect(situacaoDoHistorico({ sucesso: false, erro: "sem_provedor", created_at: "" }).texto).toMatch(/Sem bureau/);
    expect(
      situacaoDoHistorico({ sucesso: false, erro: "sem_credenciais: client_id", created_at: "" }).texto,
    ).toBe("Chaves incompletas");
    expect(situacaoDoHistorico({ sucesso: false, erro: "adaptador_ausente", created_at: "" }).texto).toMatch(
      /homologação/,
    );
    expect(situacaoDoHistorico({ sucesso: false, erro: "timeout 504", created_at: "" }).tom).toBe("perigo");
    expect(situacaoDoHistorico({ sucesso: false, erro: null, created_at: "" }).texto).toBe("Não entregue");
  });
  it("sem retorno recente é 'Consultando'; antigo ou com data torta é falta de retorno", () => {
    expect(
      situacaoDoHistorico({ sucesso: false, erro: "sem_retorno", created_at: "2026-10-26T11:59:00Z" }, agora).texto,
    ).toBe("Consultando");
    expect(
      situacaoDoHistorico({ sucesso: false, erro: "sem_retorno", created_at: "2026-10-26T11:00:00Z" }, agora).texto,
    ).toMatch(/Sem retorno/);
    expect(situacaoDoHistorico({ sucesso: false, erro: "sem_retorno", created_at: "lixo" }, agora).texto).toMatch(
      /Sem retorno/,
    );
  });
});

describe("quandoRelativo", () => {
  const agora = Date.parse("2026-10-26T12:00:00Z");
  it("escreve tempos curtos e cai para a data depois de uma semana", () => {
    expect(quandoRelativo("2026-10-26T11:59:40Z", agora)).toBe("agora");
    expect(quandoRelativo("2026-10-26T11:55:00Z", agora)).toBe("há 5 min");
    expect(quandoRelativo("2026-10-26T09:00:00Z", agora)).toBe("há 3 h");
    expect(quandoRelativo("2026-10-25T11:00:00Z", agora)).toBe("ontem");
    expect(quandoRelativo("2026-10-01T12:00:00Z", agora)).toBe("01/10/2026");
    expect(quandoRelativo("não é data", agora)).toBe("—");
  });
});
