/**
 * Documentos de clientes (C21/C22, 26/10/2026): pastas padrão, contagem, busca sem
 * acento e as validações que o servidor usa para recusar mover/anexar torto.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_ARQUIVOS_LOTE,
  PASTAS,
  PASTAS_DESTINO,
  checarAnexo,
  checarMovimento,
  contarPorPasta,
  contemTermo,
  ehPastaDestino,
  normalizar,
  padraoIlikeSemAcento,
  pastaDoDocumento,
  pastaPelaCategoria,
  pastaPeloTipo,
  pastasVisiveis,
  validarLote,
} from "./pastas";
import { TIPOS_DOCUMENTO_POR_CATEGORIA } from "@/lib/crm/documento-tipos";

const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";

describe("pasta pela categoria", () => {
  it("mapeia as categorias gravadas", () => {
    expect(pastaPelaCategoria("comprador")).toBe("comprador");
    expect(pastaPelaCategoria("conjuge")).toBe("participantes");
    expect(pastaPelaCategoria("vendedor")).toBe("vendedor");
    expect(pastaPelaCategoria("vendedor_conjuge")).toBe("vendedor");
    expect(pastaPelaCategoria("imovel")).toBe("imovel");
  });
  it("categoria desconhecida, nula, vazia ou torta vai para Outros", () => {
    for (const c of [null, undefined, "", "  ", "xpto", "'; drop table x;--", "outros"]) {
      expect(pastaPelaCategoria(c as string | null)).toBe("outros");
    }
  });
  it("aceita maiúscula e acento de dado legado", () => {
    expect(pastaPelaCategoria("IMÓVEL")).toBe("imovel");
    expect(pastaPelaCategoria(" Cônjuge ")).toBe("participantes");
  });
});

describe("pasta pelo tipo", () => {
  it("renda, banco e proposta e contratos saem do tipo", () => {
    expect(pastaPeloTipo("IRPF completo com recibo")).toBe("renda");
    expect(pastaPeloTipo("CTPS digital completa")).toBe("renda");
    expect(pastaPeloTipo("Extrato atualizado do FGTS")).toBe("renda");
    expect(pastaPeloTipo("Holerite de setembro")).toBe("renda");
    expect(pastaPeloTipo("Proposta de Financiamento Imobiliário assinada")).toBe("banco_proposta");
    expect(pastaPeloTipo("Declaração Pessoal de Saúde (DPS) do cônjuge")).toBe("banco_proposta");
    expect(pastaPeloTipo("Formulário de Autorização")).toBe("banco_proposta");
    expect(pastaPeloTipo("Contrato de compra e venda")).toBe("contratos");
    expect(pastaPeloTipo("Escritura pública")).toBe("contratos");
  });
  it("armadilhas: contrato social é do vendedor; endereço do FGTS é endereço", () => {
    expect(pastaPeloTipo("Contrato social / última alteração")).toBeNull();
    expect(pastaPeloTipo("Comprovante de endereço no nome do utilizador do FGTS")).toBeNull();
  });
  it("tipo vazio ou genérico não decide", () => {
    expect(pastaPeloTipo(null)).toBeNull();
    expect(pastaPeloTipo("")).toBeNull();
    expect(pastaPeloTipo("Documento de identidade (RG, CPF ou CNH)")).toBeNull();
  });
});

describe("pasta do documento", () => {
  it("escolha manual vence o tipo e a categoria", () => {
    expect(
      pastaDoDocumento({ categoria: "comprador", tipo_documento: "IRPF", pasta_padrao: "contratos" }),
    ).toBe("contratos");
  });
  it("pasta manual inválida é ignorada (cai na regra)", () => {
    expect(
      pastaDoDocumento({ categoria: "imovel", tipo_documento: "Matrícula", pasta_padrao: "lixo" }),
    ).toBe("imovel");
    expect(
      pastaDoDocumento({ categoria: "imovel", tipo_documento: "x", pasta_padrao: "outros" }),
    ).toBe("imovel");
  });
  it("todo tipo do checklist cai numa pasta de destino (nada vira Outros)", () => {
    for (const [categoria, tipos] of Object.entries(TIPOS_DOCUMENTO_POR_CATEGORIA)) {
      if (categoria === "outros") continue;
      for (const tipo of tipos) {
        expect(ehPastaDestino(pastaDoDocumento({ categoria, tipo_documento: tipo })), tipo).toBe(
          true,
        );
      }
    }
  });
  it("documento do vendedor com 'Contrato social' fica no Vendedor", () => {
    expect(
      pastaDoDocumento({ categoria: "vendedor", tipo_documento: "Contrato social / última alteração" }),
    ).toBe("vendedor");
  });
});

describe("contagem e pastas visíveis", () => {
  const docs = [
    { categoria: "comprador", tipo_documento: "CPF" },
    { categoria: "comprador", tipo_documento: "IRPF completo com recibo" },
    { categoria: "conjuge", tipo_documento: "CPF do cônjuge" },
    { categoria: "outros", tipo_documento: "foto" },
    { categoria: "imovel", tipo_documento: "Matrícula", pasta_padrao: "contratos" },
  ];
  it("conta por pasta e soma o total", () => {
    const c = contarPorPasta(docs);
    expect(c).toMatchObject({
      comprador: 1,
      renda: 1,
      participantes: 1,
      outros: 1,
      contratos: 1,
      imovel: 0,
    });
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(docs.length);
  });
  it("lista vazia zera tudo", () => {
    expect(Object.values(contarPorPasta([])).every((n) => n === 0)).toBe(true);
  });
  it("as sete pastas sempre aparecem; Outros só com arquivo", () => {
    expect(pastasVisiveis(contarPorPasta([]))).toEqual([...PASTAS_DESTINO]);
    expect(pastasVisiveis(contarPorPasta(docs))).toContain("outros");
  });
  it("as sete pastas pedidas pelo dono existem com rótulo", () => {
    expect(PASTAS_DESTINO.map((p) => PASTAS[p].rotulo)).toEqual([
      "Comprador",
      "Cônjuge / Participantes",
      "Vendedor",
      "Imóvel",
      "Renda",
      "Banco e proposta",
      "Contratos",
    ]);
  });
});

describe("busca sem acento", () => {
  it("normaliza acento, maiúscula e espaço duplo", () => {
    expect(normalizar("  JOÃO   d'Ávila ")).toBe("joao d'avila");
    expect(contemTermo("Certidão de Casamento.pdf", "certidao  DE CASAMENTO")).toBe(true);
    expect(contemTermo("Matrícula.pdf", "matricula")).toBe(true);
    expect(contemTermo("Matrícula.pdf", "iptu")).toBe(false);
  });
  it("termo vazio casa tudo; texto nulo não quebra", () => {
    expect(contemTermo("x", "")).toBe(true);
    expect(contemTermo(null, "a")).toBe(false);
  });
  it("padrão ilike troca letras acentuáveis por curinga e tira os do PostgREST", () => {
    expect(padraoIlikeSemAcento("João")).toBe("%j___%");
    expect(padraoIlikeSemAcento("certidão")).toBe("%__rt_d__%");
    // Vírgula, parênteses, % e * mudariam o filtro `.or()` do PostgREST.
    const torto = padraoIlikeSemAcento("a,b).or(id.eq.1)%*")!;
    expect(torto).not.toMatch(/[,()*]/);
    expect(torto.slice(1, -1)).not.toContain("%");
    expect(padraoIlikeSemAcento("  ,%() ")).toBeNull();
  });
});

describe("envio em lote", () => {
  const ok = (name = "a.pdf", size = 1000, type = "application/pdf") => ({ name, size, type });
  it("aceita PDF/JPG/PNG e recusa tipo proibido, grande demais e vazio", () => {
    const { aceitos, recusados } = validarLote([
      ok(),
      ok("b.jpg", 2000, "image/jpeg"),
      ok("virus.exe", 100, "application/x-msdownload"),
      ok("falso.pdf", 100, "application/x-msdownload"),
      ok("grande.pdf", 10 * 1024 * 1024 + 1),
      ok("vazio.pdf", 0),
    ]);
    expect(aceitos.map((a) => a.name)).toEqual(["a.pdf", "b.jpg"]);
    expect(recusados.map((r) => r.arquivo.name)).toEqual([
      "virus.exe",
      "falso.pdf",
      "grande.pdf",
      "vazio.pdf",
    ]);
  });
  it(`passa de ${MAX_ARQUIVOS_LOTE} arquivos: o excedente é recusado com motivo`, () => {
    const lote = Array.from({ length: MAX_ARQUIVOS_LOTE + 3 }, (_, i) => ok(`${i}.pdf`));
    const { aceitos, recusados } = validarLote(lote);
    expect(aceitos).toHaveLength(MAX_ARQUIVOS_LOTE);
    expect(recusados).toHaveLength(3);
    expect(recusados[0].motivo).toMatch(/limite/);
  });
});

describe("mover (validação do servidor)", () => {
  it("recusa pasta inválida, inclusive Outros e valor torto", () => {
    for (const p of ["outros", "lixo", "", null, 1, "COMPRADOR"]) {
      expect(checarMovimento({ cliente_id: C1 }, C1, p)).toBe("Pasta inválida.");
    }
  });
  it("recusa documento que a RLS não devolveu", () => {
    expect(checarMovimento(null, C1, "renda")).toBe("Documento não encontrado.");
  });
  it("recusa documento de outro cliente", () => {
    expect(checarMovimento({ cliente_id: C2 }, C1, "renda")).toBe(
      "Este documento não é deste cliente.",
    );
  });
  it("aceita o caso certo", () => {
    expect(checarMovimento({ cliente_id: C1 }, C1, "contratos")).toBeNull();
  });
});

describe("anexar (validação do servidor)", () => {
  const base = {
    cliente_id: C1,
    pasta: "renda",
    storage_path: `${C1}/abc-holerite.pdf`,
    nome_arquivo: "holerite.pdf",
    mime_type: "application/pdf",
    tamanho_bytes: 5000,
  };
  it("aceita o caso certo", () => {
    expect(checarAnexo(base)).toBeNull();
  });
  it("recusa arquivo guardado na pasta de OUTRO cliente no storage", () => {
    expect(checarAnexo({ ...base, storage_path: `${C2}/abc-holerite.pdf` })).toBe(
      "Caminho do arquivo inválido.",
    );
  });
  it("recusa caminho com subida de pasta, subpasta ou barra invertida", () => {
    for (const p of [
      `${C1}/../${C2}/x.pdf`,
      `${C1}/sub/x.pdf`,
      `${C1}\\x.pdf`,
      `${C1}/`,
      `x${C1}/a.pdf`,
    ]) {
      expect(checarAnexo({ ...base, storage_path: p }), p).toBe("Caminho do arquivo inválido.");
    }
  });
  it("recusa pasta inválida, tipo proibido, grande demais e vazio", () => {
    expect(checarAnexo({ ...base, pasta: "outros" })).toBe("Pasta inválida.");
    expect(checarAnexo({ ...base, nome_arquivo: "x.exe" })).toMatch(/não é PDF/);
    expect(checarAnexo({ ...base, mime_type: "text/html" })).toMatch(/não é PDF/);
    expect(checarAnexo({ ...base, tamanho_bytes: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
    expect(checarAnexo({ ...base, tamanho_bytes: 0 })).toMatch(/vazio/);
    expect(checarAnexo({ ...base, tamanho_bytes: null })).toMatch(/vazio/);
  });
});

describe("guardas das server functions", () => {
  const fonte = readFileSync(join(__dirname, "..", "documentos-clientes.functions.ts"), "utf8");
  const blocos = fonte.split(/export const /).slice(1);
  const fn = (nome: string) => blocos.find((b) => b.startsWith(nome)) ?? "";

  it("listar exige crm.clientes:view; mover e anexar exigem crm.clientes:edit", () => {
    expect(fn("listarClientesComDocumentos")).toContain('exigirPermissao(["crm.clientes", "view"])');
    expect(fn("listarDocumentosDoClientePorPasta")).toContain(
      'exigirPermissao(["crm.clientes", "view"])',
    );
    expect(fn("moverDocumentoDePasta")).toContain('exigirPermissao(["crm.clientes", "edit"])');
    expect(fn("anexarDocumentoNaPasta")).toContain('exigirPermissao(["crm.clientes", "edit"])');
  });
  it("mover confere o cliente do documento e restringe o update ao cliente", () => {
    const m = fn("moverDocumentoDePasta");
    expect(m).toContain("checarMovimento(");
    expect(m).toMatch(/\.eq\("cliente_id", data\.cliente_id\)/);
  });
  it("anexar valida caminho/arquivo antes de gravar e confere o cliente pela RLS", () => {
    const a = fn("anexarDocumentoNaPasta");
    expect(a.indexOf("checarAnexo(")).toBeGreaterThan(-1);
    expect(a.indexOf("checarAnexo(")).toBeLessThan(a.indexOf(".insert("));
    expect(a).toContain('.from("clientes")');
  });
});
