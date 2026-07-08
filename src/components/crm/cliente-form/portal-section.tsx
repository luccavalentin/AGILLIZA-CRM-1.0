import { KeyRound, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function PortalSection({
  temId,
  portal,
  portalSalvando,
  alternarPortal,
}: {
  temId: boolean;
  portal: boolean;
  portalSalvando: boolean;
  alternarPortal: (ativo: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-primary" /> Acesso ao Portal do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          O login do cliente em /portal é por documento + data de nascimento. Nenhuma senha é
          criada.
          {!temId && (
            <span className="mt-1 block text-xs">
              Salve o cadastro primeiro para habilitar o acesso.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {portalSalvando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <Switch
            id="portal"
            checked={portal}
            onCheckedChange={alternarPortal}
            disabled={!temId || portalSalvando}
          />
          <Label htmlFor="portal">Habilitar acesso</Label>
        </div>
      </CardContent>
    </Card>
  );
}
