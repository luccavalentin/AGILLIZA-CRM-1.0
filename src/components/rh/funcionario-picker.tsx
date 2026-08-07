import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarFuncionariosAtivos } from "@/lib/rh/submodulos.functions";

/** Seletor único de funcionário ativo, escopado por RLS. */
export function FuncionarioPicker({
  value,
  onChange,
  placeholder = "Selecione…",
  allowAll = false,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  allowAll?: boolean;
}) {
  const fn = useServerFn(listarFuncionariosAtivos);
  const q = useQuery({
    queryKey: ["rh-func-ativos"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
  return (
    <Select
      value={value ?? (allowAll ? "__all__" : "")}
      onValueChange={(v) => onChange(v === "__all__" ? null : v || null)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="__all__">Todos os funcionários</SelectItem>}
        {(q.data ?? []).map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.nome} · {f.numero}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
