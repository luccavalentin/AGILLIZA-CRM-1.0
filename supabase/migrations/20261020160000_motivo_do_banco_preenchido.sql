-- Motivo do banco nas propostas já respondidas (20/10/2026).
-- O envio/acompanhamento passou a gravar o motivo do desfecho (`motivoDoBanco`); as linhas
-- que já tinham resposta ficaram com `mensagem_banco` vazio. Mesmo formato do código:
-- "514 - ANALISE AUTOMATICA DESFAVORAVEL" → "514 – Analise automatica desfavoravel".
update public.proposta_bancos pb
   set mensagem_banco = case
         when x.cod ~ '^\d+\s*[-–]\s*.+$' then
           substring(x.cod from '^(\d+)') || ' – ' ||
           upper(left(lower(regexp_replace(x.cod, '^\d+\s*[-–]\s*', '')), 1)) ||
           substr(lower(regexp_replace(x.cod, '^\d+\s*[-–]\s*', '')), 2)
         else upper(left(lower(x.cod), 1)) || substr(lower(x.cod), 2)
       end,
       updated_at = now()
  from (select id, regexp_replace(trim(raw_response ->> 'codigoSituacaoBanco'), '\s+', ' ', 'g') cod
          from public.proposta_bancos) x
 where x.id = pb.id
   and pb.mensagem_banco is null
   and length(coalesce(x.cod, '')) >= 3
   and pb.situacao_banco in ('recusado', 'condicionado', 'aprovado');
