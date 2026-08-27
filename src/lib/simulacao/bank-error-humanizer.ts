/**
 * Traduz códigos/mensagens de erro do provedor de integração bancária
 * para mensagens em português claras, dizendo AO USUÁRIO o que corrigir.
 * Módulo puro — pode ser importado no cliente e no servidor.
 */

const MAPA: Record<string, string> = {
  RENDA_INSUFICIENTE: "Renda declarada insuficiente para o valor solicitado.",
  DOC_INVALIDO: "Documento do cliente inválido ou não reconhecido pelo banco.",
  LIMITE_EXCEDIDO:
    "O valor informado não foi aceito pela regra de crédito do banco. Consulte os detalhes do retorno e revise os dados da operação.",
  IDADE_MAX_EXCEDIDA: "Idade do cliente excede o limite permitido pelo banco no fim do contrato.",
  PRAZO_INVALIDO: "Prazo solicitado fora da faixa aceita pelo banco.",
  IMOVEL_NAO_ELEGIVEL: "Tipo ou situação do imóvel não é elegível para este banco.",
  UF_NAO_ATENDIDA: "O banco não atende financiamentos nesta UF.",
  TIMEOUT: "O banco não respondeu no tempo esperado. Tente reenviar.",
};

/** Códigos de recusa devolvidos pelo Bradesco dentro de INT-006. */
const BRADESCO: Record<string, string> = {
  "119": "Renda informada abaixo da renda mínima exigida pelo banco.",
  "121-L":
    "Bradesco: a operação não passou nas regras de crédito do banco (limite/valor x renda x prazo). Ajuste valor financiado, entrada ou prazo e reenvie.",
  "014": "Prazo informado acima do máximo permitido pelo Bradesco para esta operação. Reduza o prazo e reenvie.",
  "422": "Prazo informado abaixo do mínimo aceito pelo Bradesco para esta operação. Aumente o prazo e reenvie.",
};

const CAMPOS_PT: Record<string, string> = {
  financingAmount: "Valor do financiamento",
  propertyValue: "Valor do imóvel",
  term: "Prazo",
  income: "Renda",
  birthDate: "Data de nascimento",
  downPayment: "Entrada",
};

