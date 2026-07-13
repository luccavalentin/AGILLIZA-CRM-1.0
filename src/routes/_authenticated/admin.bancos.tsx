import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Landmark, Settings2, KeyRound } from "lucide-react";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarBancosAdmin,
  salvarBancoAdmin,
  salvarCredencialBanco,
  type BancoAdmin,
} from "@/lib/admin/bancos.functions";

export const Route = createFileRoute("/_authenticated/admin/bancos")({
  head: () => ({ meta: [{ title: "Bancos parceiros — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.integracoes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar os bancos.</div>
  ),
});

function Pagina() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<BancoAdmin | null>(null);
  const q = useQuery({ queryKey: ["admin-bancos"], queryFn: () => listarBancosAdmin() });

  const toggle = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => salvarBancoAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Banco atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-bancos"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar."),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Landmark className="h-5 w-5" />}
        titulo="Bancos parceiros"
        descricao="Ative bancos, defina o padrão e configure as credenciais de integração."
      />

      {/* Mobile: cartões */}
      <div className="grid gap-3 md:hidden">
        {q.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))
        ) : (q.data ?? []).length === 0 ? (
          <p className="rounded-lg border border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum banco cadastrado.
          </p>
        ) : (
          (q.data ?? []).map((b) => (
            <div
              key={b.id}
              className={`rounded-lg border border-border p-4 ${b.ativo ? "" : "opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <BancoLogo nome={b.nome_banco} size="lg" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{b.nome_banco}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    Código {b.codigo_banco}
                  </p>
                </div>
                <Switch
                  checked={b.ativo}
                  disabled={toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ id: b.id, ativo: v })}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!b.ativo && <Badge variant="secondary">Aguardando homologação</Badge>}
                {b.flag_padrao && <Badge variant="outline">Padrão</Badge>}
                {b.credencial ? (
                  <Badge variant="default">{b.credencial.ambiente}</Badge>
                ) : (
                  <Badge variant="secondary">Credencial não configurada</Badge>
                )}
              </div>

              {b.produtos.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{b.produtos.join(", ")}</p>
              )}

              {!b.ativo && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setEdit(b)}
                >
                  <Settings2 className="mr-1 size-4" /> Configurar
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banco</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Produtos</TableHead>
              <TableHead>Credencial</TableHead>
              <TableHead>Padrão</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ) : (q.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhum banco cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              (q.data ?? []).map((b) => (
                <TableRow key={b.id} className={b.ativo ? "" : "opacity-60"}>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2.5">
                      <BancoLogo nome={b.nome_banco} size="md" className="shrink-0" />
                      <span>{b.nome_banco}</span>
                      {!b.ativo && (
                        <Badge variant="secondary" className="ml-1">
                          Aguardando homologação
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {b.codigo_banco}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.produtos.length > 0 ? b.produtos.join(", ") : "—"}
                  </TableCell>
                  <TableCell>
                    {b.credencial ? (
                      <Badge variant="default">{b.credencial.ambiente}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">não configurada</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {b.flag_padrao ? <Badge variant="outline">Padrão</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={b.ativo}
                      disabled={toggle.isPending}
                      onCheckedChange={(v) => toggle.mutate({ id: b.id, ativo: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {!b.ativo && (
                      <Button variant="ghost" size="sm" onClick={() => setEdit(b)}>
                        <Settings2 className="mr-1 size-4" /> Configurar
                      </Button>
                    )}
                  </TableCell>

                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {edit && <EditarBancoDialog banco={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditarBancoDialog({ banco, onClose }: { banco: BancoAdmin; onClose: () => void }) {
  const qc = useQueryClient();
  const [agencia, setAgencia] = useState(banco.codigo_agencia_padrao ?? "");
  const [parceiro, setParceiro] = useState(banco.codigo_parceiro ?? "");
  const [padrao, setPadrao] = useState(banco.flag_padrao);
  const [ambiente, setAmbiente] = useState(banco.credencial?.ambiente ?? "homologacao");
  const [baseUrl, setBaseUrl] = useState(banco.credencial?.base_url ?? "");
  const [idSecret, setIdSecret] = useState(banco.credencial?.client_id_secret_name ?? "");
  const [keySecret, setKeySecret] = useState(banco.credencial?.client_secret_name ?? "");

  const salvar = useMutation({
    mutationFn: async () => {
      await salvarBancoAdmin({
        data: {
          id: banco.id,
          flag_padrao: padrao,
          codigo_agencia_padrao: agencia,
          codigo_parceiro: parceiro,
        },
      });
      if (idSecret || keySecret || baseUrl) {
        await salvarCredencialBanco({
          data: {
            banco_id: banco.id,
            ambiente: ambiente as "homologacao" | "producao",
            base_url: baseUrl || null,
            client_id_secret_name: idSecret || null,
            client_secret_name: keySecret || null,
            ativo: true,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Configuração salva.");
      qc.invalidateQueries({ queryKey: ["admin-bancos"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar {banco.nome_banco}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Agência padrão</Label>
              <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Código parceiro</Label>
              <Input value={parceiro} onChange={(e) => setParceiro(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor="padrao">Banco padrão nos multi-selects</Label>
            <Switch id="padrao" checked={padrao} onCheckedChange={setPadrao} />
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <KeyRound className="size-4" /> Credenciais de integração
            </div>
            <p className="text-xs text-muted-foreground">
              Informe apenas os <strong>nomes</strong> dos secrets — os valores ficam guardados de
              forma segura, nunca são exibidos.
            </p>
            <div className="space-y-1.5">
              <Label>Ambiente</Label>
              <Select value={ambiente} onValueChange={setAmbiente}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.banco.com.br"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Secret Client ID</Label>
                <Input
                  value={idSecret}
                  onChange={(e) => setIdSecret(e.target.value)}
                  placeholder="BANCO_CLIENT_ID"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Secret Client Secret</Label>
                <Input
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  placeholder="BANCO_CLIENT_SECRET"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
