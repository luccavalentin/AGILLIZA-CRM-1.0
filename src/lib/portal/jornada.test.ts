import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  etapaAtual,
  nomeEtapa,
  primeiroNome,
  problemaNoArquivo,
  progressoJornada,
  rotuloIdProposta,
  rotuloIdSimulacao,
  saudacao,
  statusProposta,
  type EtapaJornada,
} from "./jornada";
import { ESQUEMA_ENVIO, extensaoSegura } from "./cliente-portal.functions";

const etapa = (codigo: string, status: EtapaJornada["status"], ordem: number): EtapaJornada => ({
  ordem,
  codigo,
  nome: codigo,
  descricao_cliente: null,
  status,
  concluida_em: null,
});

describe("portal do cliente: jornada", () => {
  const jornada = [
    etapa("credito_aprovado", "concluida", 5),
    etapa("contrato_emitido", "concluida", 9),
    etapa("contrato_registrado", "atual", 10),
  ];

  it("a etapa de agora é a 'atual'; sem nenhuma, a primeira não concluída", () => {
    expect(etapaAtual(jornada)?.codigo).toBe("contrato_registrado");
    expect(etapaAtual([etapa("a", "concluida", 1), etapa("b", "proxima", 2)])?.codigo).toBe("b");
    expect(etapaAtual([etapa("a", "concluida", 1)])).toBeNull();
  });

  it("o progresso conta as concluídas", () => {
    expect(progressoJornada(jornada)).toBe(67);
    expect(progressoJornada([])).toBe(0);
    expect(progressoJornada(jornada.map((e) => ({ ...e, status: "concluida" as const })))).toBe(100);
  });

  it("nomes do funil em português de gente", () => {
    expect(nomeEtapa("Contrato Emitido")).toBe("Contrato emitido");
    expect(nomeEtapa("Cadastro Básico")).toBe("Cadastro básico");
    expect(nomeEtapa("Engenharia / vistoria")).toBe("Engenharia / vistoria");
    expect(nomeEtapa("Saque do FGTS")).toBe("Saque do FGTS");
  });
});

describe("portal do cliente: proposta e ID", () => {
  it("status traduzido, com 'Contrato registrado' e sem código interno", () => {
    expect(statusProposta("registrado")).toEqual({ rotulo: "Contrato registrado", tom: "sucesso" });
    expect(statusProposta("contrato_emitido").rotulo).toBe("Contrato emitido");
    expect(statusProposta("vistoria_agendamento").rotulo).toBe("Vistoria do imóvel");
    expect(statusProposta("qualquer_coisa_nova").rotulo).toBe("Em andamento");
    expect(statusProposta(null).rotulo).toBe("Em andamento");
  });

  it("proposta mostra 'ID H.' e simulação 'ID' — nunca o nome da integração", () => {
    expect(rotuloIdProposta("987654")).toBe("ID H. 987654");
    expect(rotuloIdProposta("")).toBeNull();
    expect(rotuloIdProposta(null)).toBeNull();
    expect(rotuloIdSimulacao(5551)).toBe("ID 5551");
    const telas = ["components/cliente/portal/partes.tsx", "routes/cliente.simulacoes.tsx", "routes/cliente.visao-geral.tsx",
      "routes/cliente.acompanhar-minha-proposta.tsx", "routes/cliente.documentos.tsx"];
    for (const t of telas) {
      expect(readFileSync(join(__dirname, "..", "..", t), "utf8"), t).not.toMatch(/homefin/i);
    }
  });
});

describe("portal do cliente: envio de documento", () => {
  it("recusa arquivo vazio, grande demais ou de tipo estranho", () => {
    expect(problemaNoArquivo({ size: 0, type: "application/pdf", name: "a.pdf" })).toMatch(/vazio/);
    expect(problemaNoArquivo({ size: 11 * 1024 * 1024, type: "application/pdf", name: "a.pdf" })).toMatch(/10 MB/);
    expect(problemaNoArquivo({ size: 100, type: "application/x-msdownload", name: "virus.exe" })).toMatch(/PDF ou foto/);
    expect(problemaNoArquivo({ size: 100, type: "", name: "foto.HEIC" })).toBeNull();
    expect(problemaNoArquivo({ size: 100, type: "image/jpeg", name: "rg.jpg" })).toBeNull();
  });

  it("a extensão do arquivo não escapa da pasta do cliente", () => {
    expect(extensaoSegura("foto./../../outro-cliente/x")).toMatch(/^[a-z0-9]{1,10}$/);
    expect(extensaoSegura("rg.JPG")).toBe("jpg");
    expect(extensaoSegura("semextensao")).toBe("bin");
  });

  it("o corpo do envio não carrega o id do cliente nem o caminho", () => {
    const base = { nome_arquivo: "a.pdf", mime_type: "application/pdf", conteudo_base64: "AAAA" };
    const r = ESQUEMA_ENVIO.parse({ ...base, documentoId: "a8c00000-0000-4000-8000-0000000002a1", cliente_id: "x", path: "y" });
    expect(r).not.toHaveProperty("cliente_id");
    expect(r).not.toHaveProperty("path");
    expect(ESQUEMA_ENVIO.safeParse(base).success).toBe(false);
    expect(ESQUEMA_ENVIO.safeParse({ ...base, tipo: "Comprovante" }).success).toBe(true);
    expect(ESQUEMA_ENVIO.safeParse({ ...base, tipo: "x", categoria: "../etc" }).success).toBe(false);
  });

  it("a server function tira o cliente do cookie e monta o caminho no servidor", () => {
    const fonte = readFileSync(join(__dirname, "cliente-portal.functions.ts"), "utf8");
    expect(fonte).toContain("requireClienteSession()");
    expect(fonte).toMatch(/const path = `\$\{sess\.cid\}\/app\//);
    expect(fonte).not.toMatch(/data\.cid|data\.cliente_id/);
  });
});

describe("portal do cliente: saudação", () => {
  it("primeiro nome e saudação pela hora de Brasília", () => {
    expect(primeiroNome("ANA maria souza")).toBe("Ana");
    expect(primeiroNome("")).toBe("");
    expect(saudacao(new Date("2026-10-26T12:00:00Z"))).toBe("Bom dia"); // 9h em Brasília
    expect(saudacao(new Date("2026-10-26T18:00:00Z"))).toBe("Boa tarde"); // 15h
    expect(saudacao(new Date("2026-10-27T01:00:00Z"))).toBe("Boa noite"); // 22h
  });
});
