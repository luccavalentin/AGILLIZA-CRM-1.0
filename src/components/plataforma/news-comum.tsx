import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mensagemDeErro } from "@/lib/erros/mensagem";

/** Chave da consulta da tela de curadoria da News. */
export const QK_NEWS = ["plataforma-news"] as const;

/** As situações de `radar.noticias.status`, na ordem do fluxo. */
export const STATUS_NOTICIA = [
  "coletada",
  "resumida",
  "em_revisao",
  "aprovada",
  "publicada",
  "descartada",
] as const;

export const STATUS_NOTICIA_ROTULO: Record<string, string> = {
  coletada: "Coletada",
  resumida: "Resumida",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  publicada: "Publicada",
  descartada: "Descartada",
};

export type TomBadge = "default" | "secondary" | "destructive" | "outline";
export const STATUS_NOTICIA_TOM: Record<string, TomBadge> = {
  coletada: "outline",
  resumida: "secondary",
  em_revisao: "secondary",
  aprovada: "secondary",
  publicada: "default",
  descartada: "destructive",
};

/** "há 3 min" a partir de um instante ISO (relógio do navegador). */
export function ha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return "—";
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dia(s)`;
}

/**
 * Mutação padrão da tela: mostra a mensagem que o servidor devolveu (ou a do banco, em
 * erro) e recarrega a curadoria.
 */
export function useAcaoNews<T>(
  fn: (v: T) => Promise<{ mensagem?: string } | unknown>,
  erroPadrao = "Não foi possível salvar.",
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      const msg = (r as { mensagem?: string } | null)?.mensagem;
      toast.success(msg || "Salvo.");
      qc.invalidateQueries({ queryKey: QK_NEWS });
    },
    onError: (e) => toast.error(mensagemDeErro(e, erroPadrao)),
  });
}

/** Seletor de categoria com rótulo — as mesmas categorias do filtro da News. */
export function SeletorCategoria({
  id,
  valor,
  onChange,
  opcoes,
  disabled,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: { id: string; nome: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Categoria</Label>
      <Select value={valor} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label="Categoria">
          <SelectValue placeholder="Escolha a categoria" />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
