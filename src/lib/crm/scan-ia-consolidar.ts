/**
 * Scan IA — juntar vários documentos do MESMO cliente num cadastro só (C17).
 *
 * RG, comprovante de renda, de residência e certidão trazem campos repetidos (nome, CPF,
 * nascimento). Aqui se escolhe, campo a campo, o melhor valor: primeiro o que passou nas
 * regras determinísticas, depois o documento mais indicado para aquele campo (endereço do
 * comprovante de residência, renda do holerite, estado civil da certidão…), depois a maior
 * confiança. Valores diferentes entre documentos aparecem como divergência para o operador
 * decidir — nada é aplicado sem ele.
 *
 * E a montagem do que vai para o cadastro (`montarPatchCliente`), a MESMA regra do
 * "Aplicar ao cadastro" de um documento: destino e conversão de `scan-ia-tipos`, conflito com
 * o valor atual só substitui com escolha explícita, matrícula mesclada (nunca sobrescrita).
 *
 * Client-safe.
 */
import {
  converterValor,
  destinoDoCampo,
  rotuloCampo,
  valoresEquivalentes,
  type TipoDocumentoScan,
} from "./scan-ia-tipos";

export interface CampoDeDocumento {
  campo_id: string;
  leitura_id: string;
  tipo_documento: string | null;
  campo: string;
  valor: string;
  confianca: number;
  valido: boolean | null;
  motivo_validacao: string | null;
}

export interface CampoConsolidado {
  campo: string;
  rotulo: string;
  escolhido: CampoDeDocumento;
  alternativas: CampoDeDocumento[];
  divergente: boolean;
}

/** Documento mais indicado para cada campo (menor índice = melhor fonte). */
const FONTE_PREFERIDA: Record<string, TipoDocumentoScan[]> = {
  nome_completo: ["rg", "cnh", "certidao_casamento", "certidao_nascimento", "cpf"],
  cpf_cnpj: ["cpf", "cnh", "rg", "certidao_casamento"],
  data_nascimento: ["rg", "cnh", "certidao_nascimento", "certidao_casamento", "cpf"],
  nome_mae: ["rg", "cnh", "certidao_nascimento", "certidao_casamento"],
  nome_pai: ["rg", "cnh", "certidao_nascimento", "certidao_casamento"],
  estado_civil: ["certidao_casamento"],
  regime_casamento: ["certidao_casamento"],
  renda_mensal: ["comprovante_renda", "extrato_bancario"],
  profissao: ["comprovante_renda"],
  empresa: ["comprovante_renda"],
};
const PREFIXO_ENDERECO = ["comprovante_residencia", "iptu"] as const;

function prioridade(c: CampoDeDocumento): number {
  const lista: readonly string[] = c.campo.startsWith("endereco")
    ? PREFIXO_ENDERECO
    : (FONTE_PREFERIDA[c.campo] ?? []);
  const i = lista.indexOf(c.tipo_documento ?? "");
  return i < 0 ? lista.length + 1 : i;
}

function melhor(a: CampoDeDocumento, b: CampoDeDocumento): number {
  const va = a.valido === false ? 1 : 0;
  const vb = b.valido === false ? 1 : 0;
  if (va !== vb) return va - vb;
  const pa = prioridade(a);
  const pb = prioridade(b);
  if (pa !== pb) return pa - pb;
  return (b.confianca ?? 0) - (a.confianca ?? 0);
}

export function consolidarCampos(campos: CampoDeDocumento[]): CampoConsolidado[] {
  const porCampo = new Map<string, CampoDeDocumento[]>();
  for (const c of campos) {
    if (!c.valor?.trim()) continue;
    porCampo.set(c.campo, [...(porCampo.get(c.campo) ?? []), c]);
  }
  return [...porCampo.entries()]
    .map(([campo, lista]) => {
      const ordenada = [...lista].sort(melhor);
      const escolhido = ordenada[0]!;
      const divergente = ordenada.some((x) => !valoresEquivalentes(x.valor, escolhido.valor));
      return {
        campo,
        rotulo: rotuloCampo(campo),
        escolhido,
        alternativas: ordenada.slice(1),
        divergente,
      };
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

export interface DecisaoCampo {
  campo: string;
  valor: string;
  confianca: number;
  aplicar: boolean;
  escolha?: "manter" | "substituir";
}

export interface RegistroAplicacao {
  campo: string;
  rotulo: string;
  valor_documento: string;
  valor_anterior: string | null;
  confianca: number;
  conflito: boolean;
  escolha: "manter" | "substituir" | null;
  motivo?: string;
}

function textoValor(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * O que entra no cadastro, a partir das decisões do operador. Puro: quem chama grava
 * `patch` em `clientes` e `enderecoPatch` no endereço principal.
 */
export function montarPatchCliente(
  decisoes: DecisaoCampo[],
  clienteAtual: Record<string, unknown>,
  enderecoAtual: Record<string, unknown> | null,
): {
  patch: Record<string, unknown>;
  enderecoPatch: Record<string, unknown>;
  aplicados: RegistroAplicacao[];
  descartados: RegistroAplicacao[];
} {
  const patch: Record<string, unknown> = {};
  const enderecoPatch: Record<string, unknown> = {};
  const matriculaPatch: Record<string, unknown> = {};
  const aplicados: RegistroAplicacao[] = [];
  const descartados: RegistroAplicacao[] = [];
  const matriculaAtual = ((clienteAtual.imovel_matricula ?? {}) as Record<string, unknown>) || {};

  for (const dec of decisoes) {
    const valor = String(dec.valor ?? "");
    const destino = destinoDoCampo(dec.campo);
    const conv = converterValor(dec.campo, valor);
    let valorAtual: unknown = null;
    if (destino.tipo === "coluna") valorAtual = clienteAtual[destino.coluna];
    else if (destino.tipo === "endereco") valorAtual = enderecoAtual?.[destino.coluna];
    else if (destino.tipo === "matricula") valorAtual = matriculaAtual[destino.chave];
    const temAtual = valorAtual !== null && valorAtual !== undefined && valorAtual !== "";
    const novoTexto = conv.ok ? textoValor(conv.valor) : null;
    const conflito =
      temAtual && !!novoTexto && !valoresEquivalentes(textoValor(valorAtual), novoTexto);
    const registro: RegistroAplicacao = {
      campo: dec.campo,
      rotulo: rotuloCampo(dec.campo),
      valor_documento: valor,
      valor_anterior: textoValor(valorAtual),
      confianca: Number(dec.confianca ?? 0),
      conflito,
      escolha: dec.escolha ?? null,
    };
    if (!dec.aplicar || !conv.ok) {
      descartados.push({ ...registro, motivo: conv.ok ? "nao_marcado" : conv.motivo });
      continue;
    }
    if (conflito && dec.escolha !== "substituir") {
      descartados.push({ ...registro, motivo: "conflito_mantido" });
      continue;
    }
    if (destino.tipo === "coluna") patch[destino.coluna] = conv.valor;
    else if (destino.tipo === "endereco") enderecoPatch[destino.coluna] = conv.valor;
    else if (destino.tipo === "matricula") matriculaPatch[destino.chave] = conv.valor;
    else {
      descartados.push({ ...registro, motivo: "sem_destino" });
      continue;
    }
    aplicados.push(registro);
  }
  if (Object.keys(matriculaPatch).length > 0) {
    patch.imovel_matricula = { ...matriculaAtual, ...matriculaPatch };
  }
  return { patch, enderecoPatch, aplicados, descartados };
}
