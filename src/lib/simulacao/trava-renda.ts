/**
 * Trava de renda (pedido do dono, 26/10/2026).
 *
 * A simulação ia ao banco com renda abaixo da necessária para SAC e PRICE e
 * voltava erro. Aqui a renda que VAI AO BANCO (a mesma soma de
 * `enviar.server.ts`: titular + cônjuge que compõe + participantes que compõem)
 * é comparada com a renda mínima de cada sistema — a mesma "Estimativa
 * Agilliza" que a tela mostra e usa no botão "Preencher renda necessária"
 * (`avaliarRendaMinima`: 1ª parcela + MIP + DFI + taxa, sobre o teto de
 * comprometimento SAC 30% / PRICE 15%, com a margem de segurança).
 *
 * Módulo puro: roda na tela (antes de enviar) e no servidor (antes de chamar a
 * integração bancária) — nunca confiar só na tela.
 */
import { rendaConjugeOuPadrao } from "@/lib/crm/padroes-cadastro";
import { ehCasado } from "./prazo";
import { avaliarRendaMinima } from "./renda";

/** Taxa de referência das estimativas (`melhorTaxaAno` da simulação completa). */
export const TAXA_REFERENCIA_ANO = 0.1199;

export type SistemaTrava = "S" | "P";

export interface RendaDoSistema {
  sistema: SistemaTrava;
  prazo: number;
  /** Renda que vai ao banco neste sistema. */
  renda: number;
  /** Renda mínima estimada para o financiamento, o prazo e o sistema. */
  minima: number;
  /** 1ª parcela estimada com os encargos (MIP, DFI e taxa). */
  primeiraParcela: number;
  suficiente: boolean;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const nomeSistema = (s: SistemaTrava) => (s === "P" ? "PRICE" : "SAC");

/** Dados mínimos da simulação (formulário ou linha gravada) para somar a renda. */
export interface FonteRenda {
  renda_total?: number | string | null;
  estado_civil?: string | null;
  nome_conjuge?: string | null;
  cpf_conjuge?: string | null;
  compoe_renda_conjuge?: boolean | null;
  renda_conjuge?: number | string | null;
  participantes?: Array<{ compoe_renda?: boolean | null; renda?: number | string | null }> | null;
}

/**
 * Renda que vai ao banco, igual ao `rendaTotal` de `enviar.server.ts`: cônjuge
 * só quando existe de fato (casado/união estável e identificado) e compõe; a
 * renda dele vazia vira o padrão do cadastro; participantes só os que compõem.
 * `rendaTitular` substitui a renda do titular (renda PRICE do modo "Ambos").
 */
export function rendaEnviadaAoBanco(f: FonteRenda, rendaTitular?: number | string | null): number {
  const titular = num(rendaTitular ?? f.renda_total);
  const conjugeIdentificado =
    String(f.nome_conjuge ?? "").trim() !== "" ||
    String(f.cpf_conjuge ?? "").replace(/\D/g, "") !== "";
  const compoeConjuge =
    ehCasado(f.estado_civil) && conjugeIdentificado && Boolean(f.compoe_renda_conjuge);
  const conjuge = compoeConjuge ? rendaConjugeOuPadrao(f.renda_conjuge) : 0;
  const terceiros = (f.participantes ?? [])
    .filter((p) => p?.compoe_renda)
    .reduce((acc, p) => acc + num(p.renda), 0);
  return Math.round((titular + conjuge + terceiros) * 100) / 100;
}

/** Renda x mínima por sistema e prazo. */
export function avaliarTravaRenda(o: {
  sistemas: Array<{ sistema: SistemaTrava; renda: number }>;
  prazos: Array<number | string | null | undefined>;
  valor_financiamento: number | string | null | undefined;
  valor_imovel?: number | string | null;
  taxa_ano?: number;
  pj?: boolean;
}): RendaDoSistema[] {
  const fin = num(o.valor_financiamento);
  if (o.pj || !(fin > 0)) return [];
  const prazos = Array.from(new Set(o.prazos.map(num).filter((p) => p > 0)));
  const out: RendaDoSistema[] = [];
  for (const { sistema, renda } of o.sistemas) {
    for (const prazo of prazos) {
      const aval = avaliarRendaMinima({
        valor_financiamento: fin,
        valor_imovel: num(o.valor_imovel) || null,
        prazo_meses: prazo,
        taxa_ano: o.taxa_ano ?? TAXA_REFERENCIA_ANO,
        sistema,
      });
      if (!aval) continue;
      out.push({
        sistema,
        prazo,
        renda,
        minima: aval.rendaMinima,
        primeiraParcela: Math.round(aval.primeiraParcela * 100) / 100,
        suficiente: renda >= aval.rendaMinima,
      });
    }
  }
  return out;
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * A mensagem da trava, ou `null` quando a renda cobre tudo. Quando só um
 * sistema não cabe, diz que o outro pode seguir sozinho.
 */
export function mensagemRendaInsuficiente(avaliacao: RendaDoSistema[]): string | null {
  const faltam = avaliacao.filter((a) => !a.suficiente);
  if (faltam.length === 0) return null;
  const variosPrazos = new Set(avaliacao.map((a) => a.prazo)).size > 1;
  const pior = new Map<SistemaTrava, RendaDoSistema>();
  for (const a of faltam) {
    const atual = pior.get(a.sistema);
    if (!atual || a.minima > atual.minima) pior.set(a.sistema, a);
  }
  const lista = (["S", "P"] as SistemaTrava[]).filter((s) => pior.has(s)).map((s) => pior.get(s)!);
  const mesmaRenda = new Set(lista.map((a) => a.renda)).size === 1;
  const emPrazo = (a: RendaDoSistema) => (variosPrazos ? ` em ${a.prazo} meses` : "");
  const inicio = mesmaRenda
    ? `A renda informada (${brl(lista[0]!.renda)}) está abaixo da mínima para ${lista
        .map((a) => `${nomeSistema(a.sistema)}${emPrazo(a)} (${brl(a.minima)})`)
        .join(" / ")}.`
    : lista
        .map(
          (a) =>
            `A renda informada para ${nomeSistema(a.sistema)} (${brl(a.renda)}) está abaixo da mínima${emPrazo(a)} (${brl(a.minima)}).`,
        )
        .join(" ");
  const ok = Array.from(new Set(avaliacao.map((a) => a.sistema))).filter((s) => !pior.has(s));
  const outro =
    ok.length > 0
      ? ` A renda cobre o ${ok.map(nomeSistema).join(" e o ")}: tire os bancos ${lista
          .map((a) => nomeSistema(a.sistema))
          .join(" e ")} para enviar só ${ok.map(nomeSistema).join(" e ")}.`
      : "";
  return `${inicio} Aumente a renda (some a de um segundo proponente), aumente a entrada ou o prazo.${outro}`;
}

/** Formulário da simulação completa (os campos que a trava lê). */
export interface FormTrava extends FonteRenda {
  tipo_pessoa?: string | null;
  sistema_amortizacao?: string | null;
  renda_price?: number | string | null;
  valor_financiamento?: number | string | null;
  valor_imovel?: number | string | null;
  prazo?: number | string | null;
  prazo_2?: number | string | null;
  bancos_ids?: string[] | null;
  bancos_sac_ids?: string[] | null;
  bancos_price_ids?: string[] | null;
}

/**
 * Trava sobre o formulário: no modo "Ambos", SAC com `renda_total` e PRICE com
 * `renda_price`, só os sistemas com banco escolhido; no modo simples, o
 * sistema escolhido. Devolve a avaliação, a mensagem e o campo a destacar.
 */
export function travaRendaDoFormulario(f: FormTrava): {
  avaliacao: RendaDoSistema[];
  mensagem: string | null;
  campo: "renda_total" | "renda_price" | null;
} {
  const ambos = f.sistema_amortizacao === "B";
  const sistemas: Array<{ sistema: SistemaTrava; renda: number }> = [];
  if (ambos) {
    if ((f.bancos_sac_ids?.length ?? 0) > 0)
      sistemas.push({ sistema: "S", renda: rendaEnviadaAoBanco(f) });
    if ((f.bancos_price_ids?.length ?? 0) > 0)
      sistemas.push({ sistema: "P", renda: rendaEnviadaAoBanco(f, f.renda_price) });
  } else {
    sistemas.push({
      sistema: f.sistema_amortizacao === "P" ? "P" : "S",
      renda: rendaEnviadaAoBanco(f),
    });
  }
  // Renda vazia já é pendência de campo obrigatório; a trava confere o valor.
  if (sistemas.some((s) => !(s.renda > 0))) return { avaliacao: [], mensagem: null, campo: null };
  const avaliacao = avaliarTravaRenda({
    sistemas,
    prazos: [f.prazo, f.prazo_2],
    valor_financiamento: f.valor_financiamento,
    valor_imovel: f.valor_imovel,
    pj: f.tipo_pessoa === "PJ",
  });
  const mensagem = mensagemRendaInsuficiente(avaliacao);
  const priceFalta = avaliacao.some((a) => a.sistema === "P" && !a.suficiente);
  const sacFalta = avaliacao.some((a) => a.sistema === "S" && !a.suficiente);
  return {
    avaliacao,
    mensagem,
    campo: !mensagem ? null : ambos && priceFalta && !sacFalta ? "renda_price" : "renda_total",
  };
}

/**
 * Trava sobre a simulação GRAVADA (rede de segurança do servidor): cada
 * simulação tem um sistema ("S"/"P") e a sua `renda_total` (no "Ambos" a
 * simulação PRICE nasce com a renda PRICE).
 */
export function travaRendaDaSimulacao(
  sim: FonteRenda & {
    tipo_pessoa?: string | null;
    sistema_amortizacao?: string | null;
    valor_financiamento?: number | string | null;
    valor_imovel?: number | string | null;
    prazo?: number | string | null;
  },
): string | null {
  const sistema: SistemaTrava = sim.sistema_amortizacao === "P" ? "P" : "S";
  const renda = rendaEnviadaAoBanco(sim);
  if (!(renda > 0)) return null;
  return mensagemRendaInsuficiente(
    avaliarTravaRenda({
      sistemas: [{ sistema, renda }],
      prazos: [sim.prazo],
      valor_financiamento: sim.valor_financiamento,
      valor_imovel: sim.valor_imovel,
      pj: sim.tipo_pessoa === "PJ",
    }),
  );
}
