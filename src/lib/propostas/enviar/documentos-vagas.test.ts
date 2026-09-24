import { describe, expect, it } from "vitest";
import { termosDoTipoDocumento } from "@/lib/documentos/tipos-banco";
import {
  arquivoDoDocumento,
  vagaDeReserva,
  categoriaDaVaga,
  vagaAceitaCategoria,
  donoDoDocumento,
  ignoradoDoItem,
  nomeArquivoNaHomefin,
  pontuarVaga,
  situacaoDoItem,
} from "./documentos-vagas";

const envolvidos = [
  { id: "t", cliente_id: "cli-1", nome: "Cleitom de Oliveira", tipo_qualificacao: "CO" },
  { id: "c", cliente_id: null, nome: "Layza Cristina", tipo_qualificacao: "TI", conjuge_de: "t" },
  { id: "v", cliente_id: null, nome: "Marcos Vendedor", tipo_qualificacao: "VD" },
  { id: "vc", cliente_id: null, nome: "Ana Vendedora", tipo_qualificacao: "TI", conjuge_de: "v" },
];

describe("donoDoDocumento", () => {
  it("usa a categoria, não o cadastro onde o arquivo ficou", () => {
    const base = { cliente_id: "cli-1" };
    expect(donoDoDocumento({ ...base, categoria: "comprador" }, envolvidos)).toBe(
      "Cleitom de Oliveira",
    );
    expect(donoDoDocumento({ ...base, categoria: "conjuge" }, envolvidos)).toBe("Layza Cristina");
    expect(donoDoDocumento({ ...base, categoria: "vendedor" }, envolvidos)).toBe("Marcos Vendedor");
    expect(donoDoDocumento({ ...base, categoria: "vendedor_conjuge" }, envolvidos)).toBe(
      "Ana Vendedora",
    );
    expect(donoDoDocumento({ ...base, categoria: "imovel" }, envolvidos)).toBe("Imóvel");
    expect(donoDoDocumento({ ...base, categoria: "outros" }, envolvidos)).toBe("");
  });
});

describe("pontuarVaga", () => {
  const nomes = envolvidos.map((e) => e.nome);
  const rg = (referente: string) => ({ nomeDocumento: "RG", referente, arquivos: [] });
  const identidade = { termos: termosDoTipoDocumento("c_doc_id"), alvo: "scan001.pdf" };

  it("RG do vendedor nunca ocupa a vaga de RG do comprador", () => {
    expect(pontuarVaga(rg("Cleitom de Oliveira"), identidade, "Marcos Vendedor", nomes)).toBe(-1);
    expect(
      pontuarVaga(rg("Marcos Vendedor"), identidade, "Marcos Vendedor", nomes),
    ).toBeGreaterThan(100);
  });

  it("chave interna do checklist acha a vaga mesmo com arquivo sem nome útil", () => {
    const certidao = {
      nomeDocumento: "Certidão de Casamento",
      referente: "Cleitom de Oliveira",
      arquivos: [],
    };
    const doc = { termos: termosDoTipoDocumento("c_cert_ec"), alvo: "scan001.pdf" };
    expect(pontuarVaga(certidao, doc, "Cleitom de Oliveira", nomes)).toBeGreaterThan(150);
    // A vaga específica ganha da genérica.
    const generica = { nomeDocumento: "Certidão", referente: "Cleitom de Oliveira", arquivos: [] };
    expect(pontuarVaga(certidao, doc, "Cleitom de Oliveira", nomes)).toBeGreaterThan(
      pontuarVaga(generica, doc, "Cleitom de Oliveira", nomes),
    );
  });

  it("documento do imóvel vai para a vaga do imóvel", () => {
    const iptu = { nomeDocumento: "IPTU", referente: "Imóvel", arquivos: [] };
    expect(
      pontuarVaga(iptu, { termos: termosDoTipoDocumento("i_iptu"), alvo: "" }, "Imóvel", nomes),
    ).toBeGreaterThan(100);
  });

  it("tipo que não casa com a vaga não serve", () => {
    expect(
      pontuarVaga(
        { nomeDocumento: "Holerite", referente: "Cleitom de Oliveira" },
        identidade,
        "Cleitom de Oliveira",
        nomes,
      ),
    ).toBe(-1);
  });
});

describe("estado do documento na HomeFin", () => {
  const doc = {
    id: "3f2a1b9c-1111-2222-3333-444455556666",
    nome_arquivo: "Certidão de Casamento.pdf",
  };

  it("sobe com o prefixo do documento e o reconhece no checklist", () => {
    const nome = nomeArquivoNaHomefin(doc);
    expect(nome).toBe("3f2a1b9c-Certidao-de-Casamento.pdf");
    const itens = [
      { idDocumento: "1", arquivos: [{ idArquivo: "9", nomeArquivo: "outro.pdf" }] },
      { idDocumento: "2", arquivos: [{ idArquivo: "77", nomeArquivo: nome }] },
    ];
    expect(arquivoDoDocumento(itens, doc.id)).toEqual({ item: itens[1], idArquivos: ["77"] });
    expect(arquivoDoDocumento(itens, "ffffffff-0000")).toBeNull();
  });

  it("situação sai da integração, da análise e dos ignorados", () => {
    expect(situacaoDoItem({ situacaoIntegracao: "success" }).situacao).toBe("enviado");
    expect(situacaoDoItem({ situacaoIntegracao: "error", mensagemIntegracao: "ilegível" })).toEqual(
      {
        situacao: "erro",
        mensagem: "ilegível",
      },
    );
    expect(situacaoDoItem({ tipoSituacao: "R", comentarioAnalise: "vencido" }).mensagem).toContain(
      "vencido",
    );
    const item = { idDocumento: "5", nomeDocumento: "RG", referente: "Ana", tipoSituacao: "I" };
    const ignorado = ignoradoDoItem(
      [{ id: 5, motivo: "documento_nao_aprovado", descricaoMotivo: "Não aprovado" }],
      item,
    );
    expect(situacaoDoItem(item, ignorado)).toEqual({
      situacao: "homefin",
      mensagem: "Enviado à HomeFin. Segue ao banco depois da análise da HomeFin.",
    });
    expect(situacaoDoItem(item).situacao).toBe("homefin");
  });
});

