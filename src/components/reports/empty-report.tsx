import { FileSearch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Estado vazio de relatório com sugestão de ampliar o período. */
export function EmptyReport({ onAmpliar }: { onAmpliar?: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <FileSearch className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">Nenhum dado para os filtros atuais</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tente ampliar o período ou remover filtros para ver mais resultados.
        </p>
      </div>
      {onAmpliar && (
        <Button variant="outline" size="sm" onClick={onAmpliar}>
          Ampliar para este ano
        </Button>
      )}
    </Card>
  );
}
