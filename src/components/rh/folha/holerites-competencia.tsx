/**
 * Folha mensal › Holerites: depois do fechamento, gera os PDFs a partir do que foi
 * gravado (mesmo cálculo da folha) e publica — o colaborador vê no "Meu RH". Também
 * aceita holerite avulso (construtor CLT) e PDF vindo do contador.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Eye, FileCheck2, Lock, Send, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";
import { HoleriteBuilderDialog } from "@/components/rh/holerite-builder-dialog";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { usePermissao } from "@/hooks/use-permissao";
import { listarItensFolha } from "@/lib/rh/folha.functions";
import { anexarHolerite, excluirHolerite, listarHolerites } from "@/lib/rh/submodulos.functions";
import { gerarHoleritePdf } from "@/lib/rh/pdf-lazy";
import { abrirArquivoRh, baixarArquivoRh, caminhoHolerite, enviarArquivoRh } from "@/lib/rh/arquivos";
import { formatBRL } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { parseMoeda } from "@/lib/rh/moeda";

export function HoleritesCompetencia({ mes, ano, fechada }: { mes: number; ano: number; fechada: boolean }) {
  const qc = useQueryClient();
  const podeVer = usePermissao("rh.salarios", "view");
  const podeGerar = usePermissao("rh.folha", "edit") && podeVer;
  const fnLista = useServerFn(listarHolerites);
  const fnItens = useServerFn(listarItensFolha);
  const fnAnexar = useServerFn(anexarHolerite);
  const fnExcluir = useServerFn(excluirHolerite);

  const lista = useQuery({
    queryKey: ["rh-holerites", ano, mes],
    enabled: podeVer,
    queryFn: () => fnLista({ data: { ano, mes } }),
  });

  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const publicar = useMutation({
    mutationFn: async () => {
      const { competencia_id, status, itens } = await fnItens({ data: { mes, ano } });
      if (!competencia_id || status !== "fechada") throw new Error("Feche a competência antes de publicar os holerites.");
      setProgresso({ feito: 0, total: itens.length });
      let ok = 0;
      for (const it of itens) {
        const d = it.detalhamento ?? {};
        const { blob, filename } = await gerarHoleritePdf({
          competencia: { mes, ano },
          funcionario: {
            nome: it.funcionario_nome,
            numero: it.funcionario_numero,
            cpf: it.funcionario_cpf,
            cargo: it.cargo,
            departamento: it.departamento,
          },
          salario_base: it.salario_base,
          detalhamento: {
            inss: Number(d.inss ?? 0),
            irrf: Number(d.irrf ?? 0),
            base_irrf: Number(d.base_irrf ?? 0),
            base_inss: Number(d.base_inss ?? 0),
            fgts: Number(d.fgts ?? 0),
            dependentes_ir: Number(d.dependentes_ir ?? 0),
          },
          linhas: d.linhas ?? { proventos: [], descontos: [] },
          liquido: it.liquido,
        });
        const path = await enviarArquivoRh(caminhoHolerite(it.funcionario_id, ano, mes), blob, {
          contentType: "application/pdf",
          upsert: true,
        });
        await fnAnexar({
          data: {
            funcionario_id: it.funcionario_id,
            mes,
            ano,
            competencia_id,
            arquivo_path: path,
            arquivo_nome: filename,
            valor_liquido: it.liquido,
          },
        });
        ok++;
        setProgresso({ feito: ok, total: itens.length });
      }
      return ok;
    },
    onSuccess: (n) => {
      toast.success(`${n} holerite(s) gerado(s) e publicado(s) no Meu RH.`);
      qc.invalidateQueries({ queryKey: ["rh-holerites"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível publicar os holerites.")),
    onSettled: () => setProgresso(null),
  });

  // PDF vindo do contador.
  const [dlgAnexo, setDlgAnexo] = useState(false);
  const [anexo, setAnexo] = useState({ funcionario_id: "", valor: "", file: null as File | null });
  const anexar = useMutation({
    mutationFn: async () => {
      if (!anexo.funcionario_id || !anexo.file) throw new Error("Escolha o funcionário e o PDF.");
      if (anexo.file.type && anexo.file.type !== "application/pdf") throw new Error("Envie um PDF.");
      if (anexo.file.size > 10 * 1024 * 1024) throw new Error("PDF até 10 MB.");
      const path = await enviarArquivoRh(caminhoHolerite(anexo.funcionario_id, ano, mes), anexo.file, {
        contentType: "application/pdf",
        upsert: true,
      });
      await fnAnexar({
        data: {
          funcionario_id: anexo.funcionario_id,
          mes,
          ano,
          arquivo_path: path,
          arquivo_nome: anexo.file.name,
          valor_liquido: anexo.valor ? parseMoeda(anexo.valor) : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Holerite anexado.");
      setDlgAnexo(false);
      setAnexo({ funcionario_id: "", valor: "", file: null });
      qc.invalidateQueries({ queryKey: ["rh-holerites"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível anexar.")),
  });

  if (!podeVer) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Holerites mostram salários</p>
          <p className="max-w-md text-sm text-muted-foreground">É preciso a permissão RH · Salários · ver.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className={fechada ? "border-primary/30 bg-primary/5" : ""}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {fechada ? "Competência fechada: publique os holerites" : "Holerites saem depois do fechamento"}
              </p>
              <p className="text-xs text-muted-foreground">
                {fechada
                  ? "Gera o PDF de cada funcionário com os valores gravados e libera no Meu RH."
                  : "Feche a competência na aba Prévia; o colaborador só vê holerite de competência fechada."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {podeGerar && (
              <Button onClick={() => publicar.mutate()} disabled={!fechada || publicar.isPending}>
                <Send className="mr-1.5 h-4 w-4" /> Gerar e publicar
              </Button>
            )}
            {podeGerar && <HoleriteBuilderDialog />}
            {podeGerar && (
              <Button variant="outline" onClick={() => setDlgAnexo(true)}>
                <Upload className="mr-1.5 h-4 w-4" /> Anexar PDF
              </Button>
            )}
          </div>
        </CardContent>
        {progresso && (
          <div className="px-4 pb-4">
            <Progress value={(progresso.feito / Math.max(1, progresso.total)) * 100} />
            <p className="mt-1 text-xs text-muted-foreground">
              {progresso.feito} de {progresso.total}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Holerites da competência</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="hidden sm:table-cell">Arquivo</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="w-[130px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lista.data ?? []).map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.funcionario_nome}</TableCell>
                    <TableCell className="hidden max-w-[240px] truncate text-xs text-muted-foreground sm:table-cell">
                      {h.arquivo_nome}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {h.valor_liquido !== null ? formatBRL(h.valor_liquido) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Ver holerite" onClick={() => abrirArquivoRh(h.arquivo_path)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Baixar holerite"
                          onClick={() => baixarArquivoRh(h.arquivo_path, h.arquivo_nome)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {podeGerar && (
                          <ConfirmDelete
                            titulo={`Excluir o holerite de ${h.funcionario_nome}?`}
                            descricao="O registro e o PDF são apagados."
                            onConfirm={async () => {
                              const r = await fnExcluir({ data: { id: h.id } });
                              if (!r.arquivoApagado) toast.warning("Registro excluído; o PDF não pôde ser apagado.");
                              qc.invalidateQueries({ queryKey: ["rh-holerites"] });
                            }}
                            trigger={
                              <Button size="icon" variant="ghost" aria-label="Excluir holerite">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!lista.data || lista.data.length === 0) && (
                  <LinhaEstadoLista colSpan={4} q={lista} vazio="Nenhum holerite nesta competência." />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dlgAnexo} onOpenChange={setDlgAnexo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anexar holerite em PDF</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Funcionário</Label>
              <FuncionarioPicker value={anexo.funcionario_id} onChange={(v) => setAnexo((p) => ({ ...p, funcionario_id: v ?? "" }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor líquido (opcional)</Label>
              <Input className="sm:max-w-[200px]" inputMode="decimal" value={anexo.valor} onChange={(e) => setAnexo((p) => ({ ...p, valor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>PDF</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => setAnexo((p) => ({ ...p, file: e.target.files?.[0] ?? null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgAnexo(false)}>
              Cancelar
            </Button>
            <Button onClick={() => anexar.mutate()} disabled={anexar.isPending}>
              Anexar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
