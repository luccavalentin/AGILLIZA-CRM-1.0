import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Download } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
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
  gerarUrlAssinada,
  listarDocumentos,
  listarFuncionariosAtivos,
  registrarDocumento,
} from "@/lib/rh/submodulos.functions";

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
  const fnFuncs = useServerFn(listarFuncionariosAtivos);
  const fnRegistrar = useServerFn(registrarDocumento);
  const fnExcluir = useServerFn(excluirDocumento);
  const fnUrl = useServerFn(gerarUrlAssinada);

  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "",
    tipo: TIPOS[0],
    descricao: "",
    validade: "",
    file: null as File | null,
  });

  const funcs = useQuery({ queryKey: ["rh-func-ativos"], queryFn: () => fnFuncs() });
  const docs = useQuery({
    queryKey: ["rh-documentos", funcionarioId],
    queryFn: () => fnList({ data: funcionarioId ? { funcionario_id: funcionarioId } : {} }),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.funcionario_id || !form.file) throw new Error("Selecione o funcionário e o arquivo.");
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sessão expirada.");
      const cid =
        funcs.data?.find((f) => f.id === form.funcionario_id)?.id ?? form.funcionario_id;
      const cidReal = await supabase
        .from("profiles")
        .select("correspondente_id")
        .eq("id", user.id)
        .maybeSingle();
      const correspondente = cidReal.data?.correspondente_id as string | undefined;
      if (!correspondente) throw new Error("Correspondente não encontrado.");
      const ext = form.file.name.split(".").pop() || "bin";
      const path = `${correspondente}/${cid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("rh-documentos")
        .upload(path, form.file, { contentType: form.file.type });
      if (upErr) throw new Error(upErr.message);
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
    onError: (e: any) => toast.error(e?.message ?? "Falha ao anexar."),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => fnExcluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Documento removido.");
      qc.invalidateQueries({ queryKey: ["rh-documentos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover."),
  });

  async function abrir(path: string) {
    const { url } = await fnUrl({ data: { path, expira_em: 300 } });
    window.open(url, "_blank", "noopener");
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
                <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
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
                  onChange={(e) =>
                    setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))
                  }
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
                    <TableCell>
                      {d.validade ? new Date(d.validade).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => abrir(d.arquivo_path)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => excluir.mutate(d.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!docs.data || docs.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum documento cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
