import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Calculator, Download, ExternalLink, Eye, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HoleriteBuilderDialog } from "@/components/rh/holerite-builder-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listarDocumentos,
  listarBeneficiosDoFuncionario,
  listarFerias,
  listarOcorrencias,
  listarHolerites,
  gerarUrlAssinada,
  registrarDocumento,
  excluirDocumento,
  anexarHolerite,
  excluirHolerite,
} from "@/lib/rh/submodulos.functions";
import { ChecklistClt } from "@/components/rh/checklist-clt";
import { formatBRL } from "@/lib/financeiro/format";

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={99} className="py-8 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

const TIPOS_DOC = [
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

/** Descobre o correspondente do usuário logado (prefixo dos paths no bucket). */
async function correspondenteAtual() {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Sessão expirada.");
  const prof = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", user.id)
    .maybeSingle();
  const cid = prof.data?.correspondente_id as string | undefined;
  if (!cid) throw new Error("Correspondente não encontrado.");
  return cid;
}

function Chrome({
  titulo,
  atalho,
  acao,
  children,
}: {
  titulo: string;
  atalho: { to: string; label: string };
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <div className="flex items-center gap-2">
          {acao}
          <Button asChild variant="outline" size="sm">
            <Link to={atalho.to}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              {atalho.label}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

export function FichaDocumentos({ funcionarioId }: { funcionarioId: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(listarDocumentos);
  const fnUrl = useServerFn(gerarUrlAssinada);
  const fnRegistrar = useServerFn(registrarDocumento);
  const fnExcluir = useServerFn(excluirDocumento);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    tipo: string;
    descricao: string;
    validade: string;
    file: File | null;
  }>({ tipo: TIPOS_DOC[0], descricao: "", validade: "", file: null });

  const q = useQuery({
    queryKey: ["rh-ficha-docs", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });

  async function baixar(path: string) {
    const r = await fnUrl({ data: { path, expira_em: 300 } });
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  const enviar = useMutation({
    mutationFn: async () => {
      if (!form.file) throw new Error("Selecione o arquivo.");
      const cid = await correspondenteAtual();
      const ext = form.file.name.split(".").pop() || "bin";
      const path = `${cid}/${funcionarioId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("rh-documentos")
        .upload(path, form.file, { contentType: form.file.type });
      if (error) throw new Error(error.message);
      await fnRegistrar({
        data: {
          funcionario_id: funcionarioId,
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
      toast.success("Documento anexado à ficha.");
      setOpen(false);
      setForm({ tipo: TIPOS_DOC[0], descricao: "", validade: "", file: null });
      qc.invalidateQueries({ queryKey: ["rh-ficha-docs", funcionarioId] });
      qc.invalidateQueries({ queryKey: ["rh-checklist-clt", funcionarioId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao anexar."),
  });

  const remover = useMutation({
    mutationFn: (id: string) => fnExcluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Documento removido.");
      qc.invalidateQueries({ queryKey: ["rh-ficha-docs", funcionarioId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover."),
  });

  return (
    <div className="space-y-4">
      <ChecklistClt funcionarioId={funcionarioId} />
      <Chrome
        titulo="Documentos anexados"
        atalho={{ to: "/rh/documentos", label: "Ver todos" }}
        acao={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="mr-2 h-3.5 w-3.5" /> Enviar documento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Enviar documento</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.tipo}
                    onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  >
                    {TIPOS_DOC.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input
                    value={form.descricao}
                    onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Validade</Label>
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
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => enviar.mutate()} disabled={enviar.isPending}>
                  Enviar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <Empty>Carregando…</Empty>}
            {!q.isLoading && (q.data?.length ?? 0) === 0 && (
              <Empty>Nenhum documento anexado.</Empty>
            )}
            {q.data?.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.tipo}</TableCell>
                <TableCell className="max-w-[280px] truncate">{d.descricao ?? "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate">{d.arquivo_nome}</TableCell>
                <TableCell>{fmtDate(d.validade)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Abrir / baixar"
                    onClick={() => baixar(d.arquivo_path)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Excluir"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remover.mutate(d.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Chrome>
    </div>
  );
}

export function FichaBeneficios({ funcionarioId }: { funcionarioId: string }) {
  const fn = useServerFn(listarBeneficiosDoFuncionario);
  const q = useQuery({
    queryKey: ["rh-ficha-benef", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });
  return (
    <Chrome titulo="Benefícios" atalho={{ to: "/rh/beneficios", label: "Gerenciar" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Desconto</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhum benefício vinculado.</Empty>
          )}
          {q.data?.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.tipo_nome}</TableCell>
              <TableCell>{formatBRL(b.valor)}</TableCell>
              <TableCell>{formatBRL(b.desconto)}</TableCell>
              <TableCell>
                {fmtDate(b.vigencia_inicio)} — {fmtDate(b.vigencia_fim)}
              </TableCell>
              <TableCell>
                <span
                  className={
                    b.ativo
                      ? "inline-flex rounded-md bg-[color-mix(in_oklab,var(--success)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-success"
                      : "inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  }
                >
                  {b.ativo ? "Ativo" : "Encerrado"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chrome>
  );
}

export function FichaFerias({ funcionarioId }: { funcionarioId: string }) {
  const fn = useServerFn(listarFerias);
  const q = useQuery({
    queryKey: ["rh-ficha-ferias", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });
  return (
    <Chrome titulo="Férias" atalho={{ to: "/rh/ferias", label: "Gerenciar" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período aquisitivo</TableHead>
            <TableHead>Gozo</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Abono</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhum período de férias cadastrado.</Empty>
          )}
          {q.data?.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                {fmtDate(f.periodo_aquisitivo_inicio)} — {fmtDate(f.periodo_aquisitivo_fim)}
              </TableCell>
              <TableCell>
                {fmtDate(f.data_inicio)} — {fmtDate(f.data_fim)}
              </TableCell>
              <TableCell>{f.dias_gozados}</TableCell>
              <TableCell>{f.abono_dias}</TableCell>
              <TableCell className="capitalize">{f.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chrome>
  );
}

export function FichaOcorrencias({ funcionarioId }: { funcionarioId: string }) {
  const fn = useServerFn(listarOcorrencias);
  const q = useQuery({
    queryKey: ["rh-ficha-ocorr", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });
  return (
    <Chrome titulo="Ocorrências" atalho={{ to: "/rh/faltas-ocorrencias", label: "Gerenciar" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Fim</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Justificativa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhuma ocorrência registrada.</Empty>
          )}
          {q.data?.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-medium capitalize">{o.tipo}</TableCell>
              <TableCell>{fmtDate(o.data_inicio)}</TableCell>
              <TableCell>{fmtDate(o.data_fim)}</TableCell>
              <TableCell>{o.dias ?? "—"}</TableCell>
              <TableCell className="max-w-[320px] truncate">
                {o.justificativa ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chrome>
  );
}

export function FichaHolerites({ funcionarioId }: { funcionarioId: string }) {
  const qc = useQueryClient();
  const hoje = new Date();
  const fn = useServerFn(listarHolerites);
  const fnUrl = useServerFn(gerarUrlAssinada);
  const fnAnexar = useServerFn(anexarHolerite);
  const fnExcluir = useServerFn(excluirHolerite);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    mes: number;
    ano: number;
    valor_liquido: string;
    file: File | null;
  }>({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear(), valor_liquido: "", file: null });

  const q = useQuery({
    queryKey: ["rh-ficha-hol", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });

  async function abrir(path: string) {
    const r = await fnUrl({ data: { path, expira_em: 300 } });
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  async function baixar(path: string, nome: string) {
    const r = await fnUrl({ data: { path, expira_em: 300 } });
    const a = document.createElement("a");
    a.href = r.url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const enviar = useMutation({
    mutationFn: async () => {
      if (!form.file) throw new Error("Selecione o arquivo do holerite.");
      const cid = await correspondenteAtual();
      const path = `${cid}/holerites/${funcionarioId}/${form.ano}-${String(form.mes).padStart(2, "0")}.pdf`;
      const { error } = await supabase.storage
        .from("rh-documentos")
        .upload(path, form.file, {
          contentType: form.file.type || "application/pdf",
          upsert: true,
        });
      if (error) throw new Error(error.message);
      const liquido = Number(String(form.valor_liquido).replace(",", "."));
      await fnAnexar({
        data: {
          funcionario_id: funcionarioId,
          mes: form.mes,
          ano: form.ano,
          arquivo_path: path,
          arquivo_nome: form.file.name,
          valor_liquido: Number.isFinite(liquido) && liquido > 0 ? liquido : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Holerite anexado.");
      setOpen(false);
      setForm((p) => ({ ...p, valor_liquido: "", file: null }));
      qc.invalidateQueries({ queryKey: ["rh-ficha-hol", funcionarioId] });
      qc.invalidateQueries({ queryKey: ["rh-holerites"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao anexar."),
  });

  const [emEdicao, setEmEdicao] = useState<any | null>(null);

  const remover = useMutation({
    mutationFn: (id: string) => fnExcluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Holerite removido.");
      qc.invalidateQueries({ queryKey: ["rh-ficha-hol", funcionarioId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover."),
  });

  return (
    <Chrome
      titulo="Holerites"
      atalho={{ to: "/rh/holerites", label: "Ver todos" }}
      acao={
        <div className="flex flex-wrap gap-2">
        <HoleriteBuilderDialog
          trigger={
            <Button size="sm">
              <Calculator className="mr-2 h-3.5 w-3.5" /> Gerar holerite
            </Button>
          }
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Upload className="mr-2 h-3.5 w-3.5" /> Anexar holerite
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Anexar holerite</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Mês</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.mes || ""}
                  onChange={(e) => setForm((p) => ({ ...p, mes: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ano</Label>
                <Input
                  type="number"
                  min={2020}
                  max={2100}
                  value={form.ano || ""}
                  onChange={(e) => setForm((p) => ({ ...p, ano: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Valor líquido (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.valor_liquido}
                  onChange={(e) => setForm((p) => ({ ...p, valor_liquido: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Arquivo (PDF)</Label>
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => enviar.mutate()} disabled={enviar.isPending}>
                Anexar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Competência</TableHead>
            <TableHead>Arquivo</TableHead>
            <TableHead>Valor líquido</TableHead>
            <TableHead className="w-[150px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhum holerite disponível.</Empty>
          )}
          {q.data?.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="font-medium">
                {String(h.mes).padStart(2, "0")}/{h.ano}
              </TableCell>
              <TableCell className="max-w-[240px] truncate">{h.arquivo_nome}</TableCell>
              <TableCell>
                {h.valor_liquido !== null ? formatBRL(h.valor_liquido) : "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Editar holerite"
                  onClick={() => setEmEdicao(h)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Visualizar" onClick={() => abrir(h.arquivo_path)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Baixar"
                  onClick={() => baixar(h.arquivo_path, h.arquivo_nome)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Excluir"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remover.mutate(h.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {emEdicao && (
        <HoleriteBuilderDialog
          key={emEdicao.id}
          trigger={null}
          open
          onOpenChange={(v) => {
            if (!v) setEmEdicao(null);
          }}
          edicao={{
            id: emEdicao.id,
            funcionario_id: emEdicao.funcionario_id,
            mes: emEdicao.mes,
            ano: emEdicao.ano,
            entrada: emEdicao.entrada ?? null,
          }}
        />
      )}
    </Chrome>
  );
}
