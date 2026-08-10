import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserRound, Loader2, Lock, Upload, ShieldCheck, Save, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMinhaSessao, atualizarMeuPerfil, atualizarMeuEmail } from "@/lib/session.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminHero } from "@/components/admin/admin-hero";
import { ChatSoundSetting } from "@/components/shared/chat-sound-setting";
import { otimizarImagem } from "@/lib/imagem";

// URL assinada de longa duração para exibir a foto do bucket privado.
const URL_EXPIRACAO_SEGUNDOS = 60 * 60 * 24 * 365 * 10;

export const Route = createFileRoute("/_authenticated/conta/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Agilliza" }] }),
  component: Pagina,
});

function Secao({
  numero,
  icon,
  titulo,
  descricao,
  children,
}: {
  numero: string;
  icon: ReactNode;
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.18em] text-primary/70">
              {numero}
            </span>
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {titulo}
            </h2>
          </div>
          <p className="truncate text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function Pagina() {
  const qc = useQueryClient();
  const sessaoFn = useServerFn(getMinhaSessao);
  const salvarFn = useServerFn(atualizarMeuPerfil);

  const { data: sessao, isLoading } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
  });

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [salvo, setSalvo] = useState({ nome: "", telefone: "", fotoUrl: "" });

  async function enviarFoto(file: File) {
    const userId = sessao?.profile?.id;
    if (!userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    setEnviandoFoto(true);
    try {
      const imagem = await otimizarImagem(file);
      const ext = imagem.name.split(".").pop()?.toLowerCase() || "webp";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, imagem, {
        upsert: true,
        contentType: imagem.type,
        cacheControl: "31536000",
      });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, URL_EXPIRACAO_SEGUNDOS);
      if (signErr || !signed) throw signErr ?? new Error("Falha ao gerar URL.");
      setFotoUrl(signed.signedUrl);
      toast.success("Foto enviada. Clique em Salvar alterações para confirmar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      setEnviandoFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    if (sessao?.profile) {
      const carregado = {
        nome: sessao.profile.nome ?? "",
        telefone: sessao.profile.telefone ?? "",
        fotoUrl: sessao.profile.foto_url ?? "",
      };
      setNome(carregado.nome);
      setTelefone(carregado.telefone);
      setFotoUrl(carregado.fotoUrl);
      setSalvo(carregado);
    }
  }, [sessao?.profile]);

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { nome, telefone, foto_url: fotoUrl } }),
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      setSalvo({ nome, telefone, fotoUrl });
      qc.invalidateQueries({ queryKey: ["minha-sessao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alterado = useMemo(
    () => nome !== salvo.nome || telefone !== salvo.telefone || fotoUrl !== salvo.fotoUrl,
    [nome, telefone, fotoUrl, salvo],
  );

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const podeSalvarSenha = novaSenha.length >= 8 && novaSenha === confirmaSenha;

  async function alterarSenha() {
    if (!podeSalvarSenha) return;
    setSalvandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      toast.success("Senha alterada com sucesso.");
      setNovaSenha("");
      setConfirmaSenha("");
    } catch {
      toast.error("Não foi possível alterar a senha. Faça login novamente e tente de novo.");
    } finally {
      setSalvandoSenha(false);
    }
  }

  const emailAtual = sessao?.profile?.email ?? "";
  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const sincronizarEmailFn = useServerFn(atualizarMeuEmail);
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail.trim());
  const podeSalvarEmail =
    emailValido && novoEmail.trim().toLowerCase() !== emailAtual.toLowerCase();

  useEffect(() => {
    setNovoEmail(emailAtual);
  }, [emailAtual]);

  async function alterarEmail() {
    if (!podeSalvarEmail) return;
    setSalvandoEmail(true);
    try {
      const alvo = novoEmail.trim();
      const { error } = await supabase.auth.updateUser(
        { email: alvo },
        { emailRedirectTo: window.location.origin + "/conta/perfil" },
      );
      if (error) throw error;
      await sincronizarEmailFn({ data: { email: alvo } });
      qc.invalidateQueries({ queryKey: ["minha-sessao"] });
      toast.success(
        "Enviamos um link de confirmação para o novo e-mail. Confirme para concluir a alteração.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o e-mail.");
    } finally {
      setSalvandoEmail(false);
    }
  }

  const iniciais = (nome || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-28 md:p-6">
      <AdminHero
        secao="Minha conta"
        icon={<UserRound className="h-5 w-5" />}
        titulo="Meu perfil"
        descricao="Dados pessoais, foto, senha e preferências de som."
        acoes={
          <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-3">
            <Avatar className="size-8">
              <AvatarImage src={fotoUrl || undefined} alt={nome} />
              <AvatarFallback className="text-[11px]">{iniciais}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold text-foreground">{nome || "—"}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {sessao?.profile?.email ?? ""}
              </p>
            </div>
          </div>
        }
      />

      <Secao
        numero="01"
        icon={<UserRound className="size-5" />}
        titulo="Dados pessoais"
        descricao="Identificação exibida em todo o sistema."
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/10">
                <AvatarImage src={fotoUrl || undefined} alt={nome} />
                <AvatarFallback className="text-lg">{iniciais}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Foto de perfil</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) enviarFoto(f);
                  }}
                />
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={enviandoFoto}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {enviandoFoto ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Enviar foto
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">JPG ou PNG, até 5 MB.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nome" className="text-xs font-medium text-muted-foreground">
                  Nome completo
                </Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                  E-mail
                </Label>
                <Input id="email" value={emailAtual} disabled />
                <p className="text-[11px] text-muted-foreground">
                  Para trocar o e-mail de acesso, use a seção "E-mail de acesso" abaixo.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-xs font-medium text-muted-foreground">
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>
        )}
      </Secao>

      <Secao
        numero="02"
        icon={<Mail className="size-5" />}
        titulo="E-mail de acesso"
        descricao="Altere o e-mail usado para entrar no sistema."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="novo-email" className="text-xs font-medium text-muted-foreground">
              Novo e-mail
            </Label>
            <Input
              id="novo-email"
              type="email"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            {novoEmail.trim().length > 0 && !emailValido && (
              <p className="text-xs text-destructive">Informe um e-mail válido.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Você receberá um link de confirmação no novo endereço.
            </p>
            <Button onClick={alterarEmail} disabled={!podeSalvarEmail || salvandoEmail}>
              {salvandoEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar e-mail
            </Button>
          </div>
        </div>
      </Secao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao
          numero="03"
          icon={<Lock className="size-5" />}
          titulo="Segurança"
          descricao="Defina uma nova senha de acesso."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nova-senha" className="text-xs font-medium text-muted-foreground">
                  Nova senha
                </Label>
                <Input
                  id="nova-senha"
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirma-senha"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Confirmar nova senha
                </Label>
                <Input
                  id="confirma-senha"
                  type="password"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                />
                {confirmaSenha.length > 0 && novaSenha !== confirmaSenha && (
                  <p className="text-xs text-destructive">As senhas não coincidem.</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Use uma senha forte e exclusiva.
              </p>
              <Button onClick={alterarSenha} disabled={!podeSalvarSenha || salvandoSenha}>
                {salvandoSenha && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar senha
              </Button>
            </div>
          </div>
        </Secao>

        <ChatSoundSetting />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`size-2 rounded-full ${alterado ? "bg-amber-500" : "bg-emerald-500"}`}
            />
            {alterado ? "Alterações não salvas" : "Tudo salvo"}
          </span>
          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || nome.trim().length < 2 || !alterado}
          >
            {salvar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
