import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
  Pencil,
  RefreshCw,
  Send,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  designarPropostaAssinante,
  listarAnalistasDaFila,
  pedirCorrecaoAoAssinante,
  ROTULO_PROPOSTA_ASSINANTE,
} from "@/lib/plataforma/fila.functions";
import { PropostaStatusBadge } from "@/components/propostas/status-badge";
import { statusProposta } from "@/components/propostas/status";
import { AGUARDANDO_ENVIO, invalidarFila, useAcoesAssinante, type PropostaParaAcao } from "./hooks";

const ALTO = "h-11 md:h-9";

/**
 * Situação do Corretor → situação do Agilliza: a fila mostra o mesmo selo (texto e cor) das
 * propostas do Agilliza (pedido do dono, 21/10/2026: "igual aparece as da Agilliza").
 */
const STATUS_NO_AGILLIZA: Record<string, string> = {
  aguardando_correspondente: "aguardando_envio",
  em_envio: "aguardando_envio",
  enviada: "enviada_banco",
  em_analise: "em_analise_credito",
  aguardando_documentos: "aguardando_documentos",
  condicionada: "credito_condicionado",
  aprovada: "credito_aprovado",
  recusada: "credito_recusado",
  erro_envio: "erro_envio",
  formularios: "formularios",
  engenharia_vistoria: "engenharia_vistoria",
  analise_juridica: "analise_juridica",
  contrato: "contrato_emitido",
  registrado: "registrado",
  cancelada: "cancelada",
};

/** Rótulo da situação como o Agilliza escreve. */
export function rotuloSituacao(status: string, banco?: string | null) {
  const s = STATUS_NO_AGILLIZA[status];
  return s ? statusProposta(s, banco).label : (ROTULO_PROPOSTA_ASSINANTE[status] ?? status);
}

/** Selo da situação da proposta do assinante, no padrão das propostas do Agilliza. */
export function SeloSituacao({
  status,
  atrasada,
  banco,
}: {
  status: string;
  atrasada?: boolean | null;
  banco?: string | null;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <PropostaStatusBadge status={STATUS_NO_AGILLIZA[status] ?? status} banco={banco} />
      {/* O prazo é do correspondente até o envio; depois quem responde é o banco. */}
      {atrasada && AGUARDANDO_ENVIO.includes(status) && (
        <Badge variant="destructive">Prazo estourado</Badge>
      )}
    </span>
  );
}

/**
 * Ações na LINHA da fila: abrir a proposta (onde ficam a simulação do assinante e o envio)
 * e designar. Enviar sem ver os dados não é caminho.
 */
