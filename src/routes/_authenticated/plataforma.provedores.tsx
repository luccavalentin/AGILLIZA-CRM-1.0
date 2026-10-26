import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeySquare, ShieldCheck } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { useAdministradorDaPlataforma } from "@/components/plataforma/paginacao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import {
  CATALOGO,
  campoExigido,
  type ProvedorConhecido,
} from "@/lib/plataforma/provedores-catalogo";
import {
  alternarCredencial,
  apagarCredencial,
  guardarCredencial,
  listarCredenciais,
  type CredencialGuardada,
} from "@/lib/plataforma/provedores.functions";

export const Route = createFileRoute("/_authenticated/plataforma/provedores")({
  head: () => ({ meta: [{ title: "Chaves dos provedores — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.provedores"),
  component: Pagina,
});

function Pagina() {
  const listarFn = useServerFn(listarCredenciais);
  const q = useQuery({ queryKey: ["plataforma-provedores"], queryFn: () => listarFn() });
  const provedores = Object.keys(CATALOGO) as ProvedorConhecido[];
  const guardadas = q.data?.guardadas ?? [];
  const ligadas = guardadas.filter((g) => g.ativo).length;
  const moduloEdita = usePermissao("saas.provedores", "edit");
  const administrador = useAdministradorDaPlataforma();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Gestão de sistemas"
        icon={<KeySquare className="h-5 w-5" />}
        titulo="Chaves dos provedores"
        descricao="Integração bancária, birôs de crédito, cobrança e e-mail. As chaves ficam cifradas no banco; aqui aparecem só os últimos caracteres. Com o Asaas ativo, as faturas dos assinantes são cobradas e baixadas automaticamente."
      />
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Ambiente: <b>{q.data?.ambiente === "producao" ? "Produção" : "Homologação"}</b> ·{" "}
          {ligadas} de {provedores.length} provedores ligados. Toda troca de chave fica registrada
          na auditoria.
        </p>
      </div>
      {moduloEdita && !administrador && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Guardar, ligar e apagar chaves é só para administradores. Seu acesso vê as dicas.
        </p>
      )}
      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar as chaves.")}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {q.isLoading && <Skeleton className="h-48" />}
        {!q.isLoading &&
          provedores.map((p) => (
            <CartaoProvedor
              key={p}
              provedor={p}
              guardada={guardadas.find((g) => g.provedor === p) ?? null}
            />
          ))}
      </div>
    </div>
  );
}

function CartaoProvedor({
  provedor,
  guardada,
}: {
  provedor: ProvedorConhecido;
  guardada: CredencialGuardada | null;
}) {
  const qc = useQueryClient();
  // O banco só aceita troca de chave de quem entra como administrador da plataforma
  // (administrador, correspondente ou gestor do Agilliza). Para os demais, o botão
  // aparecia e o clique terminava em "sem permissão".
  const moduloEdita = usePermissao("saas.provedores", "edit");
  const administrador = useAdministradorDaPlataforma();
  const pode = moduloEdita && administrador;
  const info = CATALOGO[provedor];
  const guardarFn = useServerFn(guardarCredencial);
  const alternarFn = useServerFn(alternarCredencial);
  const apagarFn = useServerFn(apagarCredencial);
  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState(guardada?.base_url ?? "");
  const [observacao, setObservacao] = useState("");
  const recarregar = () => qc.invalidateQueries({ queryKey: ["plataforma-provedores"] });
  const erro = (e: unknown) => toast.error(mensagemDeErro(e, "Não foi possível concluir."));

  const guardar = useMutation({
    mutationFn: () => guardarFn({ data: { provedor, campos, baseUrl, observacao } }),
    onSuccess: () => {
      toast.success(`Credencial da ${info.rotulo} guardada.`);
      setCampos({});
      setObservacao("");
      setEditando(false);
      recarregar();
    },
    onError: erro,
  });
  const alternar = useMutation({
    mutationFn: (ativo: boolean) => alternarFn({ data: { provedor, ativo } }),
    onSuccess: (_, ativo) => {
      toast.success(`${info.rotulo} ${ativo ? "ligada" : "desligada"}.`);
      recarregar();
    },
    onError: erro,
  });

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{info.rotulo}</h2>
          <p className="text-sm text-muted-foreground">{info.descricao}</p>
        </div>
        {guardada ? (
          <Badge variant={guardada.ativo ? "default" : "secondary"}>
            {guardada.ativo ? "Ligada" : "Desligada"}
          </Badge>
        ) : (
          <Badge variant="outline">Não configurada</Badge>
        )}
      </div>

      {guardada && (
        <dl className="grid gap-1 text-sm">
          {info.campos.map((c) => (
            <div key={c.chave} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{c.rotulo}</dt>
              <dd className="font-mono">
                {guardada.dicas?.[c.chave] ? `••••${guardada.dicas[c.chave]}` : "—"}
              </dd>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Atualizada em {formatData(guardada.atualizado_em)}
            {guardada.observacao ? ` · ${guardada.observacao}` : ""}
          </p>
        </dl>
      )}

      {pode && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={guardada ? "outline" : "default"}
            onClick={() => setEditando((v) => !v)}
          >
            {guardada ? "Trocar chave" : "Configurar"}
          </Button>
          {guardada && (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  checked={guardada.ativo}
                  onCheckedChange={(v) => alternar.mutate(v)}
                  disabled={alternar.isPending}
                  aria-label={`Ligar ${info.rotulo}`}
                />
                <span className="text-sm">Ligada</span>
              </div>
              <ConfirmDelete
                titulo={`Apagar a credencial da ${info.rotulo}?`}
                descricao="O sistema para de usar este provedor até uma nova chave ser guardada."
                confirmarLabel="Apagar"
                onConfirm={async () => {
                  try {
                    await apagarFn({ data: { provedor } });
                    toast.success(`Credencial da ${info.rotulo} apagada.`);
                    recarregar();
                  } catch (e) {
                    erro(e);
                  }
                }}
              />
            </>
          )}
        </div>
      )}

      {editando && pode && (
        <form
          className="space-y-3 rounded-md border border-border p-3"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            guardar.mutate();
          }}
        >
          {info.campos.map((c) => (
            <div key={c.chave} className="space-y-1">
              <Label htmlFor={`cred-${provedor}-${c.chave}`}>
                {c.rotulo}
                {campoExigido(c) && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id={`cred-${provedor}-${c.chave}`}
                type={c.segredo ? "password" : "text"}
                autoComplete="new-password"
                placeholder={c.exemplo ?? ""}
                value={campos[c.chave] ?? ""}
                onChange={(e) => setCampos((v) => ({ ...v, [c.chave]: e.target.value }))}
              />
              {c.ajuda && <p className="text-xs text-muted-foreground">{c.ajuda}</p>}
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor={`cred-${provedor}-base`}>Endereço da API (opcional)</Label>
            <Input
              id={`cred-${provedor}-base`}
              placeholder={info.baseExemplo}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`cred-${provedor}-obs`}>Observação (opcional)</Label>
            <Input
              id={`cred-${provedor}-obs`}
              placeholder="Ex.: chave nova enviada pelo provedor em outubro"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardar.isPending}>
              {guardar.isPending ? "Guardando…" : "Guardar cifrada"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
