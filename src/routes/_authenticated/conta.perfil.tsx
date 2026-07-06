import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMinhaSessao, atualizarMeuPerfil } from "@/lib/session.functions";

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

  const iniciais = (nome || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <UserRound className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Meu perfil</h1>
      </div>

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
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="foto">URL da foto</Label>
                  <Input
                    id="foto"
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                    placeholder="https://…"
                  />
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
    </div>
  );
}
