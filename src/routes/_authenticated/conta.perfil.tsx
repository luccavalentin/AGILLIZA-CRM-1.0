import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserRound, Loader2, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMinhaSessao, atualizarMeuPerfil } from "@/lib/session.functions";
import { supabase } from "@/integrations/supabase/client";
import { ChatSoundSetting } from "@/components/shared/chat-sound-setting";

// URL assinada de longa duração (~10 anos) para exibir a foto de um bucket privado.
const URL_EXPIRACAO_SEGUNDOS = 60 * 60 * 24 * 365 * 10;

export const Route = createFileRoute("/_authenticated/conta/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Agilliza" }] }),
  component: Pagina,
});

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

  async function enviarFoto(file: File) {
    const userId = sessao?.profile?.id;
    if (!userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setEnviandoFoto(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
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
      setNome(sessao.profile.nome ?? "");
      setTelefone(sessao.profile.telefone ?? "");
      setFotoUrl(sessao.profile.foto_url ?? "");
    }
  }, [sessao?.profile]);

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { nome, telefone, foto_url: fotoUrl } }),
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: ["minha-sessao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const iniciais = (nome || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Minha conta"
        icon={<UserRound className="h-5 w-5" />}
        titulo="Meu perfil"
        descricao="Dados pessoais, foto, senha e preferências de som."
      />


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={fotoUrl || undefined} alt={nome} />
                  <AvatarFallback>{iniciais}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Label>Foto de perfil</Label>
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
                  <p className="text-xs text-muted-foreground">JPG ou PNG, até 5 MB.</p>
                </div>
              </div>


              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" value={sessao?.profile?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">
                  O e-mail de acesso não pode ser alterado por aqui.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => salvar.mutate()}
                  disabled={salvar.isPending || nome.trim().length < 2}
                >
                  {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar alterações
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Alterar senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input
              id="nova-senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirma-senha">Confirmar nova senha</Label>
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
          <div className="flex justify-end">
            <Button onClick={alterarSenha} disabled={!podeSalvarSenha || salvandoSenha}>
              {salvandoSenha && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>

      <ChatSoundSetting />
    </div>
  );
}
