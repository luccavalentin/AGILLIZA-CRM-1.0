ALTER TYPE public.financial_recorrencia ADD VALUE IF NOT EXISTS 'parcelado';

ALTER TABLE public.financial_payables ADD COLUMN IF NOT EXISTS parcelas integer;
ALTER TABLE public.financial_payables ADD COLUMN IF NOT EXISTS parcela_numero integer;
ALTER TABLE public.financial_receivables ADD COLUMN IF NOT EXISTS parcelas integer;
ALTER TABLE public.financial_receivables ADD COLUMN IF NOT EXISTS parcela_numero integer;