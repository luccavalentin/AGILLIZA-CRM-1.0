/**
 * Engine de conciliação bancária (server-only).
 *
 * Cruza as linhas do relatório oficial do banco contra os dados já existentes
 * em `propostas` / `proposta_bancos`, sem criar nem alterar propostas.
 * Regra de matching: nº da proposta no banco → CPF (+ nome) como fallback.
 */
import {
  normalizarNome,
  situacaoInternaDeTextoBanco,
  somenteDigitos,
  mascararCpf,
  SITUACAO_LABEL,
  type LinhaBanco,
} from "./bancos";
import type { ResultadoConciliacao } from "./tipos";

/** Tolerância de valor (R$) para não acusar divergência por centavos. */
const TOLERANCIA_VALOR = 1;

interface RegistroSistema {
  proposta_banco_id: string | null;
  proposta_id: string;
  numero_proposta: string | null;
  numero_proposta_banco: string | null;
  nome_cliente: string | null;
  cpf_digits: string;
  nome_norm: string;
  situacao: string | null;
  valor: number | null;
  created_at: string | null;
  nome_banco: string | null;
}

export interface ItemConciliado {
  numero_proposta_banco: string | null;
  nome_cliente_banco: string | null;
  cpf_banco: string | null;
  status_banco: string | null;
  valor_financiamento_banco: number | null;
  data_envio_banco: string | null;
  data_emissao_banco: string | null;
  data_assinatura_banco: string | null;
  produto_banco: string | null;
  proposta_id: string | null;
  proposta_banco_id: string | null;
  status_sistema: string | null;
  valor_financiamento_sistema: number | null;
  numero_proposta_sistema: string | null;
  resultado: ResultadoConciliacao;
  detalhe_divergencia: string | null;
}

