import type { FichaConsolidada } from "@/lib/crm/documentos-gerais.functions";

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
  return n == null
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
}

function val(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  return escapeHtml(String(v));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function campos(pares: Array<[string, string]>): string {
  return `<div class="grid">${pares
    .map(
      ([rotulo, valor]) => `
        <div class="field">
          <span class="field-label">${escapeHtml(rotulo)}</span>
          <span class="field-value">${valor}</span>
        </div>`,
    )
    .join("")}</div>`;
}

function secao(titulo: string, corpo: string): string {
  return `
    <section class="secao">
      <h2 class="secao-titulo">${escapeHtml(titulo)}</h2>
      ${corpo}
    </section>`;
}

/**
 * Monta o HTML profissional da ficha consolidada e abre a janela de impressão
 * do navegador (que permite salvar como PDF).
 */
export function imprimirFichaPDF(clienteNome: string, data: FichaConsolidada): void {
  const nome = titulo(clienteNome);
  const agora = new Date().toLocaleString("pt-BR");

  const partes: string[] = [];

  // Comprador
  if (data.comprador) {
    const c = data.comprador;
    partes.push(
      secao(
        "Comprador",
        campos([
          ["Nome", val(c.nome)],
          ["Documento", val(c.documento)],
          ["Nascimento", fmtData(c.data_nascimento)],
          ["Estado civil", val(c.estado_civil)],
          ["Profissão", val(c.profissao)],
          ["Nacionalidade", val(c.nacionalidade)],
          ["E-mail", val(c.email)],
          ["Celular", val(c.telefone_celular)],
          ["Renda declarada", brl(c.renda_total_declarada)],
          ["Nome da mãe", val(c.nome_mae)],
          ["Banco", val(c.banco_conta)],
          [
            "Agência / Conta",
            val([c.agencia, c.conta_corrente].filter(Boolean).join(" / ") || null),
          ],
        ]),
      ),
    );
  }

  // Cônjuge
  if (data.conjuge) {
    const c = data.conjuge;
    partes.push(
      secao(
        "Cônjuge",
        campos([
          ["Nome", val(c.nome)],
          ["Documento", val(c.documento)],
          ["Nascimento", fmtData(c.data_nascimento)],
          ["Profissão", val(c.profissao)],
          ["Nacionalidade", val(c.nacionalidade)],
          ["E-mail", val(c.email)],
          ["Celular", val(c.telefone_celular)],
          ["Renda", brl(c.renda)],
          ["Nome da mãe", val(c.nome_mae)],
          ["Empresa", val(c.empresa)],
          ["Banco", val(c.banco_conta)],
          [
            "Agência / Conta",
            val([c.agencia, c.conta_corrente].filter(Boolean).join(" / ") || null),
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
              <h3 class="bloco-titulo">${escapeHtml(v.nome ?? `Vendedor ${i + 1}`)}</h3>
              ${campos([
                ["Documento", val(v.documento ?? v.cpf_cnpj)],
                ["Estado civil", val(v.estado_civil)],
                ["Profissão", val(v.profissao)],
                ["E-mail", val(v.email)],
                ["Celular", val(v.telefone_celular)],
                ["Banco", val(v.banco_conta)],
                [
                  "Agência / Conta",
                  val([v.agencia, v.conta_corrente].filter(Boolean).join(" / ") || null),
                ],
              ])}
            </div>`,
          )
          .join("");
  partes.push(
    secao(
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
              <h3 class="bloco-titulo">Imóvel ${i + 1}</h3>
              ${campos([
                ["Tipo", val(im.tipo)],
                ["Uso", val(im.uso)],
                ["Logradouro", val(im.logradouro)],
                [
                  "Cidade / UF",
                  val([im.cidade, im.uf].filter(Boolean).join(" / ") || null),
                ],
                ["Valor", brl(im.valor)],
              ])}
            </div>`,
          )
          .join("");
  partes.push(secao(data.imoveis.length > 1 ? "Imóveis" : "Imóvel", imoveisCorpo));

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Ficha — ${escapeHtml(nome)}</title>
<style>
  :root {
    --tinta: #0b0b0f;
    --suave: #4b5563;
    --linha: #e4e7ec;
    --marca: #000f9f;
    --marca-2: #000a70;
    --fundo-campo: #f7f8fa;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--tinta);
    font-size: 12px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pagina { max-width: 780px; margin: 0 auto; padding: 32px 36px 48px; }
  .cabecalho {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 20px;
    border-bottom: 3px solid var(--marca);
  }
  .marca-nome {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: .5px;
    color: var(--marca);
  }
  .marca-sub {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--suave);
    margin-top: 2px;
  }
  .doc-meta { text-align: right; font-size: 10px; color: var(--suave); }
  .titulo-doc {
    margin: 24px 0 4px;
    font-size: 22px;
    font-weight: 700;
    color: var(--marca);
  }
  .subtitulo-doc {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--suave);
    margin-bottom: 8px;
  }
  .secao { margin-top: 26px; page-break-inside: avoid; }
  .secao-titulo {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #fff;
    background: linear-gradient(90deg, var(--marca), var(--marca-2));
    padding: 8px 14px;
    border-radius: 6px;
    margin: 0 0 14px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .field {
    background: var(--fundo-campo);
    border: 1px solid var(--linha);
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
  }
  .field-label {
    font-size: 8.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .8px;
    color: var(--suave);
  }
  .field-value { font-size: 12.5px; font-weight: 600; color: var(--tinta); margin-top: 2px; word-break: break-word; }
  .bloco {
    border: 1px solid var(--linha);
    border-left: 4px solid var(--marca-2);
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .bloco-titulo { margin: 0 0 10px; font-size: 12.5px; font-weight: 700; color: var(--marca); }
  .vazio { color: var(--suave); font-style: italic; }
  .rodape {
    margin-top: 36px;
    padding-top: 12px;
    border-top: 1px solid var(--linha);
    font-size: 9px;
    color: var(--suave);
    display: flex;
    justify-content: space-between;
  }
  @media print {
    .pagina { padding: 0 12px; }
    @page { margin: 16mm 12mm; }
  }
</style>
</head>
<body>
  <div class="pagina">
    <div class="cabecalho">
      <div>
        <div class="marca-nome">Agilliza</div>
        <div class="marca-sub">Crédito Imobiliário</div>
      </div>
      <div class="doc-meta">
        Ficha consolidada do cliente<br/>
        Emitida em ${escapeHtml(agora)}
      </div>
    </div>

    <div class="subtitulo-doc">Cliente</div>
    <h1 class="titulo-doc">${escapeHtml(nome)}</h1>

    ${partes.join("")}

    <div class="rodape">
      <span>Documento gerado automaticamente pelo sistema Agilliza.</span>
      <span>${escapeHtml(nome)}</span>
    </div>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
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
