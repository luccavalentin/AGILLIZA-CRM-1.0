import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleDashed,
  KeyRound,
  KeySquare,
  Lock,
  Pencil,
  Power,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  CabecalhoGestao,
  EstadoErro,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import { MarcaProvedor } from "@/components/plataforma/provedores/marca-provedor";
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
  head: () => ({ meta: [{ title: "Chaves dos provedores — Configurações gerais — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.provedores"),
  component: Pagina,
});

/** Grupos lógicos dos provedores (o catálogo continua sendo a fonte dos campos). */
const GRUPOS: { titulo: string; descricao: string; provedores: ProvedorConhecido[] }[] = [
  {
    titulo: "Bancos e propostas",
    descricao: "Simulação e envio de propostas aos bancos.",
    provedores: ["homefin"],
  },
  {
    titulo: "Consulta de crédito",
    descricao: "Birôs usados na consulta de ficha (cobrada por consulta).",
    provedores: ["apifull", "serasa", "spc", "boavista"],
  },
  {
    titulo: "Cobrança e comunicação",
    descricao: "Faturas dos assinantes e e-mails do sistema.",
    provedores: ["asaas", "email"],
  },
];

function Pagina() {
  const listarFn = useServerFn(listarCredenciais);
  const q = useQuery({ queryKey: ["plataforma-provedores"], queryFn: () => listarFn() });
  const provedores = Object.keys(CATALOGO) as ProvedorConhecido[];
  const guardadas = q.data?.guardadas ?? [];
  const ligadas = guardadas.filter((g) => g.ativo).length;
  const moduloEdita = usePermissao("saas.provedores", "edit");
  const administrador = useAdministradorDaPlataforma();
  const [editando, setEditando] = useState<ProvedorConhecido | null>(null);
  // Provedor novo no catálogo que ainda não entrou num grupo aparece no fim.
  const agrupados = new Set(GRUPOS.flatMap((g) => g.provedores));
  const grupos = [
    ...GRUPOS,
    ...(provedores.some((p) => !agrupados.has(p))
      ? [{ titulo: "Outros", descricao: "", provedores: provedores.filter((p) => !agrupados.has(p)) }]
      : []),
  ];
  const producao = q.data?.ambiente === "producao";

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="Configurações gerais"
        icone={<KeySquare />}
        titulo="Chaves dos provedores"
        descricao="Integração bancária, birôs de crédito, cobrança e e-mail. As chaves ficam cifradas no banco e só os últimos caracteres aparecem aqui. Com o Asaas ligado, as faturas dos assinantes são cobradas e baixadas sozinhas."
      />

      <FaixaIndicadores>
        <Indicador
          rotulo="Ambiente"
          valor={q.isLoading ? "—" : producao ? "Produção" : "Homologação"}
          icone={<ShieldCheck />}
          tom={producao ? "sucesso" : "alerta"}
          detalhe="Cada ambiente guarda as próprias chaves"
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Ligados"
          valor={`${ligadas} de ${provedores.length}`}
          icone={<Power />}
          tom="sucesso"
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Configurados"
          valor={guardadas.length}
          icone={<KeyRound />}
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Sem chave"
          valor={Math.max(0, provedores.length - guardadas.length)}
          icone={<CircleDashed />}
          tom="neutro"
          carregando={q.isLoading}
        />
      </FaixaIndicadores>

      <div className="flex items-start gap-2.5 rounded-[14px] border border-primary/15 bg-primary/[0.04] p-3 text-sm text-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Nenhuma tela devolve o valor de uma chave. Guardar, ligar e apagar ficam na auditoria com
          quem fez e quando.
          {moduloEdita && !administrador && (
            <span className="text-muted-foreground">
              {" "}
              Guardar, ligar e apagar é só para administradores: seu acesso vê as dicas.
            </span>
          )}
        </p>
      </div>

      {q.isError ? (
        <Secao>
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar as chaves.")}
            onTentar={() => q.refetch()}
          />
        </Secao>
      ) : q.isLoading ? (
        <Secao>
          <ListaCarregando linhas={4} />
        </Secao>
      ) : (
        grupos.map((g) => (
          <Secao key={g.titulo} titulo={g.titulo} descricao={g.descricao || undefined}>
            <div className="grid gap-3 md:grid-cols-2">
              {g.provedores.map((p) => (
                <CartaoProvedor
                  key={p}
                  provedor={p}
                  guardada={guardadas.find((x) => x.provedor === p) ?? null}
                  onEditar={() => setEditando(p)}
                />
              ))}
            </div>
          </Secao>
        ))
      )}

      <GavetaChave
        provedor={editando}
        guardada={editando ? (guardadas.find((x) => x.provedor === editando) ?? null) : null}
        onFechar={() => setEditando(null)}
      />
    </PaginaGestao>
  );
}