function nomeBancoNorm(v: unknown): string {
  return normalizarNome(v)
    .replace(/\bbanco\b/g, "")
    .replace(/\bs\/?a\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Um banco do arquivo casa com o registro do sistema? (comparação tolerante) */
function mesmoBanco(alvo: string, registro: string | null): boolean {
  const a = nomeBancoNorm(alvo);
  const b = nomeBancoNorm(registro);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Executa o cruzamento. Recebe as linhas do arquivo e os registros do sistema
 * já filtrados pelo ecossistema do usuário.
 */
export function cruzar(
  bancoLabel: string,
  linhas: LinhaBanco[],
  sistema: RegistroSistema[],
  periodo: { inicio: string; fim: string },
): ItemConciliado[] {
  const doBanco = sistema.filter((r) => mesmoBanco(bancoLabel, r.nome_banco));

  const porNumero = new Map<string, RegistroSistema>();
  const porCpf = new Map<string, RegistroSistema[]>();
  for (const r of doBanco) {
    const num = somenteDigitos(r.numero_proposta_banco);
    if (num && !porNumero.has(num)) porNumero.set(num, r);
    if (r.cpf_digits) {
      const lista = porCpf.get(r.cpf_digits) ?? [];
      lista.push(r);
      porCpf.set(r.cpf_digits, lista);
    }
  }

  const usados = new Set<string>();
  const itens: ItemConciliado[] = [];

  for (const l of linhas) {
    const numArquivo = somenteDigitos(l.numeroProposta);
    const cpfArquivo = somenteDigitos(l.cpf);
    let match = numArquivo ? porNumero.get(numArquivo) : undefined;

    if (!match && cpfArquivo) {
      const candidatos = porCpf.get(cpfArquivo) ?? [];
      if (candidatos.length === 1) match = candidatos[0];
      else if (candidatos.length > 1) {
        const nome = normalizarNome(l.nomeCliente);
        match =
          candidatos.find((c) => c.nome_norm && nome && c.nome_norm === nome) ??
          candidatos.find(
            (c) =>
              c.nome_norm && nome && (c.nome_norm.includes(nome) || nome.includes(c.nome_norm)),
          ) ??
          candidatos[0];
      }
    }

    const base = {
      numero_proposta_banco: l.numeroProposta,
      nome_cliente_banco: l.nomeCliente,
      cpf_banco: mascararCpf(l.cpf),
      status_banco: l.status,
      valor_financiamento_banco: l.valorFinanciamento,
      data_envio_banco: l.dataEnvio,
      data_emissao_banco: l.dataEmissao,
      data_assinatura_banco: l.dataAssinatura,
      produto_banco: l.produto,
    };

    if (!match) {
      itens.push({
        ...base,
        proposta_id: null,
        proposta_banco_id: null,
        status_sistema: null,
        valor_financiamento_sistema: null,
        numero_proposta_sistema: null,
        resultado: "ausente_no_sistema",
        detalhe_divergencia:
          "Consta no relatório do banco e não foi localizada no sistema (nº da proposta e CPF não encontrados).",
      });
      continue;
    }

    usados.add(match.proposta_banco_id ?? match.proposta_id);

    const divergencias: string[] = [];
    const esperado = situacaoInternaDeTextoBanco(l.status);
    if (esperado && match.situacao && esperado !== match.situacao) {
      divergencias.push(
        `Status: banco "${l.status}" (${SITUACAO_LABEL[esperado] ?? esperado}) × sistema "${
          SITUACAO_LABEL[match.situacao] ?? match.situacao
        }"`,
      );
    }
    if (
      l.valorFinanciamento != null &&
      match.valor != null &&
      Math.abs(l.valorFinanciamento - match.valor) > TOLERANCIA_VALOR
    ) {
      divergencias.push(
        `Valor de financiamento: banco ${l.valorFinanciamento.toFixed(2)} × sistema ${match.valor.toFixed(2)}`,
      );
    }
    if (
      numArquivo &&
      match.numero_proposta_banco &&
      numArquivo !== somenteDigitos(match.numero_proposta_banco)
    ) {
      divergencias.push(
        `Nº da proposta no banco: arquivo ${l.numeroProposta} × sistema ${match.numero_proposta_banco}`,
      );
    }
    if (!match.numero_proposta_banco && numArquivo) {
      divergencias.push("Proposta sem nº do banco registrado no sistema.");
    }

    itens.push({
      ...base,
      proposta_id: match.proposta_id,
      proposta_banco_id: match.proposta_banco_id,
      status_sistema: match.situacao,
      valor_financiamento_sistema: match.valor,
      numero_proposta_sistema: match.numero_proposta,
      resultado: divergencias.length ? "divergente" : "conferido",
      detalhe_divergencia: divergencias.length ? divergencias.join(" · ") : null,
    });
  }

  // Ausentes no banco: propostas do período que não vieram no relatório.
  for (const r of doBanco) {
    const chave = r.proposta_banco_id ?? r.proposta_id;
    if (usados.has(chave)) continue;
    const criado = (r.created_at ?? "").slice(0, 10);
    if (!criado || criado < periodo.inicio || criado > periodo.fim) continue;
    itens.push({
      numero_proposta_banco: r.numero_proposta_banco,
      nome_cliente_banco: r.nome_cliente,
      cpf_banco: mascararCpf(r.cpf_digits),
      status_banco: null,
      valor_financiamento_banco: null,
      data_envio_banco: null,
      data_emissao_banco: null,
      data_assinatura_banco: null,
      produto_banco: null,
      proposta_id: r.proposta_id,
      proposta_banco_id: r.proposta_banco_id,
      status_sistema: r.situacao,
      valor_financiamento_sistema: r.valor,
      numero_proposta_sistema: r.numero_proposta,
      resultado: "ausente_no_banco",
      detalhe_divergencia:
        "Existe no sistema no período informado e não consta no relatório oficial do banco.",
    });
  }

  return itens;
}

export type { RegistroSistema };
