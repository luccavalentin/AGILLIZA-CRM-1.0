
CREATE TABLE public.consultor_ia_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  correspondente_id uuid NULL,
  criado_por uuid NULL,
  atualizado_por uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultor_ia_base TO authenticated;
GRANT ALL ON public.consultor_ia_base TO service_role;
ALTER TABLE public.consultor_ia_base ENABLE ROW LEVEL SECURITY;

CREATE INDEX consultor_ia_base_busca_idx ON public.consultor_ia_base
  USING gin (to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(conteudo,'')));
CREATE INDEX consultor_ia_base_categoria_idx ON public.consultor_ia_base (categoria);
CREATE INDEX consultor_ia_base_tags_idx ON public.consultor_ia_base USING gin (tags);

CREATE POLICY "base_select_interno" ON public.consultor_ia_base
  FOR SELECT TO authenticated
  USING (
    correspondente_id IS NULL
    OR correspondente_id = (SELECT p.correspondente_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "base_admin_insert" ON public.consultor_ia_base
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::app_role[]));

CREATE POLICY "base_admin_update" ON public.consultor_ia_base
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::app_role[]));

CREATE POLICY "base_admin_delete" ON public.consultor_ia_base
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::app_role[]));

CREATE TRIGGER consultor_ia_base_updated_at
  BEFORE UPDATE ON public.consultor_ia_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.consultor_ia_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NULL,
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  titulo text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultor_ia_conversas TO authenticated;
GRANT ALL ON public.consultor_ia_conversas TO service_role;
ALTER TABLE public.consultor_ia_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversas_proprias" ON public.consultor_ia_conversas
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE INDEX consultor_ia_conversas_usuario_idx ON public.consultor_ia_conversas (usuario_id, updated_at DESC);

CREATE TRIGGER consultor_ia_conversas_updated_at
  BEFORE UPDATE ON public.consultor_ia_conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.consultor_ia_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.consultor_ia_conversas(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('usuario','assistente')),
  conteudo text NOT NULL,
  fontes_usadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  sem_resposta boolean NOT NULL DEFAULT false,
  avaliacao text NULL CHECK (avaliacao IN ('util','nao_util')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultor_ia_mensagens TO authenticated;
GRANT ALL ON public.consultor_ia_mensagens TO service_role;
ALTER TABLE public.consultor_ia_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagens_proprias" ON public.consultor_ia_mensagens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultor_ia_conversas c WHERE c.id = conversa_id AND c.usuario_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultor_ia_conversas c WHERE c.id = conversa_id AND c.usuario_id = auth.uid()));

CREATE INDEX consultor_ia_mensagens_conversa_idx ON public.consultor_ia_mensagens (conversa_id, created_at);

CREATE TABLE public.consultor_ia_sugestoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NULL,
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  pergunta text NOT NULL,
  observacao text NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','resolvida','descartada')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultor_ia_sugestoes TO authenticated;
GRANT ALL ON public.consultor_ia_sugestoes TO service_role;
ALTER TABLE public.consultor_ia_sugestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sugestoes_insert" ON public.consultor_ia_sugestoes
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "sugestoes_select" ON public.consultor_ia_sugestoes
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::app_role[]));

CREATE POLICY "sugestoes_admin_update" ON public.consultor_ia_sugestoes
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::app_role[]));

INSERT INTO public.consultor_ia_base (categoria, titulo, conteudo, tags) VALUES
(
  'Bradesco',
  'Fluxo de simulação para proposta no Bradesco',
  E'No Bradesco a proposta nasce sempre de uma simulação processada.\n\n- Cada envio ao banco deve usar uma **simulação nova**. Nunca reaproveitar uma simulação já processada para um reenvio: gere uma nova simulação e envie a partir dela.\n- Retornos transitórios de status (por exemplo "P"/"E") não devem ser tratados como erro definitivo — o status é atualizado na sincronização seguinte.\n\n---\n_Conteúdo inicial — revisar e validar antes de considerar definitivo._',
  ARRAY['bradesco','simulacao','proposta','reenvio']
),
(
  'Santander',
  'Home Equity no Santander — disponibilidade por convênio',
  E'A oferta de **Home Equity** no Santander pode não estar disponível dependendo do convênio vigente do correspondente.\n\nAntes de ofertar o produto ao cliente, confirme a disponibilidade com o financeiro / HomeFin.\n\n---\n_Conteúdo inicial — revisar e validar antes de considerar definitivo._',
  ARRAY['santander','home equity','convenio','produto']
),
(
  'Duvidas_Frequentes',
  'Diferença entre SAC e PRICE',
  E'**SAC (Sistema de Amortização Constante)**: a parcela de amortização é fixa e os juros incidem sobre o saldo devedor, que cai mais rápido. As prestações começam mais altas e diminuem ao longo do contrato. Costuma resultar em menos juros totais.\n\n**PRICE (Tabela Price)**: as prestações são fixas em termos nominais (antes da correção do indexador). No início a maior parte da parcela é juros e a amortização é pequena, crescendo com o tempo. A prestação inicial é menor que no SAC, o que pode ajudar na comprovação de renda, mas o total de juros tende a ser maior.\n\nNa prática: SAC costuma exigir maior renda inicial; PRICE facilita o enquadramento de renda com parcela inicial menor.\n\n---\n_Conteúdo inicial — revisar e validar antes de considerar definitivo._',
  ARRAY['sac','price','amortizacao','parcela','juros']
),
(
  'FGTS',
  'Regras gerais de uso do FGTS no financiamento habitacional (SFH)',
  E'Pontos gerais de mercado sobre o uso do FGTS na compra de imóvel residencial dentro do SFH:\n\n- O imóvel deve ser **residencial urbano**, destinado à moradia do titular, e localizado no município onde ele trabalha ou reside.\n- Existe **carência/regra de intervalo** entre usos do FGTS para aquisição de imóvel.\n- Há **limite de valor de avaliação do imóvel** para enquadramento no SFH — o teto é definido por norma e muda ao longo do tempo.\n- O titular normalmente não pode ser proprietário de outro imóvel residencial no mesmo município/região e não pode ter financiamento habitacional ativo no SFH.\n\n**Atenção:** valores, tetos e prazos de carência mudam por norma. Sempre confirmar o número vigente com o financeiro/jurídico antes de informar ao cliente.\n\n---\n_Conteúdo inicial — revisar e validar antes de considerar definitivo. Requer validação da equipe jurídica/compliance._',
  ARRAY['fgts','sfh','carencia','teto','habitacional']
);
