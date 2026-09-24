/**
 * Contrato com a HomeFin: o código contra o swagger oficial
 * (`swagger-homefin.json`, versão 1.0.1 com a tag "Documentos" de 09/2026) e
 * contra a planilha de obrigatoriedade da documentação.
 *
 * Quando a HomeFin publicar um swagger novo, substitua o JSON: o que divergir
 * quebra aqui antes de quebrar em produção.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPOS_OBRIGATORIOS_PARTICIPANTE } from "@/lib/propostas/campos-obrigatorios";
import { codigoTipoImovel, TIPOS_IMOVEL_HOMEFIN } from "../dominios-homefin";

const swagger = JSON.parse(readFileSync(join(__dirname, "swagger-homefin.json"), "utf-8")) as any;
const schemas = swagger.components.schemas;

const RAIZ = join(__dirname, "..", "..", "..");

function arquivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

/** Chamadas à integração no código: endpoint (com `${...}` → `{}`) e método. */
function chamadasNoCodigo(): { arquivo: string; endpoint: string; metodo: string }[] {
  const out: { arquivo: string; endpoint: string; metodo: string }[] = [];
  const re =
    /chamarIntegracao(?:<[^>]*>)?\(\s*(?:\n\s*)?(?:idAlvo\s*\?\s*)?([`"'])([^`"']+)\1(?:\s*:\s*([`"'])([^`"']+)\3)?\s*,\s*(?:\n\s*)?(?:idAlvo\s*\?\s*"PUT"\s*:\s*"POST"|"(GET|POST|PUT|DELETE)")/g;
  for (const arquivo of arquivosTs(RAIZ)) {
    const texto = readFileSync(arquivo, "utf-8");
    for (const m of texto.matchAll(re)) {
      const metodos = m[5] ? [m[5]] : ["PUT", "POST"];
      const endpoints = m[4] ? [m[2], m[4]] : [m[2]];
      endpoints.forEach((endpoint, i) =>
        out.push({
          arquivo: relative(RAIZ, arquivo),
          endpoint,
          metodo: m[5] ?? metodos[i],
        }),
      );
    }
    for (const m of texto.matchAll(/enviarArquivoIntegracao(?:<[^>]*>)?\(\s*([`"'])([^`"']+)\1/g)) {
      out.push({ arquivo: relative(RAIZ, arquivo), endpoint: m[2], metodo: "POST" });
    }
  }
  return out;
}

/** O endpoint do código casa com algum caminho do swagger? */
function caminhoDoSwagger(endpoint: string): string | null {
  const alvo = endpoint.replace(/\$\{[^}]+\}/g, "{}").replace(/\?.*$/, "");
  for (const caminho of Object.keys(swagger.paths)) {
    if (caminho.replace(/\{[^}]+\}/g, "{}") === alvo) return caminho;
  }
  return null;
}

describe("contrato HomeFin — endpoints", () => {
  const chamadas = chamadasNoCodigo();

  it("encontra as chamadas do código", () => {
    // Guarda contra a varredura parar de achar chamadas e o teste passar vazio.
    expect(chamadas.length).toBeGreaterThan(25);
  });

  it("toda chamada usa um caminho e um método que existem no swagger", () => {
    const invalidas = chamadas.filter((c) => {
      const caminho = caminhoDoSwagger(c.endpoint);
      return !caminho || !swagger.paths[caminho][c.metodo.toLowerCase()];
    });
    expect(invalidas).toEqual([]);
  });

  it("cobre o fluxo do fluxograma e os documentos", () => {
    const usados = new Set(
      chamadas.map((c) => `${c.metodo} ${caminhoDoSwagger(c.endpoint) ?? c.endpoint}`),
    );
    for (const passo of [
      "GET /usuarios-parceiros",
      "POST /oportunidade",
      "GET /oportunidade/{id}",
      "PUT /oportunidade/{id}",
      "POST /oportunidade/{id}/simulacao",
      "PUT /oportunidade/{id}/simulacao/{idSimulacao}",
      "POST /oportunidade/{id}/simulacao/{idSimulacao}/integracao",
      "POST /oportunidade/{id}/participante",
      "PUT /oportunidade/{idOportunidade}/participante/{id}",
      "POST /oportunidade/{id}/incluir-proposta-integracao",
      "GET /oportunidade/{id}/documentos",
      "POST /documento/{id}/upload",
      "DELETE /documento/arquivo/{id}",
      "POST /oportunidade/{id}/incluir-documentos-integracao",
      "POST /oportunidade/{id}/follow-up",
    ]) {
      expect(usados, passo).toContain(passo);
    }
  });
});

describe("contrato HomeFin — campos", () => {
  it("participante: os 25 obrigatórios da documentação existem no schema", () => {
    const props = Object.keys(schemas.CreateParticipantRequest.properties);
    const semApi = CAMPOS_OBRIGATORIOS_PARTICIPANTE.filter((c) => !props.includes(c.api));
    expect(semApi.map((c) => c.api)).toEqual([]);
    // Planilha de obrigatoriedade (documentação, "Campos obrigatórios em destaque").
    const daDocumentacao = [
      "tipoSituacao",
      "nomeParticipante",
      "tipoQualificacao",
      "tipoPessoa",
      "cpfCnpj",
      "dataNascimento",
      "nomeMae",
      "tipoSexo",
      "tipoEstadoCivil",
      "tipoDocumentoIdentidade",
      "numeroDocumento",
      "orgaoExpedidor",
      "ufExpedicao",
      "nomeProfissao",
      "renda",
      "email",
      "celular",
      "cep",
      "logradouro",
      "numeroLogradouro",
      "bairro",
      "municipio",
      "uf",
      "utilizaFgts",
      "fgAutorizacaoDados",
    ];
    const noCodigo = new Set(CAMPOS_OBRIGATORIOS_PARTICIPANTE.map((c) => c.api));
    expect(daDocumentacao.filter((c) => !noCodigo.has(c))).toEqual([]);
  });

  it("upload: multipart com `arquivo` e `documentoAprovado`", () => {
    expect(Object.keys(schemas.UploadRequest.properties).sort()).toEqual(
      ["arquivo", "documentoAprovado"].sort(),
    );
    const homefin = readFileSync(join(RAIZ, "lib/simulacao/homefin.server.ts"), "utf-8");
    expect(homefin).toMatch(/form\.append\(\s*"arquivo"/);
    expect(homefin).toMatch(/form\.append\("documentoAprovado"/);
    expect(schemas.UploadOk.properties).toHaveProperty("idArquivo");
  });

  // Decisão de 23/09/2026: o documento sobe para a análise da HomeFin. Só
  // documento aprovado entra no lote do Bradesco, então até a aprovação dela o
  // `incluir-documentos-integracao` devolve os arquivos em `ignorados`.
  it("upload sobe o documento para análise da HomeFin", () => {
    const envio = readFileSync(join(RAIZ, "lib/propostas/enviar/documentos.server.ts"), "utf-8");
    const inicio = envio.indexOf("enviarArquivoIntegracao<any>(");
    const chamada = envio.slice(inicio, envio.indexOf(");", inicio));
    expect(chamada).toContain("false,");
    expect(chamada).not.toContain("true,");
  });

  it("checklist de documentos: todo campo lido pelo sistema existe na resposta", () => {
    const item = schemas.OpportunityDocumentsResponse.items.properties;
    for (const campo of [
      "idDocumento",
      "nomeDocumento",
      "referente",
      "tipoSituacao",
      "integravelBradesco",
      "arquivos",
      "situacaoIntegracao",
      "mensagemIntegracao",
      "comentarioAnalise",
    ]) {
      expect(item, campo).toHaveProperty(campo);
    }
    expect(item.arquivos.items.properties).toHaveProperty("idArquivo");
    expect(item.arquivos.items.properties).toHaveProperty("nomeArquivo");
  });

  it("envio de documentos: pedido com idSimulacao e resposta com sucesso/erro/ignorados", () => {
    expect(schemas.SendDocumentsRequest.properties).toHaveProperty("idSimulacao");
    for (const campo of ["sucesso", "erro", "ignorados", "etapasChecklistIndisponiveis"]) {
      expect(schemas.SendDocumentsResponse.properties, campo).toHaveProperty(campo);
    }
    const ignorado = schemas.SendDocumentsResponse.properties.ignorados.items.properties;
    expect(ignorado).toHaveProperty("descricaoMotivo");
  });

  it("simulação: obrigatórios do CreateSimulationRequest estão no payload enviado", () => {
    const fonte = readFileSync(join(RAIZ, "lib/simulacao/enviar.server.ts"), "utf-8");
    const trecho = fonte.slice(fonte.indexOf("const payloadSim = {"));
    for (const campo of [
      "valorImovel",
      "valorFinanciamento",
      "prazo",
      "codigoSistemaAmortizacaoBanco",
      "banco",
      "fgAutorizacaoDados",
    ]) {
      expect(schemas.CreateSimulationRequest.properties, campo).toHaveProperty(campo);
      expect(trecho.slice(0, 2500), campo).toContain(campo);
    }
  });

  it("oportunidade: obrigatórios do CreateOpportunityRequest estão no payload enviado", () => {
    const fonte = readFileSync(join(RAIZ, "lib/simulacao/enviar.server.ts"), "utf-8");
    const trecho = fonte.slice(fonte.indexOf("const payloadOp: any = {")).slice(0, 4000);
    for (const campo of [
      "operacao",
      "regional",
      "parceiro",
      "usuarioParceiro",
      "tipoImovel",
      "usoImovel",
      "uf",
      "valorImovel",
      "valorFinanciamento",
      "prazo",
      "utilizaFgtsSimulacao",
      "cpfCnpj",
      "nome",
      "rendaTotal",
      "codigoSistemaAmortizacaoBanco",
      "dataNascimento",
      "email",
      "celular",
      "fgCompoeRenda",
      "situacaoImovel",
      "fgFinanciarDespesas",
      "tipoEstadoCivil",
    ]) {
      expect(schemas.CreateOpportunityRequest.properties, campo).toHaveProperty(campo);
      // `campo: valor` ou a forma abreviada `campo,`.
      expect(trecho, campo).toMatch(new RegExp(`\\b${campo}\\s*[:,]`));
    }
  });

  it("participante de terceiros na simulação leva os obrigatórios", () => {
    const fonte = readFileSync(join(RAIZ, "lib/simulacao/enviar.server.ts"), "utf-8");
    const trecho = fonte.slice(fonte.indexOf("const payloadPart = {")).slice(0, 2500);
    const daDocumentacao = CAMPOS_OBRIGATORIOS_PARTICIPANTE.map((c) => c.api);
    expect(daDocumentacao.filter((c) => !trecho.includes(`${c}:`))).toEqual([]);
  });

  it("tipo do imóvel segue os códigos do contrato", () => {
    const exemplo = String(
      schemas.CreateOpportunityRequest.properties.tipoImovel.properties.id.example,
    );
    const doSwagger = exemplo.split(" ")[0].split("/");
    expect([...TIPOS_IMOVEL_HOMEFIN].sort()).toEqual(doSwagger.sort());
    for (const c of doSwagger) expect(codigoTipoImovel(c.toLowerCase())).toBe(c);
    expect(codigoTipoImovel("")).toBe("AP");
  });
});
