import { useNavigate } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/crm/tone-badge";

export function ClienteHeader({
  cliente: c,
  docExib,
  celularExib,
}: {
  cliente: any;
  docExib: string;
  celularExib: string | null;
}) {
  const navigate = useNavigate();
  const iniciais = (c.nome ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 sm:p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary ring-1 ring-inset ring-primary/15">
            {iniciais}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                {c.nome}
              </h1>
              <StatusBadge status={c.portal_acesso_ativo ? "ativo" : "inativo"} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{c.numero_cliente}</span>
              <span className="text-border">·</span>
              <span className="font-mono text-xs">{docExib}</span>
              {celularExib && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-xs">{celularExib}</span>
                </>
              )}
              {c.uf_interesse && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-xs">{c.uf_interesse}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="default"
          className="shrink-0"
          onClick={() => {
            const ec = c.estado_civil ?? "";
            const casado = ec === "casado" || ec === "uniao_estavel";
            sessionStorage.setItem(
              "simulacao_wizard",
              JSON.stringify({
                cliente_id: c.id,
                nome_cliente: c.nome ?? "",
                cpf_cnpj: c.documento ?? "",
                data_nascimento: c.data_nascimento ?? "",
                renda_total: Number(c.renda_total_declarada) || 0,
                uf: c.uf_interesse ?? "",
                possui_conjuge: casado,
                compoe_renda: casado && Number((c as any).conjuge_renda) > 0,
                nome_conjuge: (c as any).conjuge_nome ?? "",
                cpf_conjuge: (c as any).conjuge_cpf ?? "",
                renda_conjuge: Number((c as any).conjuge_renda) || 0,
                data_nascimento_conjuge: (c as any).conjuge_data_nascimento ?? "",
                email_conjuge: (c as any).conjuge_email ?? "",
                celular_conjuge: (c as any).conjuge_celular ?? "",
              }),
            );
            navigate({ to: "/operacional/simulacoes/completa" });
          }}
        >
          <Calculator className="size-4" /> Nova simulação
        </Button>
      </div>
    </div>
  );
}
