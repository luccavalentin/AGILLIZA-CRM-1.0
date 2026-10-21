import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Download } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import {
  excluirDocumento,
  listarDocumentos,
  registrarDocumento,
} from "@/lib/rh/submodulos.functions";
import { formatData } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";
import { abrirArquivoRh, enviarArquivoRh, extensaoDe } from "@/lib/rh/arquivos";

const TIPOS = [
  "RG",
  "CPF",
  "CTPS",
  "Comprovante de residência",
  "Diploma / Escolaridade",
  "ASO / Exame admissional",
  "Contrato de trabalho",
  "Termo aditivo",
  "Outros",
];

export const Route = createFileRoute("/_authenticated/rh/documentos")({
  head: () => ({ meta: [{ title: "Documentos do funcionário — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.documentos"),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const fnList = useServerFn(listarDocumentos);
  const fnRegistrar = useServerFn(registrarDocumento);
  const fnExcluir = useServerFn(excluirDocumento);

  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "",
    tipo: TIPOS[0],
    descricao: "",
    validade: "",
    file: null as File | null,
  });

  const docs = useQuery({
    queryKey: ["rh-documentos", funcionarioId],
    queryFn: () => fnList({ data: funcionarioId ? { funcionario_id: funcionarioId } : {} }),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.funcionario_id || !form.file)
        throw new Error("Selecione o funcionário e o arquivo.");
      const path = await enviarArquivoRh(
        `${form.funcionario_id}/${crypto.randomUUID()}.${extensaoDe(form.file.name)}`,
        form.file,
        { contentType: form.file.type },
      );
      await fnRegistrar({
        data: {
          funcionario_id: form.funcionario_id,
          tipo: form.tipo,
          descricao: form.descricao || null,
          arquivo_path: path,
          arquivo_nome: form.file.name,
          mime_type: form.file.type || null,
          tamanho_bytes: form.file.size,
          validade: form.validade || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Documento anexado.");
      qc.invalidateQueries({ queryKey: ["rh-documentos"] });
      setOpen(false);
      setForm({ funcionario_id: "", tipo: TIPOS[0], descricao: "", validade: "", file: null });
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao anexar.")),
  });

  // Sem try/catch: o ConfirmDelete mostra o erro e continua aberto.
  async function excluir(id: string) {
    await fnExcluir({ data: { id } });
    toast.success("Documento excluído.");
    qc.invalidateQueries({ queryKey: ["rh-documentos"] });
    qc.invalidateQueries({ queryKey: ["rh-ficha-docs"] });
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <FileText className="h-5 w-5 text-primary" /> Documentos do funcionário
          </h1>
          <p className="text-sm text-muted-foreground">
            Contratos, RG, CTPS, comprovantes e exames admissionais.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" /> Anexar documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anexar documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Funcionário</Label>
                <FuncionarioPicker
                  value={form.funcionario_id}
                  onChange={(v) => setForm((p) => ({ ...p, funcionario_id: v ?? "" }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={form.descricao}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Validade (opcional)</Label>
                <Input
                  type="date"
                  value={form.validade}
                  onChange={(e) => setForm((p) => ({ ...p, validade: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                Anexar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtrar por funcionário</CardTitle>
        </CardHeader>
        <CardContent>
          <FuncionarioPicker value={funcionarioId} onChange={setFuncionarioId} allowAll />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(docs.data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.funcionario_nome}</TableCell>
                    <TableCell>{d.tipo}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{d.arquivo_nome}</TableCell>
                    <TableCell>{d.validade ? formatData(d.validade) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatData(d.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Abrir ${d.arquivo_nome}`}
                          onClick={() => abrirArquivoRh(d.arquivo_path)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <ConfirmDelete
                          titulo={`Excluir "${d.arquivo_nome}"?`}
                          descricao={`O documento sai da ficha de ${d.funcionario_nome}.`}
                          onConfirm={() => excluir(d.id)}
                          trigger={
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Excluir ${d.arquivo_nome}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!docs.data || docs.data.length === 0) && (
                  <LinhaEstadoLista
                    colSpan={6}
                    q={docs}
                    vazio="Nenhum documento cadastrado."
                    erro="Não foi possível carregar os documentos."
                  />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
