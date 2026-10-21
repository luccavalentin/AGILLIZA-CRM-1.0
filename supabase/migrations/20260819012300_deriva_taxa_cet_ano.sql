-- Deriva: a coluna foi criada direto no banco de produção, sem migração, e a
-- 20260819012330 já a atualiza. Sem isto o banco não pode ser recriado do zero
-- a partir do repositório. Em produção é inócuo (if not exists).
alter table public.simulacao_bancos add column if not exists taxa_cet_ano numeric;
