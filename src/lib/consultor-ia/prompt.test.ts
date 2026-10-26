import { describe, expect, it } from "vitest";
import { limparResposta, mensagemComContexto, promptDeSistema, MARCADOR_SEM_INFO } from "./prompt";

const T = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    categoria: "FGTS",
    titulo: "Uso do FGTS",
    conteudo: "Regra A",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    categoria: "Bradesco",
    titulo: "Fluxo Bradesco",
    conteudo: "Regra B",
  },
];

describe("prompt do Consultor IA", () => {
  it("sistema de especialista: números só do bloco de cálculo, fontes da base, aviso de dado atual", () => {
    const p = promptDeSistema({ nomeUsuario: "Ana", hoje: "26/10/2026" });
    expect(p).toMatch(/SFH/);
    expect(p).toMatch(/SAC/);
    expect(p).toMatch(/CÁLCULOS DO SISTEMA/);
    expect(p).toMatch(/DADO ATUAL/);
    expect(p).toContain(MARCADOR_SEM_INFO);
    expect(p).not.toMatch(/pollinations|image\.pollinations/);
  });

  it("monta a mensagem com os trechos numerados, os cálculos e o alerta", () => {
    const m = mensagemComContexto({
      pergunta: "Qual a taxa hoje?",
      trechos: T,
      calculos: "(nenhum)",
      dadoAtual: true,
    });
    expect(m).toContain("[1] id=11111111");
    expect(m).toContain("[2] id=22222222");
    expect(m).toContain("ATENÇÃO");
    expect(m.endsWith("PERGUNTA: Qual a taxa hoje?")).toBe(true);
  });

  it("limpa a resposta: fontes só da base (por id ou número), marcador removido", () => {
    const bruto = `${MARCADOR_SEM_INFO} Resposta com base em [2] e numa fonte inventada.\nFONTES: 99999999-9999-4999-8999-999999999999, 1`;
    const r = limparResposta(bruto, T);
    expect(r.semInfo).toBe(true);
    expect(r.texto).toBe("Resposta com base em [2] e numa fonte inventada.");
    expect(r.fontes.map((f) => f.titulo).sort()).toEqual(["Fluxo Bradesco", "Uso do FGTS"]);
    expect(limparResposta("", T).texto).toMatch(/Não consegui/);
    expect(limparResposta("Sem fontes.\nFONTES: nenhuma", T).fontes).toEqual([]);
  });
});
