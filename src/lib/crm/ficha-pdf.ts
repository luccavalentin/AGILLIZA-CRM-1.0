import type { FichaConsolidada } from "@/lib/crm/documentos-gerais.functions";
import logoLight from "@/assets/brand/agilliza-logo-oficial-light.png";
import symbolLight from "@/assets/brand/agilliza-symbol-oficial-light.png";
import symbolDark from "@/assets/brand/agilliza-symbol-oficial.png";
import { getTheme } from "@/lib/theme";

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

function titulo(s: string | null | undefined): string {
  if (!s || !s.trim()) return "—";
  return s
    .toLowerCase()
    .replace(/\S+/g, (palavra, offset: number) => {
      if (offset !== 0 && MINUSCULAS.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    });
}

function brl(n: number | null | undefined): string {
  return n == null || n === ("" as any)
    ? "—"
    : Number(n).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  style: "currency", currency: "BRL" });
}

function fmtData(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function docLabel(tipo: string | null | undefined): string {
  return tipo === "juridica" ? "CNPJ" : "CPF";
}

function val(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return escapeHtml(String(v));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Monta o bloco de endereço em uma linha legível. */
function enderecoLinha(e: Record<string, any> | null | undefined): string | null {
  if (!e) return null;
  const linha1 = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const linha2 = [e.complemento, e.bairro].filter(Boolean).join(" · ");
  const linha3 = [
    [e.cidade, e.uf].filter(Boolean).join(" / "),
    e.cep ? `CEP ${e.cep}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const tudo = [linha1, linha2, linha3].filter(Boolean).join(" — ");
  return tudo || null;
}

type Par = [string, string];

/** Descarta campos vazios ("—") para que a ficha não fique poluída. */
function campos(pares: Par[]): string {
  const preenchidos = pares.filter(([, valor]) => valor && valor !== "—");
  const lista = preenchidos.length ? preenchidos : pares.slice(0, 2);
  return `<div class="grid">${lista
    .map(
      ([rotulo, valor]) => `
        <div class="field">
          <span class="field-label">${escapeHtml(rotulo)}</span>
          <span class="field-value">${valor}</span>
        </div>`,
    )
    .join("")}</div>`;
}

function secao(num: number, tit: string, corpo: string): string {
  return `
    <section class="secao">
      <div class="secao-head">
        <span class="secao-num">${String(num).padStart(2, "0")}</span>
        <h2 class="secao-titulo">${escapeHtml(tit)}</h2>
      </div>
      ${corpo}
    </section>`;
}

/**
 * Monta o HTML profissional da ficha consolidada e abre a janela de impressão
 * do navegador (que permite salvar como PDF).
 */
export function imprimirFichaPDF(clienteNome: string, data: FichaConsolidada): void {
  const nome = titulo(clienteNome);
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const dark = getTheme() === "dark";
  const logoUrl = new URL(logoLight, window.location.origin).href;
  const marcaUrl = new URL(dark ? symbolLight : symbolDark, window.location.origin).href;
  const meta = data.meta ?? {};

  const partes: string[] = [];
  let n = 0;

  // Comprador / proponente
  if (data.comprador) {
    const c = data.comprador;
    partes.push(
      secao(
        ++n,
        c.tipo_pessoa === "juridica" ? "Proponente (PJ)" : "Comprador / Proponente",
        campos([
          ["Nome", val(c.nome)],
          [docLabel(c.tipo_pessoa), val(c.documento)],
          ["RG / Doc. secundário", val(c.documento_secundario || c.numero_documento)],
          ["Órgão expedidor", val([c.orgao_expedidor, c.uf_expedicao].filter(Boolean).join("/") || null)],
          ["Data de nascimento", fmtData(c.data_nascimento)],
          ["Sexo", val(c.sexo)],
          ["Estado civil", val(c.estado_civil)],
          ["Regime de casamento", val(c.regime_casamento)],
          ["Nacionalidade", val(c.nacionalidade)],
          ["Naturalidade", val(c.naturalidade)],
          ["Profissão", val(c.profissao)],
          ["Empresa", val(c.empresa)],
          ["E-mail", val(c.email)],
          ["Celular", val(c.telefone_celular)],
          ["Renda declarada", brl(c.renda_total_declarada)],
          ["Utiliza FGTS", val(c.utiliza_fgts)],
          ["Nome da mãe", val(c.nome_mae)],
          ["Nome do pai", val(c.nome_pai)],
          ["Banco", val(c.banco_conta)],
          [
            "Agência / Conta",
            val(
              [c.agencia, [c.conta_corrente, c.digito_conta].filter(Boolean).join("-")]
                .filter(Boolean)
                .join(" / ") || null,
            ),
          ],
          ["Endereço", val(enderecoLinha(c.endereco))],
        ]),
      ),
    );
  }

  // Cônjuge
  if (data.conjuge) {
    const c = data.conjuge;
    partes.push(
      secao(
        ++n,
        "Cônjuge / Coproponente",
        campos([
          ["Nome", val(c.nome)],
          ["CPF", val(c.documento)],
          ["RG / Doc.", val(c.numero_documento)],
          ["Órgão expedidor", val([c.orgao_expedidor, c.uf_expedicao].filter(Boolean).join("/") || null)],
          ["Data de nascimento", fmtData(c.data_nascimento)],
          ["Sexo", val(c.sexo)],
          ["Nacionalidade", val(c.nacionalidade)],
          ["Profissão", val(c.profissao)],
          ["Empresa", val(c.empresa)],
          ["E-mail", val(c.email)],
          ["Celular", val(c.telefone_celular)],
          ["Renda declarada", brl(c.renda)],
          ["Nome da mãe", val(c.nome_mae)],
          ["Banco", val(c.banco_conta)],
          [
            "Agência / Conta",
            val(
              [c.agencia, [c.conta_corrente, c.digito_conta].filter(Boolean).join("-")]
                .filter(Boolean)
                .join(" / ") || null,
            ),
          ],
        ]),
      ),
    );
  }

  // Vendedores
  const vendedoresCorpo =
    data.vendedores.length === 0
      ? `<p class="vazio">Nenhum vendedor cadastrado.</p>`
      : data.vendedores
          .map(
            (v, i) => `
            <div class="bloco">
              <h3 class="bloco-titulo">${escapeHtml(titulo(v.nome) || `Vendedor ${i + 1}`)}</h3>
              ${campos([
                [docLabel(v.tipo_pessoa), val(v.documento)],
                ["RG / Doc.", val(v.numero_documento || v.documento_secundario)],
                ["Data de nascimento", fmtData(v.data_nascimento)],
                ["Estado civil", val(v.estado_civil)],
                ["Nacionalidade", val(v.nacionalidade)],
                ["Profissão", val(v.profissao)],
                ["E-mail", val(v.email)],
                ["Celular", val(v.telefone_celular)],
                ["Nome da mãe", val(v.mae)],
                ["Banco", val(v.banco_conta)],
                [
                  "Agência / Conta",
                  val(
                    [v.agencia, [v.conta_corrente, v.digito_conta].filter(Boolean).join("-")]
                      .filter(Boolean)
                      .join(" / ") || null,
                  ),
                ],
                [
                  "Endereço",
                  val(
                    enderecoLinha({
                      logradouro: v.logradouro,
                      numero: v.numero,
                      complemento: v.complemento,
                      bairro: v.bairro,
                      cidade: v.cidade,
                      uf: v.uf,
                      cep: v.cep,
                    }),
                  ),
                ],
              ])}
            </div>`,
          )
          .join("");
  partes.push(
    secao(
      ++n,
      data.vendedores.length > 1 ? `Vendedores (${data.vendedores.length})` : "Vendedor",
      vendedoresCorpo,
    ),
  );

  // Imóveis
  const imoveisCorpo =
    data.imoveis.length === 0
      ? `<p class="vazio">Nenhum imóvel cadastrado.</p>`
      : data.imoveis
          .map(
            (im, i) => `
            <div class="bloco">
              <h3 class="bloco-titulo">Imóvel ${i + 1}${im.valor != null ? ` · <span class="destaque">${brl(im.valor)}</span>` : ""}</h3>
              ${campos([
                ["Tipo", val(im.tipo)],
                ["Uso", val(im.uso)],
                ["Situação", val(im.situacao)],
                ["Valor", brl(im.valor)],
                [
                  "Endereço",
                  val(
                    enderecoLinha({
                      logradouro: im.logradouro,
                      numero: im.numero,
                      complemento: im.complemento,
                      bairro: im.bairro,
                      cidade: im.cidade,
                      uf: im.uf,
                      cep: im.cep,
                    }),
                  ),
                ],
              ])}
            </div>`,
          )
          .join("");
  partes.push(secao(++n, data.imoveis.length > 1 ? "Imóveis" : "Imóvel", imoveisCorpo));

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Ficha — ${escapeHtml(nome)}</title>
<style>
  :root {
    ${
      dark
        ? `--pagina-bg: #0e0f16;
    --tinta: #e6e8f0;
    --suave: #9aa3b2;
    --linha: #2e3142;
    --card: #171826;
    --accent: #93a6ff;
    --chip-bg: #1a1c28;
    --chip-texto: #93a6ff;
    --chip-borda: #2e3142;
    --badge: #000f9f;`
        : `--pagina-bg: #ffffff;
    --tinta: #0b0b0f;
    --suave: #4b5563;
    --linha: #e6e8f0;
    --card: #f7f8fa;
    --accent: #000f9f;
    --chip-bg: #eef0ff;
    --chip-texto: #000a70;
    --chip-borda: #d9ddfb;
    --badge: #000f9f;`
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--pagina-bg); }
  body {
    font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--tinta);
    font-size: 12px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pagina { max-width: 800px; margin: 0 auto; padding: 0 0 40px; }

  /* Cabeçalho */
  .cabecalho {
    background: linear-gradient(135deg, #00052e 0%, #000a70 55%, #000f9f 100%);
    color: #fff;
    padding: 30px 40px 26px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    position: relative;
    overflow: hidden;
  }
  .cabecalho::after {
    content: "";
    position: absolute;
    right: -40px; top: -60px;
    width: 220px; height: 220px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,.10), transparent 70%);
  }
  .logo { height: 40px; width: auto; display: block; }
  .cab-meta { text-align: right; font-size: 10px; color: rgba(255,255,255,.72); line-height: 1.7; }
  .cab-meta strong { color: #fff; font-weight: 600; }

  /* Faixa do título */
  .titulo-faixa {
    padding: 26px 40px 22px;
    border-bottom: 1px solid var(--linha);
  }
  .subtitulo-doc {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2.5px;
    color: var(--accent);
    font-weight: 700;
  }
  .titulo-doc {
    margin: 6px 0 12px;
    font-size: 26px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -.3px;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .3px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--chip-bg);
    color: var(--accent);
    border: 1px solid #d9ddfb;
  }

  /* Conteúdo */
  .corpo { padding: 8px 40px 0; }
  .secao { margin-top: 26px; page-break-inside: avoid; }
  .secao-head { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; }
  .secao-num {
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: var(--badge);
    width: 24px; height: 24px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  .secao-titulo {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--accent);
    margin: 0;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--linha);
    flex: 1;
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field {
    background: var(--card);
    border: 1px solid var(--linha);
    border-radius: 8px;
    padding: 9px 13px;
    display: flex;
    flex-direction: column;
  }
  .field-label {
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .8px;
    color: var(--suave);
  }
  .field-value {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--tinta);
    margin-top: 3px;
    word-break: break-word;
  }
  .bloco {
    border: 1px solid var(--linha);
    border-left: 4px solid var(--accent);
    border-radius: 8px;
    padding: 13px 15px;
    margin-bottom: 12px;
    page-break-inside: avoid;
    background: var(--card);
  }
  .bloco-titulo { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--accent); }
  .destaque { color: var(--accent); }
  .vazio { color: var(--suave); font-style: italic; margin: 0; }

  /* Rodapé */
  .rodape {
    margin: 40px 40px 0;
    padding-top: 14px;
    border-top: 2px solid var(--linha);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 9px;
    color: var(--suave);
  }
  .rodape-marca { display: flex; align-items: center; gap: 8px; }
  .rodape-simbolo { height: 22px; width: auto; }
  .rodape strong { color: var(--accent); }

  @media print {
    .pagina { max-width: none; }
    .cabecalho { padding: 24px 24mm; }
    .titulo-faixa, .corpo { padding-left: 24mm; padding-right: 24mm; }
    .rodape { margin-left: 24mm; margin-right: 24mm; }
    @page { margin: 0 0 12mm; }
  }
