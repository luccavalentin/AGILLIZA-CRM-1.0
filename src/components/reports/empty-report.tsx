import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Estado3D } from "@/components/ui/estado-3d";

/** Estado vazio de relatório com sugestão de ampliar o período (ícone 3D, C00). */
export function EmptyReport({ onAmpliar }: { onAmpliar?: () => void }) {
  return (
    <Estado3D
      icone={FileSearch}
      titulo="Nenhum dado para os filtros atuais"
      descricao="Tente ampliar o período ou remover filtros para ver mais resultados."
      acao={
        onAmpliar && (
          <Button variant="outline" size="sm" onClick={onAmpliar}>
            Ampliar para este ano
          </Button>
        )
      }
    />
  );
}
