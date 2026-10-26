import { describe, expect, it } from "vitest";
import {
  buscarPrevia,
  conferirUrl,
  enderecoPublico,
  extrairPrevia,
  RecusaLink,
  type Requisitar,
  type Resolvedor,
} from "./previa-link.server";

const publico: Resolvedor = async () => [{ address: "200.147.67.142", family: 4 }];
const HTML = `<!doctype html><html><head>
<title>Título do title</title>
<meta property="og:title" content="Selic cai e o crédito imobiliário reage &amp; acelera">
<meta property="og:description" content="Bancos revisam taxas.">
<meta property="og:image" content="/img/capa.jpg">
<meta property="og:site_name" content="Portal Exemplo">
</head><body>texto</body></html>`;

describe("pré-visualização de link (SSRF)", () => {
  it("recusa esquema, porta, credencial, IP e nome local", () => {
    for (const u of [
      "ftp://exemplo.com.br/a",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://exemplo.com.br:8443/a",
      "https://user:senha@exemplo.com.br/",
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost/admin",
      "http://servidor.internal/",
      "http://intranet/",
    ])
      expect(() => conferirUrl(u), u).toThrow(RecusaLink);
    expect(conferirUrl("https://g1.globo.com/economia").hostname).toBe("g1.globo.com");
  });

  it("endereços internos nunca são públicos", () => {
    for (const ip of [
      "10.0.0.1",
      "192.168.0.10",
      "172.20.1.1",
      "100.64.0.1",
      "::ffff:127.0.0.1",
      "fd00::1",
      "fe80::1",
      "0.0.0.0",
    ])
      expect(enderecoPublico(ip), ip).toBe(false);
    expect(enderecoPublico("8.8.8.8")).toBe(true);
  });

  it("domínio que resolve para rede interna é recusado (DNS rebinding)", async () => {
    const interno: Resolvedor = async () => [
      { address: "200.147.67.142", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ];
    await expect(
      buscarPrevia("https://parece-publico.com.br/x", {
        resolver: interno,
        requisitar: async () => ({ status: 200, location: null, tipo: "text/html", corpo: HTML }),
      }),
    ).rejects.toThrow(/rede interna/);
  });

  it("redirecionamento para dentro é recusado e há teto de saltos", async () => {
    const paraDentro: Requisitar = async () => ({
      status: 302,
      location: "http://127.0.0.1/admin",
      tipo: "",
      corpo: "",
    });
    await expect(
      buscarPrevia("https://exemplo.com.br/a", { resolver: publico, requisitar: paraDentro }),
    ).rejects.toThrow(RecusaLink);
    const emLaco: Requisitar = async (u) => ({
      status: 301,
      location: `${u.origin}/de-novo`,
      tipo: "",
      corpo: "",
    });
    await expect(
      buscarPrevia("https://exemplo.com.br/a", { resolver: publico, requisitar: emLaco }),
    ).rejects.toThrow(/Redirecionamentos/);
  });

  it("lê título, descrição, imagem absoluta https e veículo; recusa arquivo", async () => {
    const ok: Requisitar = async (u, ip) => {
      expect(ip.address).toBe("200.147.67.142"); // conecta no IP conferido
      return { status: 200, location: null, tipo: "text/html", corpo: HTML };
    };
    const p = await buscarPrevia("https://portal.exemplo.com.br/materia?utm=1", {
      resolver: publico,
      requisitar: ok,
    });
    expect(p).toEqual({
      url: "https://portal.exemplo.com.br/materia?utm=1",
      titulo: "Selic cai e o crédito imobiliário reage & acelera",
      descricao: "Bancos revisam taxas.",
      imagem_url: "https://portal.exemplo.com.br/img/capa.jpg",
      veiculo: "Portal Exemplo",
    });
    await expect(
      buscarPrevia("https://exemplo.com.br/a.pdf", {
        resolver: publico,
        requisitar: async () => ({
          status: 200,
          location: null,
          tipo: "application/pdf",
          corpo: "%PDF",
        }),
      }),
    ).rejects.toThrow(/arquivo/);
  });

  it("imagem http é descartada e o título cai para <title>", () => {
    const p = extrairPrevia(
      '<title>Só o title</title><meta name="og:image" content="http://x.com/a.jpg">',
      "http://site.com.br/",
    );
    expect(p.titulo).toBe("Só o title");
    expect(p.imagem_url).toBeNull();
    expect(p.veiculo).toBe("site.com.br");
  });
});