describe("dono da vaga pelo tipoDocumento", () => {
  it("mapeia a vaga para a pasta do CRM", () => {
    expect(categoriaDaVaga({ tipoDocumento: "CO" })).toBe("comprador");
    expect(categoriaDaVaga({ tipoDocumento: "CC" })).toBe("conjuge");
    expect(categoriaDaVaga({ tipoDocumento: "VD" })).toBe("vendedor");
    expect(categoriaDaVaga({ tipoDocumento: "CV" })).toBe("vendedor_conjuge");
    expect(categoriaDaVaga({ tipoDocumento: "IM" })).toBe("imovel");
    expect(categoriaDaVaga({})).toBe("outros");
  });

  it("não mistura comprador, vendedor e imóvel", () => {
    expect(vagaAceitaCategoria({ tipoDocumento: "CO" }, "vendedor")).toBe(false);
    expect(vagaAceitaCategoria({ tipoDocumento: "VD" }, "comprador")).toBe(false);
    expect(vagaAceitaCategoria({ tipoDocumento: "IM" }, "conjuge")).toBe(false);
    expect(vagaAceitaCategoria({ tipoDocumento: "CV" }, "vendedor")).toBe(true);
    // cônjuge que compõe renda tem vagas CO com o próprio nome
    expect(vagaAceitaCategoria({ tipoDocumento: "CO" }, "conjuge")).toBe(true);
    expect(vagaAceitaCategoria({ tipoDocumento: "IM" }, "outros")).toBe(true);
    expect(vagaAceitaCategoria({}, "vendedor")).toBe(true);
  });

  // Checklist real (oportunidade 28883): IPTU e matrícula vêm como `CO`, no
  // nome do comprador, e não existe vaga `IM`.
  it("vaga de imóvel pelo nome aceita documento do imóvel, mesmo com tipo CO", () => {
    const iptu = { tipoDocumento: "CO", nomeDocumento: "IPTU" };
    const matricula = { tipoDocumento: "CO", nomeDocumento: "Matrícula (Atualizada e válida)" };
    expect(vagaAceitaCategoria(iptu, "imovel")).toBe(true);
    expect(vagaAceitaCategoria(matricula, "imovel")).toBe(true);
    // e não recebe documento de pessoa
    expect(vagaAceitaCategoria(iptu, "comprador")).toBe(false);
    expect(vagaAceitaCategoria(matricula, "vendedor")).toBe(false);
  });
});

describe("classificação: nada vai para a vaga de outro tipo", () => {
  const nomes = envolvidos.map((e) => e.nome);
  const dono = "Cleitom de Oliveira";
  const estadoCivil = {
    idDocumento: "10",
    tipoDocumento: "CO",
    nomeDocumento: "Comprovante de estado civil",
    referente: dono,
    arquivos: [],
  };

  it("comprovante de endereço não entra na vaga de estado civil", () => {
    const endereco = {
      termos: termosDoTipoDocumento("c_comp_end"),
      alvo: "Comprovante de endereço Endereco-Emerson.jpeg",
    };
    expect(pontuarVaga(estadoCivil, endereco, dono, nomes)).toBe(-1);
  });

  it("certidão de casamento continua entrando na vaga de estado civil", () => {
    const certidao = {
      termos: termosDoTipoDocumento("c_cert_ec"),
      alvo: "Certidão de casamento Certidao.pdf",
    };
    expect(pontuarVaga(estadoCivil, certidao, dono, nomes)).toBeGreaterThan(0);
  });

  it("sem vaga do tipo, o documento vai para a do mesmo dono com menos arquivos", () => {
    const itens = [
      { idDocumento: "1", tipoDocumento: "CO", arquivos: [{ idArquivo: "a" }] },
      { idDocumento: "2", tipoDocumento: "CO", arquivos: [] },
      { idDocumento: "3", tipoDocumento: "IM", arquivos: [] },
    ];
    expect(vagaDeReserva(itens, "comprador")?.idDocumento).toBe("2");
    expect(vagaDeReserva(itens, "imovel")?.idDocumento).toBe("3");
    // Documento do vendedor não tem vaga nenhuma neste checklist.
    expect(vagaDeReserva(itens, "vendedor")).toBeNull();
  });

  it("o nome que sobe leva o tipo, para a HomeFin ver a classificação", () => {
    const doc = { id: "3f2a1b9c-1111", nome_arquivo: "IMG_9001.jpg" };
    expect(nomeArquivoNaHomefin(doc, "Comprovante de endereço")).toBe(
      "3f2a1b9c-Comprovante-de-endereco-IMG_9001.jpg",
    );
    expect(nomeArquivoNaHomefin(doc)).toBe("3f2a1b9c-IMG_9001.jpg");
  });
});