export function AcoesLinha({
  proposta: p,
  onAbrir,
  onDesignar,
  cheio,
  className,
}: {
  proposta: PropostaParaAcao;
  onAbrir: () => void;
  onDesignar: () => void;
  cheio?: boolean;
  className?: string;
}) {
  const podeAgir = usePermissao("saas.fila", "edit");
  const aguardando =
    AGUARDANDO_ENVIO.includes(p.status) && !p.proposta_agilliza_id && (p.pendente || p.minha);
  const destaque = aguardando && podeAgir;
  return (
    <div
      className={cn("flex items-center gap-2", cheio && "w-full flex-col sm:flex-row", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        className={cn(ALTO, cheio && "w-full sm:flex-1")}
        variant={destaque ? "default" : "outline"}
        onClick={onAbrir}
      >
        {destaque ? "Ver e enviar" : "Ver proposta"}
        <ChevronRight className="ml-1 size-4" />
      </Button>
      {podeAgir && (
        <Button
          variant="ghost"
          className={cn(ALTO, "text-muted-foreground", cheio && "w-full sm:w-auto")}
          onClick={onDesignar}
        >
          <UserCog className="mr-1.5 size-4" /> Designar
        </Button>
      )}
    </div>
  );
}

/**
 * Ações no PAINEL da proposta, ao lado da simulação que o assinante fez:
 * - "Enviar para aprovação" (principal): banco escolhido, pelo envio de sempre do Agilliza;
 * - "Nova simulação", "Editar dados", "Devolver" (ao assinante) e "Designar";
 * - já enviada pelo Agilliza: "Acompanhar no Agilliza".
 */
export function AcoesPainel({
  proposta: p,
  onDesignar,
  onDevolver,
}: {
  proposta: PropostaParaAcao;
  onDesignar: () => void;
  onDevolver: () => void;
}) {
  const podeAgir = usePermissao("saas.fila", "edit");
  const a = useAcoesAssinante(p);
  const ocupado = a.executando !== null;
  const aguardando = AGUARDANDO_ENVIO.includes(p.status);
  const minhaOuLivre = p.pendente || p.minha;
  const icone = (acao: string, Icone: typeof Send) =>
    a.executando === acao ? (
      <Loader2 className="mr-1.5 size-4 animate-spin" />
    ) : (
      <Icone className="mr-1.5 size-4" />
    );

  if (p.proposta_agilliza_id) {
    return (
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button className={cn(ALTO, "w-full sm:flex-1")} onClick={a.acompanhar}>
          <ExternalLink className="mr-1.5 size-4" /> Acompanhar no Agilliza
        </Button>
        {podeAgir && (
          <Button variant="ghost" className={cn(ALTO, "w-full sm:w-auto")} onClick={onDesignar}>
            <UserCog className="mr-1.5 size-4" /> Designar
          </Button>
        )}
      </div>
    );
  }
  if (!podeAgir) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Você pode ver esta proposta. Para enviar, peça a permissão &quot;Assumir e designar&quot; da
        Fila de propostas dos assinantes em Pessoas › Papéis &amp; Permissões.
      </p>
    );
  }
  if (!minhaOuLivre || !aguardando) {
    return (
      <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {!minhaOuLivre
            ? `Com ${p.analista ?? "outro analista"}.`
            : `Situação: ${ROTULO_PROPOSTA_ASSINANTE[p.status] ?? p.status}.`}
        </span>
        <Button variant="outline" className={cn(ALTO, "w-full sm:w-auto")} onClick={onDesignar}>
          <UserCog className="mr-1.5 size-4" /> Designar
        </Button>
      </div>
    );
  }
  // Uma ação principal, compacta, à direita; as demais em botões leves de 13 px à
  // esquerda (pedido do dono, 21/10/2026: "botão grosseiro"). No celular a principal
  // vem primeiro, na largura toda, e as outras em 2 × 2 com alvo de 44 px.
  const secundario =
    "h-11 justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground md:h-8 md:px-2.5";
  const fino = (acao: string, Icone: typeof Send) =>
    a.executando === acao ? (
      <Loader2 className="size-[15px] animate-spin" />
    ) : (
      <Icone className="size-[15px]" strokeWidth={1.75} />
    );
  return (
    <div className="flex w-full flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="grid grid-cols-2 gap-1.5 md:flex md:flex-wrap md:gap-0.5">
        <Button
          variant="ghost"
          className={secundario}
          onClick={a.gerarNovaSimulacao}
          disabled={ocupado}
          title="Refaz a simulação com os mesmos dados; dá para ajustar valores e bancos antes"
        >
          {fino("nova", RefreshCw)} Nova simulação
        </Button>
        <Button variant="ghost" className={secundario} onClick={a.editarDados} disabled={ocupado}>
          {fino("editar", Pencil)} Editar dados
        </Button>
        <Button
          variant="ghost"
          className={secundario}
          onClick={onDevolver}
          disabled={ocupado}
          title="Devolver ao assinante pedindo correção"
        >
          <MessageSquareWarning className="size-[15px]" strokeWidth={1.75} /> Devolver
        </Button>
        <Button variant="ghost" className={secundario} onClick={onDesignar} disabled={ocupado}>
          <UserCog className="size-[15px]" strokeWidth={1.75} /> Designar
        </Button>
      </div>
      <Button
        className="h-11 w-full gap-2 rounded-lg px-4 text-sm font-medium shadow-sm md:h-9 md:w-auto"
        onClick={a.enviarParaAprovacao}
        disabled={ocupado}
      >
        {fino("enviar", Send)}
        Enviar para aprovação{p.banco ? ` · ${p.banco}` : ""}
      </Button>
    </div>
  );
}

