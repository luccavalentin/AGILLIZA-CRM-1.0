ALTER TABLE public.matricula_solicitacoes
  ADD COLUMN IF NOT EXISTS corretor text,
  ADD COLUMN IF NOT EXISTS cliente text,
  ADD COLUMN IF NOT EXISTS data_pagto_reembolso date;