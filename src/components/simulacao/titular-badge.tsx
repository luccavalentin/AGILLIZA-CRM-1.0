import { ToneBadge } from "@/components/crm/tone-badge";

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n;

/**
 * De quem é esta linha de banco no comparativo de CPFs.
 *
 * Com "Comparar CPFs" o comparativo lista os bancos das duas simulações juntos
 * e cada banco aparece duas vezes. A linha da simulação feita com o cônjuge na
 * posição de titular diz "Cônjuge": chamá-la de "Titular" fazia parecer que o
 * titular da operação era ele. Só aparece quando há mais de um no grupo.
 */
export function TitularBadge({ banco, mostrar }: { banco: any; mostrar: boolean }) {
  if (!mostrar || !banco?._titularNome) return null;
  const principal = banco._ehTitularPrincipal !== false;
  return (
    <ToneBadge tone={principal ? "muted" : "info"} className="whitespace-nowrap">
      {banco._titularVinculo ?? (principal ? "Titular" : "CPF testado")}:{" "}
      {primeiroNome(String(banco._titularNome))}
    </ToneBadge>
  );
}

/** Há mais de um titular entre os bancos (teste de CPF em andamento)? */
export function temMaisDeUmTitular(bancos: any[]): boolean {
  return new Set(bancos.map((b) => b?._titularCpf ?? "")).size > 1;
}
