/**
 * Trava permanente do teste adversarial de 23/10/2026: toda server function que
 * fala com a plataforma pela ponte (comPlataforma/comConta) ou lê os códigos de
 * acesso dos bancos precisa da guarda `exigirPermissao` com o módulo certo.
 *
 * A server function é um endereço HTTP que qualquer pessoa logada chama com o
 * próprio token — esconder o botão na tela não protege nada.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = join(__dirname, "..");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

interface ServerFn {
  arquivo: string;
  nome: string;
  guardas: string[];
  usaPonte: boolean;
  /** Auditoria rodada 2: as outras portas da ponte (chat, ponte direta, News da equipe). */
  usaPonteDireta: boolean;
  metodo: "GET" | "POST";
  corpo: string;
  usaCodigos: boolean;
}

function varrer(): ServerFn[] {
  const out: ServerFn[] = [];
  for (const a of arquivos(RAIZ)) {
    const s = readFileSync(a, "utf8");
    if (!s.includes("createServerFn")) continue;
    // Middlewares nomeados: const VER = exigirPermissao([...]) / const ler = () => exigirPermissao(...)
    const nomes = new Map<string, string>();
    for (const m of s.matchAll(/const\s+(\w+)\s*=\s*(?:\(\)\s*=>\s*)?exigirPermissao\(([\s\S]*?)\);/g)) {
      nomes.set(m[1], m[2].replace(/\s+/g, ""));
    }
    const inicios = [...s.matchAll(/export\s+const\s+(\w+)\s*=\s*createServerFn\(/g)];
    inicios.forEach((m, i) => {
      const fim = i + 1 < inicios.length ? inicios[i + 1].index! : s.length;
      const bloco = s.slice(m.index!, fim);
      const h = bloco.indexOf(".handler(");
      const cab = h > 0 ? bloco.slice(0, h) : bloco;
      const corpo = h > 0 ? bloco.slice(h) : "";
      const mw = (cab.match(/\.middleware\(([\s\S]*)$/)?.[1] ?? "").replace(/\s+/g, "");
      const guardas = [
        ...[...mw.matchAll(/exigirPermissao\((.*?)\)\]/g)].map((x) => x[1]),
        ...[...nomes.entries()].filter(([n]) => mw.split(/[^A-Za-z0-9_]/).includes(n)).map(([, g]) => g),
      ];
      out.push({
        arquivo: relative(RAIZ, a).split(sep).join("/"),
        nome: m[1],
        guardas,
        usaPonte: /\bcom(Plataforma|Conta)\b/.test(corpo),
        usaPonteDireta: /\b(comChatAgilliza|comPonteDireta|consultarNewsDaEquipe|dependenciasReaisConsulta)\b/.test(corpo),
        metodo: /createServerFn\(\{\s*method:\s*"POST"/.test(bloco) ? "POST" : "GET",
        corpo,
        usaCodigos: /codigos_(caixas|recebidos)/.test(corpo),
      });
    });
  }
  return out;
}

const todas = varrer();

describe("guardas das server functions da ponte", () => {
  it("encontra as server functions (sanidade da varredura)", () => {
    expect(todas.length).toBeGreaterThan(300);
    expect(todas.filter((f) => f.usaPonte).length).toBeGreaterThan(80);
  });

  it("toda server function da ponte tem exigirPermissao com módulo saas.*, imobmatch.*, marketing.automacoes ou financeiro.repasses", () => {
    const sem = todas
      .filter((f) => f.usaPonte)
      .filter(
        (f) =>
          !f.guardas.some((g) =>
            /"(saas\.[a-z_]+|imobmatch\.(visao|moderacao|financeiro|planos|config)|marketing\.automacoes|financeiro\.repasses)"/.test(g),
          ),
      )
      .map((f) => `${f.arquivo} › ${f.nome}`);
    expect(sem).toEqual([]);
  });

  it("a Gestão de Tecnologia pede saas.tecnologia; as Automações, marketing.automacoes", () => {
    const tec = todas.filter((f) => f.arquivo === "tecnologia/tecnologia.functions.ts");
    expect(tec.length).toBeGreaterThan(5);
    for (const f of tec) expect(f.guardas.join()).toContain('"saas.tecnologia"');
    const aut = todas.filter((f) => f.arquivo === "social/automacoes.functions.ts" && f.usaPonte);
    for (const f of aut) expect(f.guardas.join()).toContain('"marketing.automacoes"');
  });

  it("repasses aos assinantes (financeiro da matriz): só com financeiro.repasses e a ação certa", () => {
    const rp = todas.filter((f) => f.arquivo === "financeiro/repasses.functions.ts");
    expect(rp.length).toBeGreaterThanOrEqual(10);
    for (const f of rp) expect(f.guardas.join(), f.nome).toContain('"financeiro.repasses"');
    const acao = (nome: string) => rp.find((f) => f.nome === nome)!.guardas.join();
    expect(acao("pagarRepasse")).toContain('"pagar"');
    expect(acao("estornarPagamentoRepasse")).toContain('"pagar"');
    expect(acao("aprovarRepasses")).toContain('"aprovar"');
    expect(acao("definirRegraRepasse")).toContain('"regras"');
    expect(acao("cancelarRepasse")).toContain('"edit"');
  });

  it("códigos de acesso: só com operacional.codigos", () => {
    const cod = todas.filter((f) => f.usaCodigos || f.arquivo === "codigos/codigos.functions.ts");
    expect(cod.length).toBeGreaterThanOrEqual(4);
    for (const f of cod) expect(f.guardas.join()).toContain('"operacional.codigos"');
  });

  it("Gestão de Parceiros e Anúncios: ler pede saas.imobmatch; decidir pede saas.imobmatch edit", () => {
    const im = todas.filter((f) => f.arquivo === "plataforma/imobmatch.functions.ts");
    expect(im.length).toBeGreaterThanOrEqual(14);
    for (const f of im) expect(f.guardas.join()).toContain('"saas.imobmatch"');
    // Toda escrita (POST) exige a ação "edit" — ver não basta para moderar.
    const fonte = readFileSync(join(RAIZ, "plataforma/imobmatch.functions.ts"), "utf8");
    const posts = [...fonte.matchAll(/export const (\w+) = createServerFn\(\{ method: "POST" \}\)/g)].map(
      (m) => m[1],
    );
    expect(posts.length).toBeGreaterThanOrEqual(5);
    for (const nome of posts) {
      const f = im.find((x) => x.nome === nome)!;
      expect(f.guardas.join(), nome).toContain('"edit"');
    }
  });

  it("ImobMatch Gestão (0460 do Corretor): cada tela com o seu módulo; escrever exige edit; dinheiro só com o Financeiro", () => {
    const ig = todas.filter((f) => f.arquivo === "plataforma/imobmatch-gestao.functions.ts");
    expect(ig.length).toBeGreaterThanOrEqual(9);
    const g = (nome: string) => ig.find((f) => f.nome === nome)!.guardas.join();
    // Dinheiro: só o módulo Financeiro do ImobMatch (nem a visão geral, nem a moderação).
    for (const nome of ["lerFinanceiroImobMatch", "lerFaturasImobMatch"]) {
      expect(g(nome), nome).toBe('["imobmatch.financeiro","view"]');
    }
    expect(g("lerPlanosImobMatch")).toContain('"imobmatch.planos","view"');
    expect(g("lerParametrosImobMatch")).toContain('"imobmatch.config","view"');
    for (const nome of postsDe("plataforma/imobmatch-gestao.functions.ts")) {
      expect(g(nome), nome).toContain('"edit"');
      expect(g(nome), nome).not.toContain('"view"');
    }
    expect(g("salvarPlanoImobMatch")).toContain('"imobmatch.planos","edit"');
    expect(g("salvarProdutoLojaImobMatch")).toContain('"imobmatch.planos","edit"');
    expect(g("salvarParametroImobMatch")).toContain('"imobmatch.config","edit"');
    // Toda escrita passa por função do banco com a regra (nada de UPDATE direto daqui).
    const fonte = readFileSync(join(RAIZ, "plataforma/imobmatch-gestao.functions.ts"), "utf8");
    expect(fonte).toContain("plataforma.imobmatch_salvar_plano($1, $2::jsonb)");
    expect(fonte).toContain("plataforma.imobmatch_salvar_parametro($1, $2::jsonb)");
    expect(fonte).toContain("imobmatch.configurar_produto_loja($1, $2, $3, $4, $5)");
    expect(fonte).not.toMatch(/(update|insert into|delete from)\s+(nucleo|plataforma|imobmatch)\./i);
  });

  it("receita do ImobMatch no financeiro da matriz (0461): financeiro.repasses ver, só leitura", () => {
    const fs = todas.filter((f) => f.arquivo === "financeiro/imobmatch-matriz.functions.ts");
    expect(fs.map((f) => f.nome)).toEqual(["receitaImobMatchMatriz"]);
    expect(fs[0].guardas.join()).toBe('["financeiro.repasses","view"]');
    expect(fs[0].metodo).toBe("GET");
    expect(fs[0].corpo).toContain("plataforma.financeiro_matriz_imobmatch($1::date, $2::date)");
  });

  it("moderação do ImobMatch: aceita o módulo novo (imobmatch.moderacao) e o antigo, com a mesma ação", () => {
    for (const arquivo of [
      "plataforma/imobmatch.functions.ts",
      "plataforma/comunidade.functions.ts",
      "plataforma/chat-moderacao.functions.ts",
    ]) {
      for (const f of todas.filter((x) => x.arquivo === arquivo)) {
        const gs = f.guardas.join();
        expect(gs, f.nome).toContain('"imobmatch.moderacao"');
        if (f.metodo === "POST") expect(gs, f.nome).not.toContain('"view"');
      }
    }
  });

  it("banners patrocinados: saas.patrocinados (preços: saas.planos edit); escrita exige edit", () => {
    const pt = todas.filter((f) => f.arquivo === "plataforma/patrocinados.functions.ts");
    expect(pt.length).toBeGreaterThanOrEqual(12);
    for (const f of pt) expect(f.guardas.join()).toMatch(/"saas\.(patrocinados|planos)"/);
    const fonte = readFileSync(join(RAIZ, "plataforma/patrocinados.functions.ts"), "utf8");
    const posts = [...fonte.matchAll(/export const (\w+) = createServerFn\(\{ method: "POST" \}\)/g)].map(
      (m) => m[1],
    );
    expect(posts.length).toBeGreaterThanOrEqual(6);
    for (const nome of posts) {
      const f = pt.find((x) => x.nome === nome)!;
      expect(f.guardas.join(), nome).toContain('"edit"');
      expect(f.guardas.join(), nome).not.toContain('"view"');
    }
    const precos = pt.filter((f) => f.nome === "salvarPacote" || f.nome === "salvarEspaco");
    expect(precos.length).toBe(2);
    for (const f of precos) expect(f.guardas.join()).toContain('"saas.planos"');
  });

  it("aprovar e reprovar criativo levam a versão que o moderador viu (0294 do Corretor)", () => {
    const fonte = readFileSync(join(RAIZ, "plataforma/patrocinados.functions.ts"), "utf8");
    expect(fonte).toContain("plataforma.patrocinio_aprovar($1, $2)");
    expect(fonte).toContain("plataforma.patrocinio_reprovar($1, $2, $3)");
    expect(fonte).not.toMatch(/patrocinio_aprovar\(\$1\)|patrocinio_reprovar\(\$1, \$2\)/);
    const fila = readFileSync(
      join(RAIZ, "../components/plataforma/imobmatch/banners-fila.tsx"),
      "utf8",
    );
    // D3 (0302 do Corretor): manda a versão que o moderador ANALISOU, e se o criativo mudar
    // com a tela aberta a decisão trava até ele conferir a prévia nova (novo clique consciente).
    expect(fila).toContain("versao: versaoVista");
    expect(fila).not.toContain("versao: c.versao");
    expect(fila).toContain("Analisei a versão nova");
    expect(fila).toMatch(/disabled=\{aprovar\.isPending \|\| mudou\}/);
  });

  it("Consultas: só ver lê o custo com cobranca.ler; registrar custo segue no edit (0303 do Corretor)", () => {
    const fonte = readFileSync(join(RAIZ, "plataforma/consultas.functions.ts"), "utf8");
    expect(fonte).toContain("seguranca.auth_e_plataforma('cobranca.ler')");
    const cs = todas.filter((f) => f.arquivo === "plataforma/consultas.functions.ts");
    const registrar = cs.find((f) => f.nome === "registrarCustoConsulta")!;
    expect(registrar.guardas.join()).toContain('"edit"');
  });

  /** POSTs de um arquivo: todos exigem "edit" do módulo (ver nunca basta para mudar). */
  const postsDe = (arquivo: string) => {
    const fonte = readFileSync(join(RAIZ, arquivo), "utf8");
    return [...fonte.matchAll(/export const (\w+) = createServerFn\(\{ method: "POST" \}\)/g)].map((m) => m[1]);
  };

  it("carteiras (C50): ler pede saas.licencas; criar, editar, arquivar e mexer em contas pedem edit", () => {
    const cs = todas.filter((f) => f.arquivo === "plataforma/carteiras.functions.ts");
    expect(cs.length).toBeGreaterThanOrEqual(7);
    for (const f of cs) expect(f.guardas.join()).toContain('"saas.licencas"');
    const posts = postsDe("plataforma/carteiras.functions.ts");
    expect(posts.sort()).toEqual(
      ["adicionarContasCarteira", "arquivarCarteira", "criarCarteira", "editarCarteira", "removerContaCarteira"].sort(),
    );
    for (const nome of posts) {
      const f = cs.find((x) => x.nome === nome)!;
      expect(f.guardas.join(), nome).toContain('"edit"');
      expect(f.guardas.join(), nome).not.toContain('"view"');
    }
  });

  it("suporte (C59): atribuir chamado pede saas.suporte edit; métricas e equipe, ver", () => {
    const sp = todas.filter((f) => f.arquivo === "plataforma/suporte.functions.ts");
    for (const f of sp) expect(f.guardas.join()).toContain('"saas.suporte"');
    const atribuir = sp.find((f) => f.nome === "atribuirChamado")!;
    expect(atribuir.guardas.join()).toContain('"edit"');
    for (const nome of postsDe("plataforma/suporte.functions.ts")) {
      expect(sp.find((x) => x.nome === nome)!.guardas.join(), nome).toContain('"edit"');
    }
  });

  it("marketplace (C61): decidir (Aprovar/Não aprovar) pede saas.marketplace edit, pela função com motivo", () => {
    const mk = todas.filter((f) => f.arquivo === "plataforma/marketplace.functions.ts");
    for (const f of mk) expect(f.guardas.join()).toContain('"saas.marketplace"');
    const decidir = mk.find((f) => f.nome === "decidirEspecialista")!;
    expect(decidir.guardas.join()).toContain('"edit"');
    const fonte = readFileSync(join(RAIZ, "plataforma/marketplace.functions.ts"), "utf8");
    // A decisão passa pela função do banco (motivo, histórico e aviso); nada de UPDATE direto.
    expect(fonte).toContain("ecossistema.decidir_especialista($1, $2, $3)");
    expect(fonte).not.toMatch(/update ecossistema\.especialistas/i);
  });

  it("comunidade: ler pede saas.imobmatch; decidir pede saas.imobmatch edit e a função com motivo", () => {
    const cm = todas.filter((f) => f.arquivo === "plataforma/comunidade.functions.ts");
    expect(cm.length).toBe(2);
    for (const f of cm) expect(f.guardas.join()).toContain('"saas.imobmatch"');
    const decidir = cm.find((f) => f.nome === "decidirDenunciaComunidade")!;
    expect(decidir.guardas.join()).toContain('"edit"');
    const fonte = readFileSync(join(RAIZ, "plataforma/comunidade.functions.ts"), "utf8");
    expect(fonte).toContain("plataforma.comunidade_decidir($1, $2, $3)");
    expect(fonte).not.toContain("rede.imobnet_moderar(");
  });

  it('a tela da comunidade escreve "ImobMatch Comunidade", nunca "ImobNet"', () => {
    const telas = [
      ...arquivos(join(RAIZ, "../components/plataforma")),
      ...arquivos(join(RAIZ, "../routes/_authenticated")).filter((a) => /plataforma\./.test(a)),
    ];
    const comImobNet = telas.filter((a) => /ImobNet/.test(readFileSync(a, "utf8")));
    expect(comImobNet.map((a) => relative(RAIZ, a))).toEqual([]);
    const aba = readFileSync(join(RAIZ, "../components/plataforma/imobmatch/aba-comunidade.tsx"), "utf8");
    expect(aba).toContain("ImobMatch Comunidade");
  });

  it("comissões dos assinantes pedem saas.comissoes", () => {
    const com = todas.filter((f) => f.arquivo === "plataforma/comissoes-assinantes.functions.ts");
    expect(com.length).toBeGreaterThan(0);
    for (const f of com) expect(f.guardas.join()).toContain('"saas.comissoes"');
  });

  /*
   * Auditoria rodada 2 (26/10/2026): a varredura só via comPlataforma/comConta. As outras portas
   * da ponte — o chat (comChatAgilliza), a ponte direta da Consulta Ficha (comPonteDireta, via
   * dependenciasReaisConsulta) e o News da equipe (consultarNewsDaEquipe) — passavam sem conferência.
   */
  it("as outras portas da ponte também são vistas (sanidade)", () => {
    const nomes = todas.filter((f) => f.usaPonteDireta).map((f) => f.nome);
    for (const n of ["chatAcao", "chatEnviarArquivo", "lerNewsDaEquipe", "registrarEventosNewsEquipe", "consultarFichaBureau"]) {
      expect(nomes, n).toContain(n);
    }
  });

  it("toda server function das outras portas tem guarda: exigirPermissao, pessoa do chat com a ação, ou sessão + id da pessoa conferido no banco", () => {
    const sem = todas
      .filter((f) => f.usaPonteDireta)
      .filter((f) => {
        if (f.guardas.length) return false;
        if (/pessoaDoChat\(data\.canal( as CanalChat)?,\s*(permissaoDaAcao\(|"create"|"view")/.test(f.corpo)) return false;
        // News da equipe: só com sessão e o id da pessoa (o banco confere que ela é da equipe ativa).
        if (/consultarNewsDaEquipe/.test(f.corpo) && /context\.userId/.test(f.corpo)) return false;
        return true;
      })
      .map((f) => `${f.arquivo} › ${f.nome}`);
    expect(sem).toEqual([]);
  });

  /**
   * AÇÃO: função que ESCREVE (POST) por qualquer porta da ponte não passa só com "ver". As exceções
   * são de propósito, uma a uma, com o motivo (lista fechada: função nova cai no teste).
   */
  const ESCREVE_COM_VER: Record<string, string> = {
    // Consulta paga pelo contrato do correspondente: a regra de negócio é "quem vê Clientes consulta";
    // o abuso (disparo em massa) é barrado no banco pelo limite diário por pessoa e por correspondente.
    "bureau/bureau.functions.ts › consultarFichaBureau": "limite diário no banco",
    // Telemetria da própria leitura do News (impressão, clique): não muda dado de ninguém.
    "plataforma/news.functions.ts › registrarEventosNewsEquipe": "telemetria da própria leitura",
    // "Abrir no Agilliza": espelho idempotente da simulação/cliente da conta para a tela nativa
    // (para LER no Agilliza); o que se faz depois na tela nativa segue a permissão do Agilliza.
    "plataforma/conta-nativa.functions.ts › espelharSimulacaoDaConta": "espelho idempotente para abrir",
    "plataforma/conta-nativa.functions.ts › espelharClienteDaConta": "espelho idempotente para abrir",
    // Relatórios: POST só porque os filtros vão no corpo; nada é gravado.
    "relatorios/ecossistema.functions.ts › getRelatorioContas": "leitura (filtros no corpo)",
    "relatorios/producao-ecossistema.functions.ts › getProducaoPlataforma": "leitura (filtros no corpo)",
    "relatorios/producao-ecossistema.functions.ts › getOpcoesPlataforma": "leitura (filtros no corpo)",
  };

  it("POST pela ponte exige a ação de escrita (ver não basta), salvo as exceções com motivo", () => {
    const soVer = todas
      .filter((f) => (f.usaPonte || f.usaPonteDireta) && f.metodo === "POST")
      .filter((f) => {
        const g = f.guardas.join();
        if (f.guardas.length) return !/"(edit|create|delete|aprovar|pagar|regras|baixar|executar|gerir)"/.test(g);
        // Sem exigirPermissao: o chat decide a ação por permissaoDaAcao (escrita = create).
        if (/pessoaDoChat\(data\.canal( as CanalChat)?,\s*(permissaoDaAcao\(|"create")/.test(f.corpo)) return false;
        return true;
      })
      .map((f) => `${f.arquivo} › ${f.nome}`)
      .filter((k) => !(k in ESCREVE_COM_VER));
    expect(soVer).toEqual([]);
    // As exceções continuam existindo (exceção morta sai da lista).
    for (const k of Object.keys(ESCREVE_COM_VER)) {
      expect(todas.some((f) => `${f.arquivo} › ${f.nome}` === k), k).toBe(true);
    }
  });

  it("chat: anexar exige Enviar mensagens; ação de escrita do chat pede create", () => {
    const anexo = todas.find((f) => f.nome === "chatEnviarArquivo")!;
    expect(anexo.corpo).toMatch(/pessoaDoChat\(data\.canal,\s*"create"\)/);
    const acao = todas.find((f) => f.nome === "chatAcao")!;
    expect(acao.corpo).toMatch(/pessoaDoChat\(data\.canal as CanalChat,\s*permissaoDaAcao\(/);
  });
});
