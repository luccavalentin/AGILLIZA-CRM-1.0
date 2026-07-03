-- Adiciona papel 'financeiro' ao enum de papéis (necessário para escopo financeiro)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';