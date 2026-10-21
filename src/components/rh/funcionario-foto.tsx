/**
 * Avatar do funcionário com upload direto na ficha.
 * O arquivo vai para o bucket privado `rh-documentos` e o caminho é salvo
 * em `rh_funcionarios.foto_url`; a exibição usa URL assinada temporária.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { salvarFotoFuncionario } from "@/lib/rh/funcionarios.functions";
import { gerarUrlAssinada } from "@/lib/rh/submodulos.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { enviarArquivoRh, extensaoDe } from "@/lib/rh/arquivos";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function FuncionarioFoto({
  funcionarioId,
  nome,
  fotoPath,
}: {
  funcionarioId: string;
  nome: string;
  fotoPath: string | null;
}) {
  const qc = useQueryClient();
  const fnSalvar = useServerFn(salvarFotoFuncionario);
  const fnUrl = useServerFn(gerarUrlAssinada);
  const [path, setPath] = useState<string | null>(fotoPath);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!path) {
      setUrl(null);
      return;
    }
    fnUrl({ data: { path, expira_em: 3600 } })
      .then((r) => vivo && setUrl(r.url))
      .catch(() => vivo && setUrl(null));
    return () => {
      vivo = false;
    };
  }, [path, fnUrl]);

  const enviar = useMutation({
    mutationFn: async (file: File) => {
      const novo = await enviarArquivoRh(
        `fotos/${funcionarioId}-${Date.now()}.${extensaoDe(file.name, "jpg")}`,
        file,
        { contentType: file.type, upsert: true },
      );
      await fnSalvar({ data: { id: funcionarioId, foto_url: novo } });
      return novo;
    },
    onSuccess: (novo) => {
      setPath(novo);
      toast.success("Foto atualizada.");
      qc.invalidateQueries({ queryKey: ["rh-funcionario", funcionarioId] });
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao enviar a foto.")),
  });

  // Sem try/catch: o ConfirmDelete mostra o erro e continua aberto.
  async function excluirFoto() {
    await fnSalvar({ data: { id: funcionarioId, foto_url: null } });
    setPath(null);
    toast.success("Foto excluída.");
    qc.invalidateQueries({ queryKey: ["rh-funcionario", funcionarioId] });
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-16 border border-border">
        {url ? <AvatarImage src={url} alt={nome} /> : null}
        <AvatarFallback className="text-sm font-semibold">{iniciais(nome)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <label>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) enviar.mutate(file);
            }}
          />
          <Button asChild size="sm" variant="outline" disabled={enviar.isPending}>
            <span className="cursor-pointer">
              {enviar.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="mr-2 h-3.5 w-3.5" />
              )}
              {path ? "Trocar foto" : "Enviar foto"}
            </span>
          </Button>
        </label>
        {path && (
          <ConfirmDelete
            titulo="Excluir a foto?"
            descricao={`A foto de ${nome} é apagada.`}
            onConfirm={excluirFoto}
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
