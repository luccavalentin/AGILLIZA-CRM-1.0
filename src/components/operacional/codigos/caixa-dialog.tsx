import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Filter, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  salvarCaixa,
  type CaixaVigiada,
  type FiltroCaixa,
} from "@/lib/codigos/codigos.functions";
import { portaPadrao, trocaExigeSenha, type CampoFiltro, type OperadorFiltro } from "@/lib/codigos/filtros";

/** Servidores de leitura (IMAP) mais comuns; "Outro" libera os campos. */
const PROVEDORES = [
  { id: "uhserver", rotulo: "Agilliza (UHServer)", host: "imap.uhserver.com", porta: 993 },
  { id: "gmail", rotulo: "Gmail", host: "imap.gmail.com", porta: 993 },
  { id: "outlook", rotulo: "Outlook / Hotmail", host: "outlook.office365.com", porta: 993 },
  { id: "outro", rotulo: "Outro", host: "", porta: 993 },
] as const;

type Provedor = (typeof PROVEDORES)[number]["id"];

const CAMPOS: { id: CampoFiltro; rotulo: string }[] = [
  { id: "qualquer", rotulo: "Qualquer campo" },
  { id: "assunto", rotulo: "Assunto" },
  { id: "remetente", rotulo: "Remetente" },
  { id: "corpo", rotulo: "Corpo" },
];

function provedorDe(host: string): Provedor {
  return PROVEDORES.find((p) => p.host && p.host === host)?.id ?? "outro";
}