</style>
</head>
<body>
  <div class="pagina">
    <div class="cabecalho">
      <img class="logo" src="${logoUrl}" alt="Agilliza" />
      <div class="cab-meta">
        <strong>Ficha Consolidada do Cliente</strong><br/>
        Emitida em ${escapeHtml(agora)}${
          meta.numero_cliente ? `<br/>Cliente Nº ${escapeHtml(String(meta.numero_cliente))}` : ""
        }
      </div>
    </div>

    <div class="titulo-faixa">
      <div class="subtitulo-doc">Crédito Imobiliário</div>
      <h1 class="titulo-doc">${escapeHtml(nome)}</h1>
      <div class="chips">
        ${meta.tipo_pessoa ? `<span class="chip">${escapeHtml(meta.tipo_pessoa === "juridica" ? "Pessoa Jurídica" : "Pessoa Física")}</span>` : ""}
        ${meta.origem ? `<span class="chip">Origem: ${escapeHtml(String(meta.origem))}</span>` : ""}
        ${meta.uf_interesse ? `<span class="chip">UF de interesse: ${escapeHtml(String(meta.uf_interesse))}</span>` : ""}
        ${meta.criado_em ? `<span class="chip">Cadastro: ${escapeHtml(fmtData(meta.criado_em))}</span>` : ""}
      </div>
    </div>

    <div class="corpo">
      ${partes.join("")}
    </div>

    <div class="rodape">
      <div class="rodape-marca">
        <img class="rodape-simbolo" src="${marcaUrl}" alt="" />
        <span>Documento gerado automaticamente pela plataforma <strong>Agilliza</strong>.</span>
      </div>
      <span>${escapeHtml(nome)}</span>
    </div>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 350);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    alert("Habilite pop-ups para gerar o PDF da ficha.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
