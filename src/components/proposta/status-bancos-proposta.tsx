import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";
import type { Tone } from "@/components/crm/tone-badge";

export interface BancoStatusItem {
  nome_banco: string | null;
  status_banco: string | null;
}

/** Mapa dos status por banco (proposta_bancos.status_banco). */
export const STATUS_BANCO: Record<string, { label: string; tone: Tone }> = {
  aguardando: { label: "Aguardando envio", tone: "muted" },
  nao_enviado: { label: "Não enviado", tone: "muted" },
  enviada: { label: "Enviada ao banco", tone: "info" },
  em_analise: { label: "Em análise de crédito", tone: "info" },
  condicionado: { label: "Aprovado com condições", tone: "warning" },
  aprovada: { label: "Crédito aprovado", tone: "success" },
  aprovado: { label: "Crédito aprovado", tone: "success" },
  recusada: { label: "Crédito recusado", tone: "danger" },
  recusado: { label: "Crédito recusado", tone: "danger" },
  erro: { label: "Erro no envio", tone: "danger" },
  cancelada: { label: "Cancelada", tone: "muted" },
};

/** Rótulo + tom para um status_banco cru. */
export function statusBancoConfig(status: string | null | undefined): { label: string; tone: Tone } {
  return STATUS_BANCO[status ?? ""] ?? { label: status ?? "—", tone: "muted" };
}

/** status_banco que indicam que a proposta já foi incluída no banco. */
const STATUS_BANCO_JA_ENVIADO = new Set([
  "enviada",
  "em_analise",
  "condicionado",
  "aprovada",
  "aprovado",
  "recusada",
  "recusado",
]);

/**
 * Um banco já foi enviado (não deve exibir o botão "Enviar") quando já tem
 * protocolo ou um status_banco de proposta ativa na integração.
 */
export function bancoJaEnviado(b: {
  status_banco?: string | null;
  numero_proposta_banco?: string | null;
}): boolean {
  // Se a última tentativa falhou, o usuário precisa poder reenviar — mesmo
  // que exista um número técnico (ex.: codigoSimulacaoBanco) na linha.
  if (String(b.status_banco ?? "") === "erro") return false;
  return (
    Boolean(b.numero_proposta_banco) ||
    STATUS_BANCO_JA_ENVIADO.has(String(b.status_banco ?? ""))
  );
}

const toneClasses: Record<Tone, string> = {
  success: "bg-success/10 text-success border-success/20",
  info: "bg-primary/10 text-primary border-primary/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  muted: "bg-muted text-muted-foreground border-border",
};

/**
 * Mostra o status de cada banco para o qual a proposta foi enviada,
 * com o nome do banco na cor da sua marca.
 */
export function StatusBancosProposta({
  bancos,
  fallbackStatus,
}: {
  bancos: BancoStatusItem[] | null | undefined;
  fallbackStatus?: string | null;
}) {
  if (!bancos || bancos.length === 0) {
    return <span className="text-xs text-muted-foreground">{fallbackStatus ?? "—"}</span>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {bancos.map((b, i) => {
        const cor = corDoBanco(b.nome_banco);
        const cfg = STATUS_BANCO[b.status_banco ?? ""] ?? {
          label: b.status_banco ?? "—",
          tone: "muted" as Tone,
        };
        return (
          <div
            key={`${b.nome_banco}-${i}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: cor }}
            >
              <BancoLogo nome={b.nome_banco} size="xs" />
              {b.nome_banco ?? "—"}
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${toneClasses[cfg.tone]}`}
            >
              {cfg.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