function moeda(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/**
 * Recebe o corpo JSON de erro da integração e devolve uma mensagem clara.
 * Trata os formatos conhecidos:
 *  - { error: { code: "INT-SANTANDER-RANGE", context: { field, min, max, valueProvided } } }
 *  - { error: { code: "INT-006", message: 'Simulação Bradesco falhou: {"codigo":"119",...}' } }
 *  - { error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" } }
 */
export function humanizarRespostaErro(json: unknown, status: number, endpoint = ""): string {
  const err = ((json as any)?.error ?? json ?? {}) as Record<string, any>;
  const code = String(err?.code ?? err?.codigo ?? "");
  const ctx = (err?.context ?? {}) as Record<string, any>;

  // Faixa de valores fora do permitido (Santander e similares)
  if (ctx && (ctx.min != null || ctx.max != null) && ctx.field) {
    const campo = CAMPOS_PT[String(ctx.field)] ?? String(ctx.field);
    const banco = ctx.bank
      ? String(ctx.bank).replace(/^\w/, (c: string) => c.toUpperCase())
      : "O banco";
    const ehValor = /amount|value|payment/i.test(String(ctx.field));
    const fmt = ehValor ? moeda : (v: unknown) => String(v);
    return `${banco}: ${campo} de ${fmt(ctx.valueProvided)} está fora do intervalo aceito (mínimo ${fmt(
      ctx.min,
    )} e máximo ${fmt(ctx.max)}). Ajuste o valor e reenvie.`;
  }

  const bruta = String(err?.message ?? err?.mensagem ?? err?.msg ?? err?.detail ?? "");

  // Recusa do Bradesco embutida em JSON dentro da mensagem
  const aninhado = bruta.match(/\{[\s\S]*\}/);
  if (aninhado) {
    try {
      const interno = JSON.parse(aninhado[0]) as Record<string, any>;
      const cod = String(interno.codigo ?? interno.code ?? "");
      const msgInternaBruta = String(interno.mensagem ?? interno.message ?? "").trim();
      
      // Regra geral: se o banco trouxe mensagem própria legível, usar ela.
      // Prioridade para códigos conhecidos que precisam de tradução específica.
      
      const limiteMaxMatch = msgInternaBruta.match(/maximo de (\d+)/i);
      const limiteMinMatch = msgInternaBruta.match(/superior a[:\s]+(\d+)/i) || msgInternaBruta.match(/mínimo aceito[^:]*[:\s]+(\d+)/i);

      // Mapeamento antecipado para evitar que o MAPA ou BRADESCO estático ignore a extração dinâmica
      if (cod === "014") {
        const enviadoMatch = msgInternaBruta.match(/informado de (\d+)/i);
        const maxVal = limiteMaxMatch ? limiteMaxMatch[1] : "Y";
        const enviado = enviadoMatch ? enviadoMatch[1] : (ctx.valueProvided ?? "X");
        return `Prazo de ${enviado} meses acima do máximo permitido pelo Bradesco nesta operação: ${maxVal} meses. Reduza o prazo e reenvie.`;
      }
      
      if (cod === "422") {
        const enviadoMatch = msgInternaBruta.match(/informado de (\d+)/i);
        const minVal = limiteMinMatch ? limiteMinMatch[1] : "Y";
        const enviado = enviadoMatch ? enviadoMatch[1] : (ctx.valueProvided ?? "X");
        return `Prazo informado abaixo do mínimo aceito pelo Bradesco nesta operação: ${minVal} meses. Aumente o prazo e reenvie.`;
      }

      if (BRADESCO[cod]) {
        if (cod === "119") {
          return "Renda informada abaixo da renda mínima exigida pelo banco.";
        }
        return BRADESCO[cod];
      }
      
      if (cod === "121-L" || (cod === "0" && !msgInternaBruta)) {
        return `O banco recusou a simulação (código ${cod}) sem informar o motivo. Normalmente é relação valor x renda x prazo — revise esses campos e reenvie.`;
      }
      
      if (msgInternaBruta && !/erro interno|internal error|internal_error|dados cadastrais/i.test(msgInternaBruta)) {
        return msgInternaBruta;
      }
      
      if (cod) {
        return `O banco recusou a simulação (código ${cod}) sem detalhar o motivo. Normalmente é relação valor x renda x prazo — revise esses campos e reenvie.`;
      }
    } catch {
      /* ignora */
    }
  }

  if (/undefined\s*$/i.test(bruta) && /INT-006/i.test(code)) {
    return "O banco não devolveu o motivo da recusa. Em geral é relação valor financiado x renda x prazo. Revise esses campos e reenvie.";
  }

  // Prazo fora da faixa aceita pelo banco: a API devolve o limite exato.
  // Não presumimos um mínimo fixo — usamos o número informado pelo banco.
  const prazoMin = bruta.match(/prazo\s+de\s+pagamento\s+igual\s+ou\s+superior\s+a[:\s]+(\d+)/i);
  if (prazoMin) {
    const meses = Number(prazoMin[1]);
    return `Prazo abaixo do mínimo aceito por este banco nesta operação: ${meses} meses (${(meses / 12).toFixed(0)} anos). Aumente o prazo para ${meses} meses ou mais e reenvie. O prazo máximo continua limitado pela idade do proponente mais velho.`;
  }
  const prazoMax = bruta.match(/prazo\s+de\s+pagamento\s+igual\s+ou\s+inferior\s+a[:\s]+(\d+)/i);
  if (prazoMax) {
    const meses = Number(prazoMax[1]);
    return `Prazo acima do máximo aceito por este banco nesta operação: ${meses} meses (${(meses / 12).toFixed(0)} anos). Reduza o prazo para ${meses} meses ou menos e reenvie.`;
  }

  // Sessão com o banco expirada — não é erro de preenchimento.
  if (status === 401 || /token\s*jwt\s*expirado|unauthorized/i.test(bruta)) {
    return "A sessão com o banco expirou durante o envio. Nenhum dado foi perdido — clique em reenviar/atualizar status para concluir.";
  }

  // 5xx é falha DO provedor, não dos dados enviados. Mandar o usuário
  // conferir campos aqui é enganoso: ele caça um problema que não existe no
  // cadastro dele. O caminho certo é reenviar — e, na prática, o mesmo
  // payload costuma passar na tentativa seguinte.
  if (code === "INTERNAL_ERROR" || status >= 500) {
    const etapa = /participante/i.test(endpoint)
      ? "ao enviar o proponente"
      : /\/simulacao/i.test(endpoint)
        ? "ao simular"
        : /\/oportunidade\/?$/i.test(endpoint)
          ? "ao abrir a oportunidade"
          : "durante o envio";
    return `A integração bancária falhou ${etapa} (erro ${status || 500} no provedor). Não é problema no cadastro — os dados enviados estão íntegros. Reenvie em alguns instantes; se persistir por mais de alguns minutos, o provedor está instável.`;
  }

  if (MAPA[code]) return MAPA[code];
  const limpa = bruta
    .replace(/^Simula[cç][aã]o\s+\S+\s+falhou:\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (limpa) return limpa;
  if (status === 404 && endpoint.includes("//simulacao")) {
    return "Falha técnica na montagem da simulação (ID da oportunidade ausente). Por favor, tente reenviar para gerar um novo ID.";
  }
  if (bruta.includes("ID da oportunidade está ausente") || bruta.includes("ID da oportunidade ausente")) {
    return "Não foi possível iniciar a simulação porque o ID da oportunidade não foi gerado corretamente. Tente reenviar.";
  }
  return `A integração bancária retornou um erro (${status}). Revise os dados e tente reenviar.`;
}

export function humanizarErroBanco(codigo?: string | null, mensagem?: string | null): string {
  if (codigo && MAPA[codigo]) return MAPA[codigo];
  if (codigo && BRADESCO[codigo]) return BRADESCO[codigo];
  if (mensagem && mensagem.trim().length > 0) return mensagem.trim();
  return "Não foi possível concluir a simulação neste banco.";
}
