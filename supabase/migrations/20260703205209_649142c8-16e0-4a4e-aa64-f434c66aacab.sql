CREATE TYPE public.simulacao_status AS ENUM ('rascunho','enviando','simulada','parcialmente_simulada','erro_banco','expirada','cancelada','promovida');
CREATE TYPE public.simulacao_tipo AS ENUM ('simplificada','completa');
CREATE TYPE public.simulacao_banco_status AS ENUM ('aguardando','simulada','erro','expirada');
CREATE SEQUENCE public.simulacao_numero_seq START 1;