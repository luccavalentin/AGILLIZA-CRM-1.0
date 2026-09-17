import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Landmark, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  enviarDocumentosBanco,
  propostasParaEnvioDocumentos,
} from "@/lib/propostas/propostas.functions";
import { nomeDoTipoDocumento } from "@/lib/documentos/tipos-banco";
import { statusProposta } from "@/components/propostas/status";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";

const ACEITO = /pdf|png|jpe?g/i;

/**
 * Envio de documentos do CRM ao banco, sempre para UMA proposta escolhida.
 *
 * O documento é do cliente (fica no CRM); o envio é da proposta: vai para a
 * oportunidade dela na HomeFin e fica registrado nela. Antes o anexo no
 * checklist ia sozinho para todas as propostas do cliente.
 */
export function EnviarBancoDialog({
  open,
  onOpenChange,
  clienteId,
  documentos,
  preSelecionados,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string;
  documentos: any[];
  /** Documentos já marcados ao abrir (ex.: o item do checklist clicado). */
  preSelecionados?: string[];
}) {
  const qc = useQueryClient();
  const listar = useServerFn(propostasParaEnvioDocumentos);
  const enviar = useServerFn(enviarDocumentosBanco);
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  const aptos = useMemo(
    () => documentos.filter((d) => ACEITO.test(`${d.mime_type ?? ""} ${d.nome_arquivo ?? ""}`)),
    [documentos],
  );

  useEffect(() => {
    if (!open) return;
    setMarcados(new Set(preSelecionados ?? []));
    setResultado(null);
  }, [open, preSelecionados]);

  const { data: propostas, isLoading } = useQuery({
    queryKey: ["propostas-envio-documentos", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
    enabled: open,
  });

  useEffect(() => {
    if (open && propostas && propostas.length === 1) setPropostaId(propostas[0].id);
  }, [open, propostas]);

  async function confirmar() {
    if (!propostaId) return toast.error("Escolha a proposta.");
    if (marcados.size === 0) return toast.error("Escolha ao menos um documento.");
    setEnviando(true);
    try {
      const r = await enviar({
        data: { proposta_id: propostaId, documento_ids: Array.from(marcados) },
      });
      setResultado(r);
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
      qc.invalidateQueries({ queryKey: ["documentos-homefin-proposta", propostaId] });
      qc.invalidateQueries({ queryKey: ["checklist-banco", propostaId] });
      if (r.erros.length === 0) toast.success("Documentos enviados à proposta.");
      else toast.warning(`${r.erros.length} ponto(s) de atenção no envio.`);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao enviar os documentos."));
    } finally {
      setEnviando(false);
    }
  }

  const alternar = (id: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" /> Enviar documentos ao banco
          </DialogTitle>
          <DialogDescription>
            Escolha a proposta: os documentos vão para a oportunidade dela na HomeFin, cada um na
            vaga do dono, e o envio fica registrado na proposta e no cliente.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1. Proposta
          </p>
          {isLoading && (
            <p className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Carregando propostas…
            </p>
          )}
          {propostas && propostas.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              Este cliente não tem proposta enviada ao banco. Os documentos ficam salvos no CRM e
              podem ser enviados quando houver.
            </p>
          )}
          <div className="space-y-1.5">
            {(propostas ?? []).map((p) => {
              const st = statusProposta(p.status);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPropostaId(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors",
                    propostaId === p.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <BancoLogo nome={p.nome_banco} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">
                      {p.numero_proposta} · {p.nome_banco ?? "Banco"}
                    </span>
                    <span className="text-xs text-muted-foreground">{st.label}</span>
                  </span>
                  {propostaId === p.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            2. Documentos
          </p>
          {aptos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum documento em PDF, PNG ou JPEG salvo neste cliente.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {aptos.map((d) => (
                <li key={d.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                  <Checkbox checked={marcados.has(d.id)} onCheckedChange={() => alternar(d.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">
                      {nomeDoTipoDocumento(d.tipo_documento)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {d.categoria} · {d.nome_arquivo}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {resultado && (
          <section className="space-y-1 rounded-lg border border-border p-3 text-sm">
            {resultado.sucesso.map((s: any, i: number) => (
              <Linha key={`s${i}`} tom="ok" texto={`${s.nome} — no banco`} />
            ))}
            {resultado.naHomefin.map((s: any, i: number) => (
              <Linha key={`h${i}`} tom="alerta" texto={`${s.nome} — ${s.motivo}`} />
            ))}
            {resultado.erros.map((s: any, i: number) => (
              <Linha key={`e${i}`} tom="erro" texto={`${s.nome} — ${s.motivo}`} />
            ))}
            {propostaId && (
              <Link
                to="/operacional/propostas/$id/continuar"
                params={{ id: propostaId }}
                search={{ etapa: "documentos" }}
                className="inline-block pt-1 text-xs font-medium text-primary hover:underline"
              >
                Abrir documentos da proposta
              </Link>
            )}
          </section>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={enviando} onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            disabled={enviando || !propostaId || marcados.size === 0}
            onClick={confirmar}
            className="gap-1.5"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar {marcados.size > 0 ? `(${marcados.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Linha({ tom, texto }: { tom: "ok" | "alerta" | "erro"; texto: string }) {
  const Icone = tom === "ok" ? CheckCircle2 : tom === "erro" ? XCircle : AlertTriangle;
  return (
    <p className="flex items-start gap-1.5 text-muted-foreground">
      <Icone
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          tom === "ok" && "text-emerald-600",
          tom === "erro" && "text-destructive",
          tom === "alerta" && "text-amber-600",
        )}
      />
      {texto}
    </p>
  );
}
