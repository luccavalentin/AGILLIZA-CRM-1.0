import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  listarPessoasParaCaixas,
  salvarCaixa,
  type CaixaVigiada,
  type PessoaParaCaixa,
} from "@/lib/codigos/codigos.functions";

/** Servidores de leitura (IMAP) mais comuns; "Outro" libera os campos. */
const PROVEDORES = [
  { id: "uhserver", rotulo: "Agilliza (UHServer)", host: "imap.uhserver.com", porta: 993 },
  { id: "gmail", rotulo: "Gmail", host: "imap.gmail.com", porta: 993 },
  { id: "outlook", rotulo: "Outlook / Hotmail", host: "outlook.office365.com", porta: 993 },
  { id: "outro", rotulo: "Outro", host: "", porta: 993 },
] as const;

type Provedor = (typeof PROVEDORES)[number]["id"];

function provedorDe(host: string): Provedor {
  return PROVEDORES.find((p) => p.host && p.host === host)?.id ?? "outro";
}

export function CaixaDialog({
  aberto,
  aoFechar,
  caixa,
}: {
  aberto: boolean;
  aoFechar: () => void;
  caixa: CaixaVigiada | null;
}) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarCaixa);
  const pessoasFn = useServerFn(listarPessoasParaCaixas);
  const pessoas = useQuery({
    queryKey: ["codigos-pessoas"],
    queryFn: () => pessoasFn(),
    enabled: aberto,
  });
  const [liberados, setLiberados] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [provedor, setProvedor] = useState<Provedor>("uhserver");
  const [host, setHost] = useState("imap.uhserver.com");
  const [porta, setPorta] = useState(993);
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setEmail(caixa?.email ?? "");
    setSenha("");
    setHost(caixa?.imap_host ?? "imap.uhserver.com");
    setPorta(caixa?.imap_port ?? 993);
    setProvedor(provedorDe(caixa?.imap_host ?? "imap.uhserver.com"));
    setAtivo(caixa?.ativo ?? true);
    setLiberados(new Set(caixa?.liberados ?? []));
  }, [aberto, caixa]);

  function alternar(id: string, marcado: boolean) {
    setLiberados((s) => {
      const n = new Set(s);
      if (marcado) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function escolher(id: Provedor) {
    setProvedor(id);
    const p = PROVEDORES.find((x) => x.id === id)!;
    if (p.host) {
      setHost(p.host);
      setPorta(p.porta);
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      await salvarFn({
        data: {
          id: caixa?.id,
          email,
          senha: senha || undefined,
          imap_host: host,
          imap_port: porta,
          ativo,
          // Só manda a lista se ela carregou: lista vazia por falha não pode tirar todo mundo.
          liberados: pessoas.data ? [...liberados] : undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: ["codigos-caixas"] });
      await qc.invalidateQueries({ queryKey: ["codigos-recebidos"] });
      toast.success(
        ativo ? "Caixa salva. A leitura começa em até 30 segundos." : "Caixa salva e desligada.",
      );
      aoFechar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar a caixa."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{caixa ? "Caixa vigiada" : "Vigiar uma caixa de e-mail"}</DialogTitle>
          <DialogDescription>
            O Agilliza só lê a caixa: não envia nada e não marca nada como lido. Os e-mails de
            código aparecem nesta tela; os outros ficam como estão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cx-email">E-mail</Label>
            <Input
              id="cx-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@agilliza.net.br"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cx-senha">Senha</Label>
            <Input
              id="cx-senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={
                caixa?.tem_senha ? "Deixe em branco para manter a atual" : "Senha da caixa"
              }
            />
            <p className="text-xs text-muted-foreground">
              Guardada cifrada no servidor. Ninguém consegue vê-la depois de salva.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Provedor</Label>
            <div className="grid grid-cols-2 gap-2">
              {PROVEDORES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => escolher(p.id)}
                  aria-pressed={provedor === p.id}
                  className={
                    "min-h-10 rounded-lg border px-3 py-2 text-left text-sm transition-colors " +
                    (provedor === p.id
                      ? "border-primary bg-primary/5 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/60")
                  }
                >
                  {p.rotulo}
                </button>
              ))}
            </div>
          </div>

          {provedor === "outro" && (
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="cx-host">Servidor IMAP</Label>
                <Input
                  id="cx-host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="imap.seuprovedor.com.br"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cx-porta">Porta</Label>
                <Input
                  id="cx-porta"
                  inputMode="numeric"
                  value={String(porta)}
                  onChange={(e) => setPorta(Number(e.target.value.replace(/\D/g, "")) || 0)}
                />
              </div>
            </div>
          )}

          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <span className="text-sm">
              <span className="font-medium text-foreground">Leitura ligada</span>
              <span className="block text-xs text-muted-foreground">
                Desligue para parar de ler sem apagar a caixa.
              </span>
            </span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>

          <QuemVe
            carregando={pessoas.isLoading}
            erro={pessoas.isError}
            pessoas={pessoas.data ?? []}
            liberados={liberados}
            aoAlternar={alternar}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || !email || (!caixa && !senha)}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Quem vê os códigos desta caixa (decisão 16 do backtest de 23/10/2026). Quem gere as
 * caixas vê todas; os demais só as marcadas aqui. O banco confere de novo ao salvar.
 */
function QuemVe({
  carregando,
  erro,
  pessoas,
  liberados,
  aoAlternar,
}: {
  carregando: boolean;
  erro: boolean;
  pessoas: PessoaParaCaixa[];
  liberados: Set<string>;
  aoAlternar: (id: string, marcado: boolean) => void;
}) {
  const gestores = pessoas.filter((p) => p.ve_todas);
  const equipe = pessoas.filter((p) => !p.ve_todas && p.pode_ver);
  const semVer = pessoas.filter((p) => !p.ve_todas && !p.pode_ver).length;
  return (
    <fieldset className="space-y-2 rounded-lg border px-3 py-2.5">
      <legend className="px-1 text-sm font-medium text-foreground">Quem vê os códigos</legend>
      <p className="text-xs text-muted-foreground">
        Quem gere as caixas vê todas. Marque quem mais da equipe vê os códigos desta caixa.
      </p>
      {carregando ? (
        <p className="py-2 text-sm text-muted-foreground">Carregando a equipe…</p>
      ) : erro ? (
        <p className="py-2 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível carregar a equipe agora. Salvar mantém quem já estava liberado.
        </p>
      ) : (
        <>
          {equipe.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">
              Ninguém mais da equipe tem permissão de ver os códigos.
            </p>
          ) : (
            <ul className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {equipe.map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/60">
                    <Checkbox
                      checked={liberados.has(p.id)}
                      onCheckedChange={(v) => aoAlternar(p.id, v === true)}
                      aria-label={`Liberar para ${p.nome ?? p.email ?? "esta pessoa"}`}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-medium text-foreground">
                        {p.nome ?? p.email ?? "Sem nome"}
                      </span>
                      {p.email && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.email}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {gestores.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Já veem todas: {gestores.map((p) => p.nome ?? p.email).join(", ")}.
            </p>
          )}
          {semVer > 0 && (
            <p className="text-xs text-muted-foreground">
              {semVer === 1
                ? "1 pessoa da equipe não tem “Códigos de acesso › ver” no nível de acesso e não aparece aqui."
                : `${semVer} pessoas da equipe não têm “Códigos de acesso › ver” no nível de acesso e não aparecem aqui.`}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
