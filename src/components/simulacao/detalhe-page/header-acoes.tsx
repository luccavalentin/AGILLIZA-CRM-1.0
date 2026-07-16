import {
  ArrowLeft,
  ArrowLeftRight,
  RefreshCw,
  Copy,
  Download,
  ChevronDown,
  Pencil,
  Trash2,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { SelecionarBancosPdfDialog } from "@/components/simulacao/selecionar-bancos-pdf-dialog";

type Props = {
  s: any;
  bancos: any[];
  pdfDialogAberto: boolean;
  setPdfDialogAberto: (v: boolean) => void;
  detalhePdfAberto: boolean;
  setDetalhePdfAberto: (v: boolean) => void;
  invertendo: boolean;
  onVoltar: () => void;
  onReenviar: () => void;
  onDuplicar: () => void;
  onEditar: () => void;
  onInverterTitular: (reenviar: boolean) => void;
  onExcluir: () => Promise<void> | void;
};

export function HeaderAcoes({
  s,
  bancos,
  pdfDialogAberto,
  setPdfDialogAberto,
  detalhePdfAberto,
  setDetalhePdfAberto,
  invertendo,
  onVoltar,
  onReenviar,
  onDuplicar,
  onEditar,
  onInverterTitular,
  onExcluir,
}: Props) {
  const conjugeCompleto =
    s.possui_conjuge && s.nome_conjuge && s.cpf_conjuge && s.data_nascimento_conjuge;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-4 shadow-sm md:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onVoltar}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {s.numero_simulacao}
            </h1>
            <SimulacaoStatusBadge status={s.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {s.nome_cliente ?? "—"} ·{" "}
            {s.produto === "home_equity" ? "Home Equity" : "Financiamento"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-9" onClick={onReenviar}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Reenviar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Extrato para o cliente</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setDetalhePdfAberto(true)}
              disabled={bancos.length === 0}
            >
              Simulação detalhada (escolher banco)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setPdfDialogAberto(true)}
              disabled={bancos.length === 0}
            >
              Consolidado comparativo entre bancos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SelecionarBancosPdfDialog
          open={pdfDialogAberto}
          onOpenChange={setPdfDialogAberto}
          simulacao={s}
          bancos={bancos}
        />
        <SelecionarBancosPdfDialog
          open={detalhePdfAberto}
          onOpenChange={setDetalhePdfAberto}
          simulacao={s}
          bancos={bancos}
          modo="detalhada"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mais ações">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={onDuplicar}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEditar}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            {conjugeCompleto ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Titular ⇄ Cônjuge
                </DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={invertendo}
                  onClick={() => onInverterTitular(false)}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" /> Inverter titular
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={invertendo}
                  onClick={() => onInverterTitular(true)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Inverter e reenviar aos bancos
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <ConfirmDelete
              titulo="Excluir simulação"
              descricao={`A simulação ${s.numero_simulacao} será removida permanentemente.`}
              onConfirm={onExcluir}
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
