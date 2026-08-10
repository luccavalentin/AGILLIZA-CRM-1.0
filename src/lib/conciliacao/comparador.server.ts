/**
 * Cruzamento das planilhas comparadas contra as propostas do sistema
 * (server-only). Recebe apenas chaves e devolve o registro correspondente,
 * sem expor CPF completo.
 */
import { normalizarNome, somenteDigitos } from "./bancos";
import { carregarSistema } from "./executar.server";

export interface ChaveConsulta {
  chave: string;
  numero: string | null;
  cpf: string | null;
  nome: string | null;
}

export interface SistemaResumoServer {
  proposta_id: string | null;
  numero_proposta: string | null;
  numero_proposta_banco: string | null;
  nome_cliente: string | null;
  situacao: string | null;
  valor: number | null;
  nome_banco: string | null;
}

export async function cruzarComSistemaImpl(
  supabase: any,
  chaves: ChaveConsulta[],
): Promise<Record<string, SistemaResumoServer>> {
  const sistema = await carregarSistema(supabase);

  const porNumeroBanco = new Map<string, (typeof sistema)[number]>();
  const porNumeroInterno = new Map<string, (typeof sistema)[number]>();
  const porCpf = new Map<string, (typeof sistema)[number][]>();

  for (const r of sistema) {
    const nb = somenteDigitos(r.numero_proposta_banco);
    if (nb && !porNumeroBanco.has(nb)) porNumeroBanco.set(nb, r);
    const ni = somenteDigitos(r.numero_proposta);
    if (ni && !porNumeroInterno.has(ni)) porNumeroInterno.set(ni, r);
    if (r.cpf_digits) {
      const l = porCpf.get(r.cpf_digits) ?? [];
      l.push(r);
      porCpf.set(r.cpf_digits, l);
    }
  }

  const saida: Record<string, SistemaResumoServer> = {};
  for (const c of chaves) {
    let m =
      (c.numero && (porNumeroBanco.get(c.numero) ?? porNumeroInterno.get(c.numero))) || undefined;
    if (!m && c.cpf) {
      const cand = porCpf.get(c.cpf) ?? [];
      const nome = normalizarNome(c.nome);
      m = cand.find((x) => x.nome_norm && nome && x.nome_norm === nome) ?? cand[0] ?? undefined;
    }
    if (!m) continue;
    saida[c.chave] = {
      proposta_id: m.proposta_id ?? null,
      numero_proposta: m.numero_proposta ?? null,
      numero_proposta_banco: m.numero_proposta_banco ?? null,
      nome_cliente: m.nome_cliente ?? null,
      situacao: m.situacao ?? null,
      valor: m.valor ?? null,
      nome_banco: m.nome_banco ?? null,
    };
  }
  return saida;
}