function CartaoProvedor({
  provedor,
  guardada,
  onEditar,
}: {
  provedor: ProvedorConhecido;
  guardada: CredencialGuardada | null;
  onEditar: () => void;
}) {
  const qc = useQueryClient();
  // O banco só aceita troca de chave de quem entra como administrador da plataforma
  // (administrador, correspondente ou gestor do Agilliza). Para os demais, o botão
  // aparecia e o clique terminava em "sem permissão".
  const moduloEdita = usePermissao("saas.provedores", "edit");
  const administrador = useAdministradorDaPlataforma();
  const pode = moduloEdita && administrador;
  const info = CATALOGO[provedor];
  const alternarFn = useServerFn(alternarCredencial);
  const apagarFn = useServerFn(apagarCredencial);
  const recarregar = () => qc.invalidateQueries({ queryKey: ["plataforma-provedores"] });

  const alternar = useMutation({
    mutationFn: (ativo: boolean) => alternarFn({ data: { provedor, ativo } }),
    onSuccess: (_, ativo) => {
      toast.success(`${info.rotulo} ${ativo ? "ligada" : "desligada"}.`);
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível concluir.")),
  });

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/80 bg-background p-3.5">
      <div className="flex items-start gap-3">
        <MarcaProvedor codigo={provedor} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-foreground">{info.rotulo}</h3>
            {guardada ? (
              guardada.ativo ? (
                <Selo tom="sucesso" ponto>
                  Ligada
                </Selo>
              ) : (
                <Selo tom="neutro">Desligada</Selo>
              )
            ) : (
              <Selo tom="alerta">Sem chave</Selo>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{info.descricao}</p>
        </div>
      </div>

      {guardada && (
        <dl className="grid gap-1 rounded-lg bg-secondary/60 px-3 py-2 text-xs">
          {info.campos.map((c) => (
            <div key={c.chave} className="flex min-w-0 items-center justify-between gap-3">
              <dt className="truncate text-muted-foreground">{c.rotulo}</dt>
              <dd className="shrink-0 font-mono tabular-nums text-foreground">
                {guardada.dicas?.[c.chave] ? `••••${guardada.dicas[c.chave]}` : "—"}
              </dd>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-muted-foreground">
            Atualizada em {formatData(guardada.atualizado_em)}
            {guardada.observacao ? ` · ${guardada.observacao}` : ""}
          </p>
        </dl>
      )}

      {pode && (
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <Button
            size="sm"
            variant={guardada ? "outline" : "default"}
            className="min-h-11 sm:min-h-8"
            onClick={onEditar}
          >
            {guardada ? (
              <>
                <Pencil className="mr-1.5 size-3.5" /> Trocar chave
              </>
            ) : (
              <>
                <KeyRound className="mr-1.5 size-3.5" /> Configurar
              </>
            )}
          </Button>
          {guardada && (
            <>
              <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-8">
                <Switch
                  checked={guardada.ativo}
                  onCheckedChange={(v) => alternar.mutate(v)}
                  disabled={alternar.isPending}
                  aria-label={`Ligar ${info.rotulo}`}
                />
                Ligada
              </label>
              <ConfirmDelete
                titulo={`Apagar a credencial da ${info.rotulo}?`}
                descricao="O sistema para de usar este provedor até uma nova chave ser guardada."
                confirmarLabel="Apagar"
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto min-h-11 text-muted-foreground hover:text-destructive sm:min-h-8"
                  >
                    <Trash2 className="mr-1.5 size-3.5" /> Apagar
                  </Button>
                }
                onConfirm={async () => {
                  await apagarFn({ data: { provedor } });
                  toast.success(`Credencial da ${info.rotulo} apagada.`);
                  recarregar();
                }}
              />
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Formulário da chave numa gaveta: os campos do catálogo, endereço e observação. */
function GavetaChave({
  provedor,
  guardada,
  onFechar,
}: {
  provedor: ProvedorConhecido | null;
  guardada: CredencialGuardada | null;
  onFechar: () => void;
}) {
  return (
    <Sheet open={!!provedor} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {provedor && (
          <FormularioChave
            key={provedor}
            provedor={provedor}
            guardada={guardada}
            onFechar={onFechar}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function FormularioChave({
  provedor,
  guardada,
  onFechar,
}: {
  provedor: ProvedorConhecido;
  guardada: CredencialGuardada | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const info = CATALOGO[provedor];
  const guardarFn = useServerFn(guardarCredencial);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState(guardada?.base_url ?? "");
  const [observacao, setObservacao] = useState("");

  const guardar = useMutation({
    mutationFn: () => guardarFn({ data: { provedor, campos, baseUrl, observacao } }),
    onSuccess: () => {
      toast.success(`Credencial da ${info.rotulo} guardada.`);
      qc.invalidateQueries({ queryKey: ["plataforma-provedores"] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível concluir.")),
  });

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-3">
          <MarcaProvedor codigo={provedor} />
          <div className="min-w-0 text-left">
            <SheetTitle>{guardada ? "Trocar chave" : "Configurar"}</SheetTitle>
            <SheetDescription>{info.rotulo}</SheetDescription>
          </div>
        </div>
      </SheetHeader>
      <form
        className="mt-5 space-y-4"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        {info.campos.map((c) => (
          <div key={c.chave} className="space-y-1.5">
            <Label htmlFor={`cred-${provedor}-${c.chave}`}>
              {c.rotulo}
              {campoExigido(c) && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id={`cred-${provedor}-${c.chave}`}
              type={c.segredo ? "password" : "text"}
              autoComplete="new-password"
              className="text-base sm:text-sm"
              placeholder={c.exemplo ?? (guardada?.dicas?.[c.chave] ? `atual ••••${guardada.dicas[c.chave]}` : "")}
              value={campos[c.chave] ?? ""}
              onChange={(e) => setCampos((v) => ({ ...v, [c.chave]: e.target.value }))}
            />
            {c.ajuda && <p className="text-xs text-muted-foreground">{c.ajuda}</p>}
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor={`cred-${provedor}-base`}>Endereço da API (opcional)</Label>
          <Input
            id={`cred-${provedor}-base`}
            className="text-base sm:text-sm"
            placeholder={info.baseExemplo}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cred-${provedor}-obs`}>Observação (opcional)</Label>
          <Input
            id={`cred-${provedor}-obs`}
            className="text-base sm:text-sm"
            placeholder="Ex.: chave nova enviada pelo provedor em outubro"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-secondary/70 p-2.5 text-xs text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success-texto" />
          A chave vai cifrada direto para o banco; esta tela não guarda nem mostra o valor.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="min-h-11 sm:min-h-9" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" className="min-h-11 sm:min-h-9" disabled={guardar.isPending}>
            <Lock className="mr-1.5 size-4" />
            {guardar.isPending ? "Guardando…" : "Guardar cifrada"}
          </Button>
        </div>
      </form>
    </>
  );
}