/** "Devolver ao assinante": pede a correção registrando uma exigência na proposta. */
export function DevolverDialog({
  proposta,
  onFechar,
}: {
  proposta: PropostaParaAcao | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const pedirFn = useServerFn(pedirCorrecaoAoAssinante);
  const [texto, setTexto] = useState("");
  const fechar = () => {
    setTexto("");
    onFechar();
  };
  const pedir = useMutation({
    mutationFn: () =>
      pedirFn({ data: { id: proposta!.id, assumir: proposta!.pendente, descricao: texto } }),
    onSuccess: () => {
      toast.success(`Pedido de correção enviado a ${proposta?.conta}.`);
      invalidarFila(qc);
      fechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível devolver ao assinante.")),
  });
  return (
    <Dialog open={!!proposta} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Devolver ao assinante — {proposta?.codigo}</DialogTitle>
          <DialogDescription>
            {proposta?.conta} recebe o pedido na proposta (como exigência) e é avisado na hora.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="O que precisa ser corrigido"
          rows={4}
          placeholder="Ex.: falta o comprovante de renda do cônjuge."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="h-11 sm:h-9" onClick={fechar}>
            Cancelar
          </Button>
          <Button
            className="h-11 sm:h-9"
            onClick={() => pedir.mutate()}
            disabled={pedir.isPending || texto.trim().length < 5}
          >
            Devolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Designa (ou devolve à fila) com motivo registrado. Analistas carregados ao abrir. */
export function DesignarDialog({
  proposta,
  onFechar,
}: {
  proposta: PropostaParaAcao | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const designarFn = useServerFn(designarPropostaAssinante);
  const analistasFn = useServerFn(listarAnalistasDaFila);
  const analistas = useQuery({
    queryKey: ["plataforma-fila", "analistas"],
    queryFn: () => analistasFn(),
    enabled: !!proposta,
    staleTime: 5 * 60_000,
  });
  const [analista, setAnalista] = useState("");
  const [motivo, setMotivo] = useState("");
  const fechar = () => {
    setAnalista("");
    setMotivo("");
    onFechar();
  };
  const designar = useMutation({
    mutationFn: () =>
      designarFn({
        data: { id: proposta!.id, analistaId: analista === "nenhum" ? null : analista, motivo },
      }),
    onSuccess: () => {
      toast.success(
        analista === "nenhum" ? "A proposta voltou para a fila." : "Analista designado.",
      );
      invalidarFila(qc);
      fechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível designar.")),
  });
  return (
    <Dialog open={!!proposta} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Designar analista — {proposta?.codigo}</DialogTitle>
          <DialogDescription>
            Quem você escolher passa a ser o responsável por enviar esta proposta ao banco.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={analista} onValueChange={setAnalista}>
            <SelectTrigger aria-label="Analista" className="h-11">
              <SelectValue
                placeholder={
                  analistas.isLoading
                    ? "Carregando…"
                    : analistas.isError
                      ? "Não foi possível carregar os analistas"
                      : "Escolha o analista"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Voltar para a fila (sem analista)</SelectItem>
              {(analistas.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            aria-label="Motivo da designação"
            rows={3}
            placeholder="Motivo (fica registrado na proposta)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="h-11 sm:h-9" onClick={fechar}>
            Cancelar
          </Button>
          <Button
            className="h-11 sm:h-9"
            onClick={() => designar.mutate()}
            disabled={designar.isPending || !analista || motivo.trim().length < 5}
          >
            Designar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
