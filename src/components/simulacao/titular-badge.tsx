import { ToneBadge } from "@/components/crm/tone-badge";

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n;

/**
 * Quem está na posição de titular nesta linha de banco.
 *
 * No teste de CPF (inversão titular ⇄ cônjuge) o comparativo lista os bancos
 * das duas simulações juntos e cada banco aparece duas vezes — sem dizer de
 * quem é cada linha, parecia simulação duplicada. Só aparece quando há mais
 * de um titular no grupo.
 */
export function TitularBadge({ banco, mostrar }: { banco: any; mostrar: boolean }) {
  if (!mostrar || !banco?._titularNome) return null;
  const principal = banco._ehTitularPrincipal !== false;
  return (
    <ToneBadge tone={principal ? "muted" : "info"} className="whitespace-nowrap">
      Titular: {primeiroNome(String(banco._titularNome))}
    </ToneBadge>
  );
}

/** Há mais de um titular entre os bancos (teste de CPF em andamento)? */
export function temMaisDeUmTitular(bancos: any[]): boolean {
  return new Set(bancos.map((b) => b?._titularCpf ?? "")).size > 1;
}