const selectCls =
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [provedor, setProvedor] = useState<Provedor>("uhserver");
  const [host, setHost] = useState("imap.uhserver.com");
  const [porta, setPorta] = useState(993);
  const [ssl, setSsl] = useState(true);
  const [pasta, setPasta] = useState("INBOX");
  const [palavrasPadrao, setPalavrasPadrao] = useState(true);
  const [ativo, setAtivo] = useState(true);
  const [filtros, setFiltros] = useState<FiltroCaixa[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome(caixa?.nome ?? "");
    setEmail(caixa?.email ?? "");
    setUsuario(caixa?.usuario ?? "");
    setSenha("");
    setHost(caixa?.imap_host ?? "imap.uhserver.com");
    setPorta(caixa?.imap_port ?? 993);
    setSsl(caixa?.imap_ssl ?? true);
    setPasta(caixa?.pasta ?? "INBOX");
    setPalavrasPadrao(caixa?.usar_palavras_padrao ?? true);
    setProvedor(provedorDe(caixa?.imap_host ?? "imap.uhserver.com"));
    setAtivo(caixa?.ativo ?? true);
    setFiltros(caixa?.filtros ?? []);
  }, [aberto, caixa]);

  function escolher(id: Provedor) {
    setProvedor(id);
    const p = PROVEDORES.find((x) => x.id === id)!;
    if (p.host) {
      setHost(p.host);
      setPorta(p.porta);
      setSsl(true);
    }
  }

  const precisaSenha =
    !!caixa?.tem_senha &&
    !senha &&
    trocaExigeSenha(caixa, { email, usuario, imap_host: host, imap_port: porta, imap_ssl: ssl });

  const semCaptura = !palavrasPadrao && !filtros.some((f) => f.ativo && f.operador === "contem");

  function mudarFiltro(i: number, parte: Partial<FiltroCaixa>) {
    setFiltros((l) => l.map((f, j) => (j === i ? { ...f, ...parte } : f)));
  }

  async function salvar() {
    const validos = filtros.filter((f) => f.termo.trim().length > 0);
    if (validos.some((f) => f.termo.trim().length < 2)) {
      toast.error("Cada termo do filtro precisa de ao menos 2 letras.");
      return;
    }
    setSalvando(true);
    try {
      await salvarFn({
        data: {
          id: caixa?.id,
          nome: nome || null,
          email,
          usuario: usuario || null,
          senha: senha || undefined,
          imap_host: host,
          imap_port: porta,
          imap_ssl: ssl,
          pasta: pasta.trim() || "INBOX",
          usar_palavras_padrao: palavrasPadrao,
          ativo,
          filtros: validos.map((f) => ({ ...f, termo: f.termo.trim() })),
        },
      });
      await qc.invalidateQueries({ queryKey: ["codigos-caixas"] });
      toast.success(
        ativo ? "Caixa salva. A leitura começa em até 30 segundos." : "Caixa salva e pausada.",
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{caixa ? "Editar caixa vigiada" : "Vigiar uma caixa de e-mail"}</DialogTitle>
          <DialogDescription>
            O Agilliza só lê a caixa: não envia nada e não marca nada como lido. O que passar no
            filtro aparece nesta tela; o resto fica como está.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cx-nome">Nome da caixa</Label>
              <Input
                id="cx-nome"
                value={nome}
                maxLength={80}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Códigos dos bancos"
              />
            </div>
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
              <Label htmlFor="cx-usuario">
                Usuário do login <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="cx-usuario"
                autoComplete="off"
                value={usuario}
                maxLength={200}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="O próprio e-mail"
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
                placeholder={caixa?.tem_senha ? "Em branco mantém a atual" : "Senha da caixa"}
                aria-invalid={precisaSenha}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              A senha fica cifrada no servidor; ninguém consegue vê-la depois de salva.
              {precisaSenha && (
                <span className="mt-1 flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Trocar e-mail, usuário, servidor, porta ou desligar o SSL exige digitar a senha de novo.
                </span>
              )}
            </p>
          </section>

          <section className="space-y-2">
            <Label>Provedor</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROVEDORES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => escolher(p.id)}
                  aria-pressed={provedor === p.id}
                  className={cn(
                    "min-h-10 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    provedor === p.id
                      ? "border-primary bg-primary/5 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {p.rotulo}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_88px] gap-2 sm:grid-cols-[1fr_88px_140px]">
              <div className="space-y-1.5">
                <Label htmlFor="cx-host">Servidor IMAP</Label>
                <Input
                  id="cx-host"
                  value={host}
                  disabled={provedor !== "outro"}
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
                  disabled={provedor !== "outro"}
                  onChange={(e) => setPorta(Number(e.target.value.replace(/\D/g, "").slice(0, 5)) || 0)}
                />
              </div>
              <div className="col-span-2 space-y-1.5 sm:col-span-1">
                <Label htmlFor="cx-pasta">Pasta vigiada</Label>
                <Input
                  id="cx-pasta"
                  value={pasta}
                  maxLength={120}
                  onChange={(e) => setPasta(e.target.value)}
                  placeholder="INBOX"
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">
                <span className="font-medium text-foreground">Conexão segura (SSL/TLS)</span>
                <span className="block text-xs text-muted-foreground">
                  Desligada, a senha trafega sem cifra. Use só se o provedor não aceitar SSL.
                </span>
              </span>
              <Switch
                checked={ssl}
                disabled={provedor !== "outro"}
                onCheckedChange={(v) => {
                  setSsl(v);
                  if (porta === portaPadrao(!v)) setPorta(portaPadrao(v));
                }}
              />
            </label>
          </section>

          <section className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Filtro de palavras</p>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
              <span className="text-sm">
                <span className="font-medium text-foreground">Capturar e-mails de código</span>
                <span className="block text-xs text-muted-foreground">
                  Código, token, OTP, senha, verificação, autenticação…
                </span>
              </span>
              <Switch checked={palavrasPadrao} onCheckedChange={setPalavrasPadrao} />
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <b className="text-foreground">Contém</b>: o e-mail entra se casar com qualquer uma.{" "}
              <b className="text-foreground">Não contém</b>: o e-mail com o termo é ignorado (vale
              sempre, até para os de código).
            </p>
            {filtros.length > 0 && (
              <ul className="space-y-2">
                {filtros.map((f, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-lg border bg-card p-2 sm:grid-cols-[130px_150px_1fr_auto]"
                  >
                    <select
                      aria-label="Condição"
                      className={selectCls}
                      value={f.operador}
                      onChange={(e) => mudarFiltro(i, { operador: e.target.value as OperadorFiltro })}
                    >
                      <option value="contem">Contém</option>
                      <option value="nao_contem">Não contém</option>
                    </select>
                    <select
                      aria-label="Campo"
                      className={selectCls}
                      value={f.campo}
                      onChange={(e) => mudarFiltro(i, { campo: e.target.value as CampoFiltro })}
                    >
                      {CAMPOS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.rotulo}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 sm:order-last"
                      aria-label="Remover regra"
                      onClick={() => setFiltros((l) => l.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Input
                      aria-label="Termo"
                      className="col-span-3 h-9 sm:col-span-1"
                      value={f.termo}
                      maxLength={120}
                      onChange={(e) => mudarFiltro(i, { termo: e.target.value })}
                      placeholder="Ex.: boleto, @caixa.gov.br, propaganda"
                    />
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={filtros.length >= 50}
              onClick={() =>
                setFiltros((l) => [...l, { operador: "contem", campo: "assunto", termo: "", ativo: true }])
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Adicionar regra
            </Button>
            {semCaptura && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Do jeito que está, nada será capturado: ligue os e-mails de código ou crie uma regra
                "Contém".
              </p>
            )}
          </section>

          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <span className="text-sm">
              <span className="font-medium text-foreground">Leitura ligada</span>
              <span className="block text-xs text-muted-foreground">
                Desligue para pausar sem apagar a caixa nem as regras.
              </span>
            </span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={() => void salvar()}
            disabled={salvando || !email || (!caixa && !senha) || precisaSenha}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
