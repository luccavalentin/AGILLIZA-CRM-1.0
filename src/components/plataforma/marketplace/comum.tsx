import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tom } from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  decidirEspecialista,
  type DecisaoEspecialista,
  type PerfilEspecialista,
  type StatusEspecialista,
} from "@/lib/plataforma/marketplace.functions";

export const CHAVE_MARKETPLACE = ["plataforma-marketplace"];

export const STATUS_ESPECIALISTA: Record<StatusEspecialista, { rotulo: string; tom: Tom }> = {
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
  em_analise: { rotulo: "Aguardando decisão", tom: "marca" },
  aprovado: { rotulo: "Aprovado", tom: "sucesso" },
  recusado: { rotulo: "Não aprovado", tom: "perigo" },
  suspenso: { rotulo: "Suspenso", tom: "alerta" },
};

export function statusEspecialista(s: string) {
  return STATUS_ESPECIALISTA[s as StatusEspecialista] ?? { rotulo: s, tom: "neutro" as Tom };
}

export const ROTULO_DECISAO: Record<DecisaoEspecialista, string> = {
  aprovar: "Aprovado",
  nao_aprovar: "Não aprovado",
  suspender: "Suspenso",
};

export const NIVEL_PLANO: Record<string, string> = {
  destaque: "Destaque",
  desempenho: "Por contato",
  basico: "Básico",
};

/** `regioes` vem como `[{ uf, cidades[] }]` (jsonb) ou, em perfis antigos, texto. */
export function textosDasRegioes(regioes: PerfilEspecialista["regioes"]): string[] {
  if (!Array.isArray(regioes)) return [];
  return regioes.flatMap((r) => {
    if (typeof r === "string") return [r];
    if (r && typeof r === "object" && !Array.isArray(r)) {
      const uf = typeof r.uf === "string" ? r.uf : "";
      const cidades = Array.isArray(r.cidades) ? r.cidades.filter((c) => typeof c === "string") : [];
      const texto = [cidades.join(", "), uf].filter(Boolean).join(" - ");
      return texto ? [texto] : [];
    }
    return [];
  });
}

/** O que a moderação confere antes de aprovar, em itens de sim/não. */
export function conferencia(p: PerfilEspecialista): { rotulo: string; ok: boolean }[] {
  const vencido = p.registro_validade ? new Date(`${p.registro_validade}T23:59:59`) < new Date() : false;
  return [
    { rotulo: "Registro profissional informado", ok: !!(p.registro_tipo && p.registro_numero) },
    { rotulo: vencido ? "Registro vencido" : "Registro dentro da validade", ok: !vencido },
    { rotulo: "Foto do perfil", ok: !!p.foto_url },
    { rotulo: "Capa do anúncio", ok: !!p.capa_url },
    { rotulo: "Apresentação escrita", ok: !!p.apresentacao && p.apresentacao.trim().length >= 40 },
    { rotulo: "Ao menos uma categoria", ok: (p.categorias ?? []).length > 0 },
  ];
}

/** Hook da decisão (aprovar, não aprovar, suspender), com o aviso certo. */
export function useDecidir(onFeito?: () => void) {
  const qc = useQueryClient();
  const decidirFn = useServerFn(decidirEspecialista);
  return useMutation({
    mutationFn: (v: { id: string; decisao: DecisaoEspecialista; motivo?: string }) =>
      decidirFn({ data: { id: v.id, decisao: v.decisao, motivo: v.motivo ?? "" } }),
    onSuccess: (r, v) => {
      toast.success(
        v.decisao === "aprovar"
          ? `${r.nome} aprovado e no ar. O especialista foi avisado.`
          : v.decisao === "nao_aprovar"
            ? `${r.nome} não aprovado. O motivo foi enviado ao especialista.`
            : `${r.nome} suspenso. O motivo foi enviado ao especialista.`,
      );
      qc.invalidateQueries({ queryKey: CHAVE_MARKETPLACE });
      qc.invalidateQueries({ queryKey: ["plataforma-marketplace-metricas"] });
      onFeito?.();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar a decisão.")),
  });
}

/** Diálogo do "Não aprovar" / "Suspender": motivo obrigatório, que vai para o especialista. */
export function DialogoMotivo({
  perfil,
  decisao,
  aoFechar,
}: {
  perfil: PerfilEspecialista | null;
  decisao: "nao_aprovar" | "suspender";
  aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const decidir = useDecidir(() => {
    setMotivo("");
    aoFechar();
  });
  const ok = motivo.trim().length >= 10;
  const titulo = decisao === "nao_aprovar" ? "Não aprovar" : "Suspender";
  return (
    <Dialog open={!!perfil} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {titulo} {perfil?.nome}?
          </DialogTitle>
          <DialogDescription>
            {decisao === "nao_aprovar"
              ? "O anúncio não entra na vitrine. O especialista recebe o motivo e pode corrigir e enviar de novo."
              : "O anúncio sai da vitrine agora. O especialista recebe o motivo."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mkt-motivo">Motivo (vai para o especialista)</Label>
          <Textarea
            id="mkt-motivo"
            rows={4}
            maxLength={1000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: o número do CRECI não confere com o nome. Envie o documento atualizado."
            autoFocus
          />
          <p className={`text-xs ${ok || !motivo ? "text-muted-foreground" : "text-destructive"}`}>
            {motivo.trim().length}/1000 · pelo menos 10 letras
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={aoFechar}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            className="min-h-11 sm:min-h-9"
            disabled={!ok || decidir.isPending || !perfil}
            onClick={() => perfil && decidir.mutate({ id: perfil.id, decisao, motivo })}
          >
            {decidir.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <X className="mr-1.5 size-4" />}
            {titulo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botão Aprovar (decisão sem motivo). */
export function BotaoAprovar({
  perfil,
  className,
  onFeito,
}: {
  perfil: PerfilEspecialista;
  className?: string;
  onFeito?: () => void;
}) {
  const decidir = useDecidir(onFeito);
  return (
    <Button
      className={className}
      disabled={decidir.isPending}
      onClick={() => decidir.mutate({ id: perfil.id, decisao: "aprovar" })}
    >
      {decidir.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Check className="mr-1.5 size-4" />}
      Aprovar
    </Button>
  );
}
