import { queryOptions } from "@tanstack/react-query";
import { obterProposta } from "./propostas.functions";

export const propostaQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["proposta", id],
    queryFn: () => obterProposta({ data: { id } }),
  });
