/**
 * Automações (modelo do Postei): contas do calendário, datas comemorativas, horários
 * recomendados, validação das opções por rede e o catálogo igual ao do Agilliza Tech.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REDES, validarDestino, validarOpcoes } from "./catalogo";
import {
  diasDaSemana,
  gradeDoMes,
  lerDia,
  moverParaDia,
  periodoDaVisao,
  podeArrastar,
  porDia,
} from "./calendario";
import { chaveDoDia, datasDoAno, datasDoDia, pascoa } from "./datas-br";
import { horariosRecomendados } from "./horarios";
import { CATALOGO, campoExigido } from "../plataforma/provedores-catalogo";

describe("calendário", () => {
  it("grade do mês começa no domingo e corta a 6ª semana quando ela é toda do mês seguinte", () => {
    const out = gradeDoMes(new Date(2026, 9, 15)); // outubro/2026 começa numa quinta
    expect(out[0]!.getDay()).toBe(0);
    expect(chaveDoDia(out[0]!)).toBe("2026-09-27");
    expect(out.length).toBe(35);
    const ago = gradeDoMes(new Date(2026, 7, 10)); // agosto/2026: sábado dia 1, precisa de 6 semanas
    expect(ago.length).toBe(42);
  });
  it("semana de domingo a sábado", () => {
    const s = diasDaSemana(new Date(2026, 9, 28));
    expect(s.map(chaveDoDia)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
  });
  it("período buscado cobre a grade inteira", () => {
    const { de, ate } = periodoDaVisao(new Date(2026, 9, 15), "mes");
    expect(de <= new Date(2026, 8, 27)).toBe(true);
    expect(ate >= new Date(2026, 9, 31, 23, 59)).toBe(true);
  });
  it("agrupa por dia, em ordem de horário, e ignora sem data", () => {
    const m = porDia([
      { agendado_para: new Date(2026, 9, 26, 18).toISOString() },
      { agendado_para: new Date(2026, 9, 26, 9).toISOString() },
      { agendado_para: null },
    ]);
    expect([...m.keys()]).toEqual(["2026-10-26"]);
    expect(new Date(m.get("2026-10-26")![0]!.agendado_para!).getHours()).toBe(9);
  });
  it("arrastar mantém o horário e troca o dia", () => {
    const n = moverParaDia(new Date(2026, 9, 26, 18, 30).toISOString(), new Date(2026, 9, 29));
    expect([n.getDate(), n.getHours(), n.getMinutes()]).toEqual([29, 18, 30]);
  });
  it("só arrasta o que ainda não começou a sair", () => {
    expect(podeArrastar({ status: "agendado", destinos: [{ status: "pendente" }] })).toBe(true);
    expect(podeArrastar({ status: "agendado", destinos: [{ status: "publicado" }] })).toBe(false);
    expect(podeArrastar({ status: "publicado" })).toBe(false);
    expect(podeArrastar({ status: "rascunho" })).toBe(true);
  });
  it("lê o dia da URL e recusa lixo", () => {
    expect(chaveDoDia(lerDia("2026-12-25")!)).toBe("2026-12-25");
    expect(lerDia("25/12/2026")).toBeNull();
    expect(lerDia(undefined)).toBeNull();
  });
});

describe("datas comemorativas", () => {
  it("Páscoa e as móveis", () => {
    expect(chaveDoDia(pascoa(2026))).toBe("2026-04-05");
    expect(datasDoDia(new Date(2026, 1, 17)).map((d) => d.nome)).toContain("Carnaval");
    expect(datasDoDia(new Date(2026, 4, 10)).map((d) => d.nome)).toContain("Dia das Mães");
    expect(datasDoDia(new Date(2026, 10, 27)).map((d) => d.nome)).toContain("Black Friday");
  });
  it("Dia do Corretor de Imóveis (27/08) e Natal", () => {
    expect(datasDoDia(new Date(2026, 7, 27))[0]).toMatchObject({
      nome: "Dia do Corretor de Imóveis",
      tipo: "imobiliario",
    });
    expect(datasDoAno(2026).get("2026-12-25")?.[0]?.nome).toBe("Natal");
  });
});

describe("horários recomendados", () => {
  it("só horários futuros (20 min de folga), ordenados, no máximo 4", () => {
    const agora = new Date(2026, 9, 26, 11, 50); // segunda
    const h = horariosRecomendados(["instagram"], agora);
    expect(h.length).toBe(4);
    expect(h[0]!.data.getTime()).toBeGreaterThan(agora.getTime() + 20 * 60_000);
    for (let i = 1; i < h.length; i++) expect(h[i]!.data >= h[i - 1]!.data).toBe(true);
    expect(h[0]!.rotulo).toBe("Hoje, 18h");
  });
  it("prefere o horário bom para mais redes", () => {
    const h = horariosRecomendados(["instagram", "facebook"], new Date(2026, 9, 26, 6, 0), 1);
    expect(h).toHaveLength(1);
  });
});

describe("catálogo das redes (cópia do Agilliza Tech)", () => {
  it("formatos de cada rede iguais aos do Corretor (commit 3c01c03)", () => {
    const esperado: Record<string, string[]> = {
      instagram: ["feed", "carrossel", "reel", "story"],
      facebook: ["feed", "video", "reel", "story"],
      linkedin: ["feed", "video"],
      tiktok: ["video", "foto"],
      youtube: ["video", "short"],
      google_business: ["atualizacao", "evento", "oferta"],
      teste: ["feed", "video"],
    };
    expect(
      Object.fromEntries(Object.entries(REDES).map(([k, r]) => [k, r.formatos.map((f) => f.id)])),
    ).toEqual(esperado);
  });
  it("igual ao arquivo do Corretor quando a worktree irmã está ao lado", () => {
    const irmao = join(
      __dirname,
      "../../../../CORRETOR-automacoes-postei/packages/integrations/src/social/catalogo.ts",
    );
    let fonte: string;
    try {
      fonte = readFileSync(irmao, "utf8");
    } catch {
      return; // fora da máquina de desenvolvimento: vale o teste acima
    }
    const aqui = readFileSync(join(__dirname, "catalogo.ts"), "utf8").replace(/\r/g, "");
    expect(aqui.split("\n").slice(3).join("\n")).toBe(fonte.replace(/\r/g, ""));
  });
  it("TikTok: privacidade obrigatória e sem padrão; conteúdo de marca não pode ser privado", () => {
    expect(validarOpcoes("tiktok", "video", {})[0]).toContain("quem pode ver");
    expect(validarOpcoes("tiktok", "video", { privacidade: "PUBLIC_TO_EVERYONE" })).toEqual([]);
    expect(
      validarOpcoes("tiktok", "video", {
        privacidade: "SELF_ONLY",
        divulgacaoComercial: true,
        conteudoDeMarca: true,
      }).join(),
    ).toContain("só por você");
    expect(
      validarOpcoes("tiktok", "video", {
        privacidade: "PUBLIC_TO_EVERYONE",
        divulgacaoComercial: true,
      }).join(),
    ).toContain("sua marca");
  });
  it("Meu Negócio: evento e oferta exigem início e fim, nessa ordem", () => {
    expect(validarOpcoes("google_business", "evento", {}).join()).toContain("início e o fim");
    expect(
      validarOpcoes("google_business", "oferta", {
        inicio: "2026-11-02T10:00",
        fim: "2026-11-01T10:00",
      }).join(),
    ).toContain("depois do início");
    expect(
      validarOpcoes("google_business", "evento", {
        inicio: "2026-11-01T10:00",
        fim: "2026-11-02T10:00",
        titulo: "Feirão",
      }),
    ).toEqual([]);
    expect(
      validarOpcoes("google_business", "atualizacao", { urlBotao: "javascript:alert(1)" }).join(),
    ).toContain("https://");
  });
  it("vídeo longo demais para o Story do Facebook", () => {
    expect(
      validarDestino(
        "facebook",
        "story",
        "",
        [{ mime: "video/mp4", duracaoMs: 61_000 }],
        {},
      ).join(),
    ).toContain("60 segundos");
    expect(validarDestino("facebook", "story", "", [{ mime: "image/jpeg" }], {})).toEqual([]);
  });
});

describe("chaves dos apps das redes (Provedores)", () => {
  it("cada app tem os campos com os nomes das variáveis que o Agilliza Tech lê", () => {
    const chaves = (p: keyof typeof CATALOGO) => CATALOGO[p].campos.map((c) => c.chave);
    expect(chaves("meta")).toEqual([
      "META_APP_ID",
      "META_APP_SECRET",
      "META_LOGIN_CONFIG_ID",
      "META_GRAPH_VERSION",
    ]);
    expect(chaves("linkedin")).toEqual([
      "LINKEDIN_CLIENT_ID",
      "LINKEDIN_CLIENT_SECRET",
      "LINKEDIN_API_VERSION",
      "LINKEDIN_COMMUNITY_MANAGEMENT",
    ]);
    expect(chaves("tiktok")).toEqual([
      "TIKTOK_CLIENT_KEY",
      "TIKTOK_CLIENT_SECRET",
      "TIKTOK_PULL_FROM_URL",
      "TIKTOK_ESCOPO_ESTATISTICAS",
    ]);
    expect(chaves("google")).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
  });
  it("só o ID e o segredo são obrigatórios; versão e opções têm formato conferido", () => {
    const exigidos = (p: keyof typeof CATALOGO) =>
      CATALOGO[p].campos.filter(campoExigido).map((c) => c.chave);
    expect(exigidos("meta")).toEqual(["META_APP_ID", "META_APP_SECRET"]);
    expect(exigidos("tiktok")).toEqual(["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]);
    const versao = CATALOGO.meta.campos.find((c) => c.chave === "META_GRAPH_VERSION")!.formato!
      .regex;
    expect(versao.test("v26.0")).toBe(true);
    expect(versao.test("26")).toBe(false);
    const li = CATALOGO.linkedin.campos.find((c) => c.chave === "LINKEDIN_API_VERSION")!.formato!
      .regex;
    expect(li.test("202610")).toBe(true);
    expect(li.test("2026-10")).toBe(false);
  });
});

describe("vídeo enviado (tipo e duração lidos do arquivo)", () => {
  // MP4 mínimo: ftyp + moov/mvhd (escala 1000, duração 15 s).
  function mp4(duracaoMs: number) {
    const ftyp = Buffer.alloc(16);
    ftyp.writeUInt32BE(16, 0);
    ftyp.write("ftypisom", 4, "latin1");
    const mvhd = Buffer.alloc(8 + 100);
    mvhd.writeUInt32BE(mvhd.length, 0);
    mvhd.write("mvhd", 4, "latin1");
    mvhd.writeUInt32BE(1000, 8 + 12);
    mvhd.writeUInt32BE(duracaoMs, 8 + 16);
    const moov = Buffer.alloc(8);
    moov.writeUInt32BE(8 + mvhd.length, 0);
    moov.write("moov", 4, "latin1");
    return Buffer.concat([ftyp, moov, mvhd]);
  }
  it("confere o tipo pelos primeiros bytes e lê a duração", async () => {
    const { confere, duracaoDoVideo } = await import("./video");
    const b = mp4(15_000);
    expect(confere(b, "video/mp4")).toBe(true);
    expect(confere(Buffer.from("GIF89a-------"), "video/mp4")).toBe(false);
    expect(duracaoDoVideo(b, "video/mp4")).toBe(15_000);
    expect(duracaoDoVideo(Buffer.from("lixo"), "video/mp4")).toBeNull();
  });
});
