import {
  ArrowLeft,
  ArrowLeftRight,
  CopyPlus,
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
import { usePermissao } from "@/hooks/use-permissao";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { SelecionarBancosPdfDialog } from "@/components/simulacao/selecionar-bancos-pdf-dialog";
import { ContaAssinanteDaSimulacao } from "./conta-assinante";

type Props = {
  s: any;
  bancos: any[];
  pdfDialogAberto: boolean;
  setPdfDialogAberto: (v: boolean) => void;
  detalhePdfAberto: boolean;
  setDetalhePdfAberto: (v: boolean) => void;
  invertendo: boolean;
  onVoltar: () => void;
  onDuplicar: () => void;
  onEditar: () => void;
  onInverterTitular: (reenviar: boolean) => void;
  onExcluir: () => Promise<void>;
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
  onDuplicar,
  onEditar,
  onInverterTitular,
  onExcluir,
}: Props) {
  // Mesma regra de excluirSimulacao: "edit", ou "create" para quem criou.
  const podeEditarSim = usePermissao("operacional.simulacoes", "edit");
  const podeCriarSim = usePermissao("operacional.simulacoes", "create");
  const podeExcluir = podeEditarSim || podeCriarSim;
  const conjugeCompleto =
    s.possui_conjuge && s.nome_conjuge && s.cpf_conjuge && s.data_nascimento_conjuge;
  // PDF só com algum banco cotado: com todos em erro o extrato saía vazio.
  const algumCotado = bancos.some((b) => b?.status_banco === "simulada");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-4 shadow-sm md:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onVoltar}
          aria-label="Voltar"
          title="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* O cliente é o título; o número da simulação e o ID ficam pequenos
                na linha de baixo (pedido do dono, 21/10/2026). */}
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {s.nome_cliente ?? "Simulação"}
            </h1>
            <SimulacaoStatusBadge status={s.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            <span className="tabular-nums">{s.numero_simulacao}</span> ·{" "}
            {s.produto === "home_equity" ? "Home Equity" : "Financiamento"}
            {/* ID da operação na integração bancária — escrito só "ID". */}
            {(s as any).homefin_id_oportunidade && (
              <>
                {" · "}
                <span className="font-medium tabular-nums text-foreground">
                  ID {(s as any).homefin_id_oportunidade}
                </span>
              </>
            )}
          </p>
          <ContaAssinanteDaSimulacao s={s} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Era "Reenviar": repetia o envio de todos os bancos na mesma
            oportunidade, o que não resolve banco que falhou nela. */}
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onDuplicar}
          title="Gera uma nova simulação com os mesmos dados, em oportunidade nova"
        >
          <CopyPlus className="mr-1.5 h-4 w-4" /> Nova simulação
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
            <DropdownMenuItem onClick={() => setDetalhePdfAberto(true)} disabled={!algumCotado}>
              Simulação detalhada (escolher banco)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPdfDialogAberto(true)} disabled={!algumCotado}>
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
                <DropdownMenuItem disabled={invertendo} onClick={() => onInverterTitular(false)}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" /> Inverter titular
                </DropdownMenuItem>
                <DropdownMenuItem disabled={invertendo} onClick={() => onInverterTitular(true)}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Inverter e reenviar aos bancos
                </DropdownMenuItem>
              </>
            ) : null}
            {podeExcluir && (
              <>
                <DropdownMenuSeparator />
                <ConfirmDelete
                  titulo="Excluir simulação"
                  descricao={`A simulação ${s.numero_simulacao} vai para "Excluídas", de onde pode ser restaurada.`}
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
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
