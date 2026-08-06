import { BancoChip } from "@/components/bancos/banco-chip";
import { cn } from "@/lib/utils";

export interface BancoResumoChip {
  nome_banco: string | null;
  status_banco: string | null;
  sistema_amortizacao?: string | null;
  sistema_amortizacao_banco?: string | null;
}

/**
 * Lista, de forma clara, em quais bancos a simulação foi enviada/simulada.
 * Cada banco vira um chip exibido na cor da própria marca do banco.
 */
export function BancosSimulados({
  bancos,
  className,
}: {
  bancos: BancoResumoChip[] | null | undefined;
  className?: string;
}) {
  if (!bancos || bancos.length === 0) {
    return <span className="text-xs text-muted-foreground">Nenhum banco</span>;
  }

  const grupos = agruparPorSistema(bancos);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {grupos.map((grupo) => (
        <div
          key={grupo.sistema ?? "sem-sistema"}
          className="flex flex-nowrap items-center gap-1 whitespace-nowrap"
        >
          {grupo.sistema && <SistemaTarget sistema={grupo.sistema} />}
          {grupo.bancos.map((b, i) => (
            <BancoChip key={`${grupo.sistema ?? "banco"}-${b.nome_banco}-${i}`} nome={b.nome_banco} />
          ))}
        </div>
      ))}
    </div>
  );
}

function normalizarSistema(banco: BancoResumoChip): "SAC" | "PRICE" | null {
  // O sistema requisitado na simulação é a fonte da verdade: alguns bancos
  // (ex.: Santander) devolvem o rótulo padrão "SAC" no retorno da API mesmo
  // quando a simulação foi executada em PRICE. Priorizamos o campo da
  // simulação para não confundir o usuário.
  const requisitado = String(banco.sistema_amortizacao ?? "").toUpperCase();
  if (requisitado === "P" || requisitado.includes("PRICE")) return "PRICE";
  if (requisitado === "S" || requisitado.includes("SAC")) return "SAC";
  const valor = String(banco.sistema_amortizacao_banco ?? "").toUpperCase();
  if (valor === "P" || valor.includes("PRICE")) return "PRICE";
  if (valor === "S" || valor.includes("SAC")) return "SAC";
  return null;
}

function agruparPorSistema(bancos: BancoResumoChip[]) {
  const ordem: Array<"SAC" | "PRICE" | null> = ["SAC", "PRICE", null];
  return ordem
    .map((sistema) => ({
      sistema,
      bancos: bancos.filter((b) => normalizarSistema(b) === sistema),
    }))
    .filter((grupo) => grupo.bancos.length > 0);
}

function SistemaTarget({ sistema }: { sistema: "SAC" | "PRICE" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[5px] border border-primary/25 bg-primary/[0.08] px-1.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-primary",
      )}
      title={`Tabela ${sistema}`}
      aria-label={`Tabela ${sistema}`}
    >
      {sistema}
    </span>
  );
}
