import { describe, expect, it } from "vitest";
import {
  papelDoParticipante,
  payloadCompletarParticipante,
  repetirEmFalhaDoServidor,
} from "./completar-participantes";

const erroHttp = (statusHttp: number) => Object.assign(new Error(`HTTP ${statusHttp}`), { statusHttp });

describe("repetirEmFalhaDoServidor", () => {
  it("tenta de novo quando a HomeFin devolve 500 e devolve o primeiro sucesso", async () => {
    let chamadas = 0;
    const r = await repetirEmFalhaDoServidor(async () => {
      chamadas++;
      if (chamadas < 3) throw erroHttp(500);
      return "ok";
    }, [0, 0, 0]);
    expect(r).toBe("ok");
    expect(chamadas).toBe(3);
  });

  it("desiste depois das tentativas e repassa o erro", async () => {
    let chamadas = 0;
    await expect(
      repetirEmFalhaDoServidor(async () => {
        chamadas++;
        throw erroHttp(503);
      }, [0, 0]),
    ).rejects.toThrow("HTTP 503");
    expect(chamadas).toBe(3);
  });

  it("não repete erro do pedido (4xx)", async () => {
    let chamadas = 0;
    await expect(
      repetirEmFalhaDoServidor(async () => {
        chamadas++;
        throw erroHttp(400);
      }, [0, 0]),
    ).rejects.toThrow("HTTP 400");
    expect(chamadas).toBe(1);
  });
});

/** Participante como a HomeFin devolve logo após o `POST /oportunidade`. */
const titularHomefin = {
  idParticipante: 38527,
  tipoSituacao: "A",
  nomeParticipante: "VICTOR TESTE",
  tipoQualificacao: "CO",
  tipoPessoa: "F",
  cpfCnpj: "39927487827",
  dataNascimento: "1990-09-21",
  tipoEstadoCivil: "CA",
  renda: 60000,
  compradorPrincipal: "S",
  email: "a@b.com",
  celular: "19991586355",
  utilizaFgts: "N",
  tipoSexo: null,
  nomeMae: null,
  tipoRegimeCasamento: null,
  numeroDocumento: null,
  cep: null,
  logradouro: null,
};
const conjugeHomefin = {
  ...titularHomefin,
  idParticipante: 38528,
  nomeParticipante: "VIVIANE TESTE",
  cpfCnpj: "41836568851",
  renda: 3000,
  compradorPrincipal: "N",
};

const sim = {
  cpf_cnpj: "39927487827",
  nome_cliente: "Victor Teste",
  data_nascimento: "1990-09-21",
  estado_civil: "CA",
  sexo: "M",
  regime_casamento: "comunhao_parcial",
  renda_total: 60000,
  celular: "(19) 99158-6355",
  utiliza_fgts: "N",
  uf: "SP",
  nome_conjuge: "Viviane Teste",
  cpf_conjuge: "418.365.688-51",
  data_nascimento_conjuge: "1992-09-25",
  estado_civil_conjuge: "CA",
  sexo_conjuge: "F",
  renda_conjuge: 3000,
};
const cliente = {
  mae: "Mae do Victor",
  profissao: "Engenheiro",
  empresa: "Empresa X",
  tipo_documento_identidade: "RG",
  numero_documento: "123456789",
  orgao_expedidor: "SSP",
  uf_expedicao: "SP",
  data_expedicao: "2010-01-01",
  conjuge_nome_mae: "Mae da Viviane",
  conjuge_profissao: null,
};

describe("papelDoParticipante", () => {
  it("reconhece titular e cônjuge pelo CPF, mesmo formatado", () => {
    expect(papelDoParticipante(titularHomefin, sim)).toBe("titular");
    expect(papelDoParticipante(conjugeHomefin, sim)).toBe("conjuge");
  });
  it("ignora vendedor, PJ e terceiros", () => {
    expect(papelDoParticipante({ ...titularHomefin, tipoQualificacao: "VD" }, sim)).toBeNull();
    expect(papelDoParticipante({ cpfCnpj: "12345678000199" }, sim)).toBeNull();
    expect(papelDoParticipante({ cpfCnpj: "11122233344" }, sim)).toBeNull();
  });
});

describe("payloadCompletarParticipante", () => {
  it("completa o titular com o cadastro e mantém o que já está na HomeFin", () => {
    const p = payloadCompletarParticipante(titularHomefin, "titular", sim, cliente)!;
    expect(p).not.toBeNull();
    expect(p.tipoSexo).toBe("M");
    expect(p.tipoRegimeCasamento).toBe("CP");
    expect(p.nomeMae).toBe("Mae do Victor");
    expect(p.numeroDocumento).toBe("123456789");
    expect(p.nomeProfissao).toBe("Engenheiro");
    expect(p.nomeEmpresaProfissao).toBe("Empresa X");
    expect(String(p.cep)).toHaveLength(8);
    expect(p.logradouro).toBeTruthy();
    // Já preenchido na HomeFin: não muda.
    expect(p.nomeParticipante).toBe("VICTOR TESTE");
    expect(p.renda).toBe(60000);
    // Campo fora do contrato não vai.
    expect(p).not.toHaveProperty("compradorPrincipal");
    expect(p).not.toHaveProperty("idParticipante");
  });

  it("titular casado leva os dados do cônjuge", () => {
    const p = payloadCompletarParticipante(titularHomefin, "titular", sim, cliente)!;
    expect(p.nomeConjuge).toBe("Viviane Teste");
    expect(p.cpfConjuge).toBe("41836568851");
    expect(p.tipoSexoConjuge).toBe("F");
    expect(p.tipoEstadoCivilConjuge).toBe("CA");
  });

  it("cônjuge recebe a própria filiação, sexo e o titular como parceiro; padrão onde o cadastro está vazio", () => {
    const p = payloadCompletarParticipante(conjugeHomefin, "conjuge", sim, cliente)!;
    expect(p.tipoSexo).toBe("F");
    expect(p.nomeMae).toBe("Mae da Viviane");
    expect(p.numeroDocumento).toBe("418365688");
    expect(p.nomeProfissao).toBe("Administrador");
    expect(p.nomeConjuge).toBe("Victor Teste");
    expect(p.cpfConjuge).toBe("39927487827");
    expect(p.tipoSexoConjuge).toBe("M");
  });

  it("solteiro não ganha regime nem cônjuge", () => {
    const solteiro = { ...sim, estado_civil: "S", nome_conjuge: null, cpf_conjuge: null };
    const p = payloadCompletarParticipante(
      { ...titularHomefin, tipoEstadoCivil: "S" },
      "titular",
      solteiro,
      {},
    )!;
    expect(p.tipoRegimeCasamento).toBeUndefined();
    expect(p.nomeConjuge).toBeUndefined();
    expect(p.nomeMae).toBe("Maria José");
  });

  it("participante já completo não gera PUT", () => {
    const completo = payloadCompletarParticipante(titularHomefin, "titular", sim, cliente)!;
    expect(
      payloadCompletarParticipante({ ...titularHomefin, ...completo }, "titular", sim, cliente),
    ).toBeNull();
  });
});
