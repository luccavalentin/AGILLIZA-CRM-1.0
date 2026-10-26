import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileCheck2, Send, ShieldCheck, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  clienteBaixarMeusDados,
  clienteExcluirDadosApp,
  clienteSolicitarLGPD,
} from "@/lib/portal/cliente.functions";
import { clientePrivacidade } from "@/lib/portal/cliente-portal.functions";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";
import { Bloco, Selo } from "@/components/cliente/portal/partes";

export const Route = createFileRoute("/cliente/privacidade")({
  head: () => ({ meta: [{ title: "Privacidade — Meu Financiamento" }] }),
  component: Privacidade,
});

const STATUS_PEDIDO: Record<string, string> = {
  aberta: "Recebido",
  em_andamento: "Em atendimento",
  concluida: "Concluído",
  cancelada: "Cancelado",
};

async function gerarPdf(dados: Awaited<ReturnType<typeof clienteBaixarMeusDados>>) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 40;
  const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2;
  let y = margem;
  const quebraPagina = (altura: number) => {
    if (y + altura > doc.internal.pageSize.getHeight() - margem) {
      doc.addPage();
      y = margem;
    }
  };
  const titulo = (t: string) => {
    quebraPagina(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(t, margem, y);
    y += 20;
  };
  const linha = (label: string, valor: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const linhas = doc.splitTextToSize(label ? `${label}: ${valor}` : valor, larguraUtil) as string[];
    quebraPagina(linhas.length * 15);
    doc.text(linhas, margem, y);
    y += linhas.length * 15;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Meus dados", margem, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margem, y);
  y += 22;

  const c = (dados.cliente ?? {}) as Record<string, string | null>;
  titulo("Cadastro");
  linha("Nome", c.nome ?? "—");
  linha("Tipo", c.tipo_pessoa ?? "—");
  linha("E-mail", c.email ?? "—");
  linha("Telefone", c.telefone_celular ?? "—");
  linha("UF de interesse", c.uf_interesse ?? "—");
  if (c.created_at) {
    linha("Cliente desde", new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));
  }
  y += 8;
  titulo("Documentos");
  const docs = (dados.documentos ?? []) as { tipo_documento?: string; nome_arquivo?: string; status?: string }[];
  if (docs.length === 0) linha("", "Nenhum documento.");
  docs.forEach((d) => linha(d.tipo_documento ?? d.nome_arquivo ?? "Documento", d.status ?? "—"));
  y += 8;
  titulo("Mensagens");
  const msgs = (dados.mensagens ?? []) as { remetente_tipo?: string; mensagem?: string; criada_em?: string }[];
  if (msgs.length === 0) linha("", "Nenhuma mensagem.");
  msgs.forEach((m) => {
    const quem = m.remetente_tipo === "cliente" ? "Você" : "Atendente";
    const quando = m.criada_em ? new Date(m.criada_em).toLocaleString("pt-BR") : "";
    linha(`${quem} (${quando})`, m.mensagem ?? "");
  });
  doc.save("meus-dados.pdf");
}

/**
 * Privacidade (C15, LGPD): o consentimento que o cliente deu, baixar os dados, pedir
 * portabilidade ou exclusão (vira demanda para o encarregado de dados) e excluir os
 * dados do aplicativo.
 */
function Privacidade() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cliente", "privacidade"], queryFn: () => clientePrivacidade() });

  const baixar = useMutation({
    mutationFn: () => clienteBaixarMeusDados(),
    onSuccess: async (dados) => {
      await gerarPdf(dados);
      toast.success("Seus dados foram baixados em PDF.");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível baixar seus dados.")),
  });
  const pedir = useMutation({
    mutationFn: (acao: "portabilidade" | "exclusao") => clienteSolicitarLGPD({ data: { acao } }),
    onSuccess: () => {
      toast.success("Pedido registrado. O encarregado de dados responde pelo chat.");
      qc.invalidateQueries({ queryKey: ["cliente", "privacidade"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar o pedido.")),
  });
  const excluir = useMutation({
    mutationFn: () => clienteExcluirDadosApp(),
    onSuccess: () => {
      toast.success("Seus dados do aplicativo foram excluídos.");
      navigate({ to: "/cliente/logout" });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível excluir seus dados.")),
  });

  const consentiu = q.data?.consentimento_em;

  return (
    <div className="space-y-4 sm:space-y-5">
      <CabecalhoPagina icon={ShieldCheck} titulo="Privacidade e meus dados" subtitulo="Seus direitos pela LGPD, a um toque." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Seu consentimento" icone={FileCheck2}>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : consentiu ? (
            <div className="space-y-2 text-sm">
              <p className="text-foreground">
                Você aceitou o termo de uso dos seus dados em{" "}
                <strong>{new Date(consentiu).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong>
                {q.data?.consentimento_versao ? ` (versão ${q.data.consentimento_versao})` : ""}.
              </p>
              <p className="text-muted-foreground">
                Usamos seus dados só para o seu financiamento: análise de crédito nos bancos,
                contrato e registro.{" "}
                <Link to="/politica-de-privacidade" className="text-primary underline underline-offset-2">
                  Política de privacidade
                </Link>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum consentimento registrado.</p>
          )}
        </Bloco>

        <Bloco titulo="Seus pedidos" icone={Send}>
          {(q.data?.pedidos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não fez nenhum pedido sobre os seus dados.</p>
          ) : (
            <ul className="space-y-2">
              {q.data!.pedidos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.titulo.replace(/^Solicitação LGPD: /, "")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                  <Selo tom={p.status === "concluida" ? "sucesso" : "info"}>{STATUS_PEDIDO[p.status] ?? p.status}</Selo>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>

      <Bloco titulo="O que você pode fazer" icone={ShieldCheck}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="lg" className="w-full justify-start" disabled={baixar.isPending} onClick={() => baixar.mutate()}>
            <Download className="mr-2 size-5" /> {baixar.isPending ? "Gerando PDF…" : "Baixar meus dados (PDF)"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start"
            disabled={pedir.isPending}
            onClick={() => pedir.mutate("portabilidade")}
          >
            <Send className="mr-2 size-5" /> Pedir a portabilidade
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="lg" className="w-full justify-start" disabled={pedir.isPending}>
                <UserX className="mr-2 size-5" /> Pedir a exclusão dos meus dados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Pedir a exclusão dos seus dados?</AlertDialogTitle>
                <AlertDialogDescription>
                  O encarregado de dados recebe o pedido e responde pelo chat. Dados que a lei manda
                  guardar (contrato e financiamento) ficam pelo prazo legal.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => pedir.mutate("exclusao")}>Enviar pedido</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="lg" className="w-full justify-start" disabled={excluir.isPending}>
                <Trash2 className="mr-2 size-5" /> Excluir meus dados do aplicativo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir dados do aplicativo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Suas mensagens, notificações e histórico de acesso serão apagados e o acesso a este
                  aplicativo será desativado. Seu cadastro na empresa continua. Não dá para desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => excluir.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Bloco>
    </div>
  );
}
