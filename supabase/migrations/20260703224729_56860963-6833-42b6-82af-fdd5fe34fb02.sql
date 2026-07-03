
-- ===== ENUMS =====
DO $$ BEGIN CREATE TYPE public.tarefa_status AS ENUM ('aberta','em_andamento','concluida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.prioridade_op AS ENUM ('p1','p2','p3'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.demanda_status AS ENUM ('aberta','em_andamento','aguardando','concluida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== SEQUENCES =====
CREATE SEQUENCE IF NOT EXISTS public.tarefa_numero_seq;
CREATE SEQUENCE IF NOT EXISTS public.demanda_numero_seq;

-- ===== FERIADOS =====
CREATE TABLE public.feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid,
  data date NOT NULL,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriados TO authenticated;
GRANT ALL ON public.feriados TO service_role;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feriados leitura" ON public.feriados FOR SELECT TO authenticated
  USING (correspondente_id IS NULL OR correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "feriados gestao" ON public.feriados FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','correspondente','gestor']::public.app_role[]))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- ===== FUNÇÕES DE HORAS ÚTEIS =====
CREATE OR REPLACE FUNCTION public.is_dia_util(_corr uuid, _d date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT extract(isodow FROM _d) < 6
     AND NOT EXISTS (SELECT 1 FROM public.feriados f WHERE f.data=_d AND (f.correspondente_id IS NULL OR f.correspondente_id=_corr));
$$;

-- adiciona N horas úteis (seg-sex, 09:00-18:00) a partir de _inicio
CREATE OR REPLACE FUNCTION public.add_horas_uteis(_corr uuid, _inicio timestamptz, _horas numeric)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  cur timestamptz := _inicio;
  restante numeric := _horas;
  dia_ini timestamptz;
  dia_fim timestamptz;
  disp numeric;
BEGIN
  IF _horas IS NULL OR _horas <= 0 THEN RETURN _inicio; END IF;
  FOR i IN 1..2000 LOOP
    EXIT WHEN restante <= 0;
    IF public.is_dia_util(_corr, cur::date) THEN
      dia_ini := date_trunc('day', cur) + interval '9 hour';
      dia_fim := date_trunc('day', cur) + interval '18 hour';
      IF cur < dia_ini THEN cur := dia_ini; END IF;
      IF cur < dia_fim THEN
        disp := extract(epoch FROM (dia_fim - cur))/3600.0;
        IF restante <= disp THEN
          RETURN cur + (restante * interval '1 hour');
        ELSE
          restante := restante - disp;
        END IF;
      END IF;
    END IF;
    -- avança para o próximo dia às 09h
    cur := date_trunc('day', cur) + interval '1 day' + interval '9 hour';
  END LOOP;
  RETURN cur;
END; $$;

-- ===== SLA CONFIG =====
CREATE TABLE public.sla_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  tipo text NOT NULL,
  prioridade public.prioridade_op NOT NULL DEFAULT 'p2',
  horas_uteis numeric NOT NULL DEFAULT 8,
  canal_escalonamento text NOT NULL DEFAULT 'gestor',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, tipo, prioridade)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_configuracoes TO authenticated;
GRANT ALL ON public.sla_configuracoes TO service_role;
ALTER TABLE public.sla_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla leitura" ON public.sla_configuracoes FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "sla gestao" ON public.sla_configuracoes FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','correspondente','gestor']::public.app_role[]))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE TRIGGER trg_sla_updated BEFORE UPDATE ON public.sla_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== NOTIFICACAO REGRAS =====
CREATE TABLE public.notificacao_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  evento text NOT NULL,
  destinatarios text[] NOT NULL DEFAULT '{}',
  canal text NOT NULL DEFAULT 'in_app',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, evento)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacao_regras TO authenticated;
GRANT ALL ON public.notificacao_regras TO service_role;
ALTER TABLE public.notificacao_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif regras leitura" ON public.notificacao_regras FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "notif regras gestao" ON public.notificacao_regras FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','correspondente','gestor']::public.app_role[]))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE TRIGGER trg_notifregras_updated BEFORE UPDATE ON public.notificacao_regras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== TAREFAS =====
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  numero text,
  titulo text NOT NULL,
  descricao text,
  status public.tarefa_status NOT NULL DEFAULT 'aberta',
  prioridade public.prioridade_op NOT NULL DEFAULT 'p2',
  prazo timestamptz,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  responsavel_id uuid,
  criador_id uuid,
  origem text NOT NULL DEFAULT 'manual',
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

CREATE TABLE public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist_items TO authenticated;
GRANT ALL ON public.task_checklist_items TO service_role;

CREATE TABLE public.task_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_participants TO authenticated;
GRANT ALL ON public.task_participants TO service_role;

CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  corpo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  tamanho bigint,
  autor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;

CREATE TABLE public.task_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT 'muted',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_tags TO authenticated;
GRANT ALL ON public.task_tags TO service_role;

CREATE TABLE public.task_tag_links (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.task_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_tag_links TO authenticated;
GRANT ALL ON public.task_tag_links TO service_role;

CREATE TABLE public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  ator_id uuid,
  acao text NOT NULL,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_history TO authenticated;
GRANT ALL ON public.task_history TO service_role;

CREATE TABLE public.task_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid,
  task_id uuid,
  ator_id uuid,
  acao text NOT NULL,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_audit_logs TO authenticated;
GRANT ALL ON public.task_audit_logs TO service_role;

-- helper acesso tarefa
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_tarefa(_user_id uuid, _task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id=_task_id
      AND t.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.tarefas') IN ('todos','equipe')
        OR t.responsavel_id=_user_id OR t.criador_id=_user_id
        OR EXISTS (SELECT 1 FROM public.task_participants tp WHERE tp.task_id=t.id AND tp.user_id=_user_id)
      )
  );
$$;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks leitura" ON public.tasks FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.usuario_escopo_dados(auth.uid(),'operacional.tarefas') IN ('todos','equipe')
      OR responsavel_id=auth.uid() OR criador_id=auth.uid()
      OR EXISTS (SELECT 1 FROM public.task_participants tp WHERE tp.task_id=id AND tp.user_id=auth.uid())));
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.usuario_escopo_dados(auth.uid(),'operacional.tarefas') IN ('todos','equipe')
      OR responsavel_id=auth.uid() OR criador_id=auth.uid()));
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente','gestor']::public.app_role[]) OR criador_id=auth.uid()));

-- RLS filhas de task (via acesso à task)
CREATE POLICY "task_checklist all" ON public.task_checklist_items FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_tarefa(auth.uid(), task_id)) WITH CHECK (public.usuario_tem_acesso_tarefa(auth.uid(), task_id));
CREATE POLICY "task_participants all" ON public.task_participants FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_tarefa(auth.uid(), task_id)) WITH CHECK (public.usuario_tem_acesso_tarefa(auth.uid(), task_id));
CREATE POLICY "task_comments all" ON public.task_comments FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_tarefa(auth.uid(), task_id)) WITH CHECK (public.usuario_tem_acesso_tarefa(auth.uid(), task_id) AND autor_id=auth.uid());
CREATE POLICY "task_attachments all" ON public.task_attachments FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_tarefa(auth.uid(), task_id)) WITH CHECK (public.usuario_tem_acesso_tarefa(auth.uid(), task_id));
CREATE POLICY "task_tag_links all" ON public.task_tag_links FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_tarefa(auth.uid(), task_id)) WITH CHECK (public.usuario_tem_acesso_tarefa(auth.uid(), task_id));
CREATE POLICY "task_history leitura" ON public.task_history FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_tarefa(auth.uid(), task_id));
CREATE POLICY "task_history insert" ON public.task_history FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_acesso_tarefa(auth.uid(), task_id));
CREATE POLICY "task_tags leitura" ON public.task_tags FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "task_tags gestao" ON public.task_tags FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())) WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "task_audit leitura" ON public.task_audit_logs FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','correspondente','gestor']::public.app_role[]));
CREATE POLICY "task_audit insert" ON public.task_audit_logs FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- numeração/updated_at tarefa
CREATE OR REPLACE FUNCTION public.task_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' AND (NEW.numero IS NULL OR NEW.numero='') THEN
    NEW.numero := 'TAR-' || lpad(nextval('public.tarefa_numero_seq')::text, 6, '0');
  END IF;
  IF NEW.status='concluida' AND NEW.concluida_em IS NULL THEN NEW.concluida_em := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_task_before_write BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.task_before_write();

-- ===== DEMANDAS =====
CREATE TABLE public.demandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  numero text,
  tipo text NOT NULL DEFAULT 'geral',
  titulo text NOT NULL,
  descricao text,
  status public.demanda_status NOT NULL DEFAULT 'aberta',
  prioridade public.prioridade_op NOT NULL DEFAULT 'p2',
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  responsavel_id uuid,
  criador_id uuid,
  origem text NOT NULL DEFAULT 'manual',
  sla_horas numeric,
  sla_inicio timestamptz NOT NULL DEFAULT now(),
  prazo_sla timestamptz,
  escalonada boolean NOT NULL DEFAULT false,
  escalonada_em timestamptz,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandas TO authenticated;
GRANT ALL ON public.demandas TO service_role;

CREATE TABLE public.demanda_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (demanda_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_participantes TO authenticated;
GRANT ALL ON public.demanda_participantes TO service_role;

CREATE TABLE public.demanda_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  ator_id uuid,
  acao text NOT NULL,
  responsavel_anterior_id uuid,
  responsavel_novo_id uuid,
  motivo text,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_historico TO authenticated;
GRANT ALL ON public.demanda_historico TO service_role;

CREATE TABLE public.demanda_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  corpo text NOT NULL,
  visivel_cliente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_mensagens TO authenticated;
GRANT ALL ON public.demanda_mensagens TO service_role;

CREATE TABLE public.demanda_leituras (
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (demanda_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_leituras TO authenticated;
GRANT ALL ON public.demanda_leituras TO service_role;

CREATE TABLE public.demanda_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  tamanho bigint,
  autor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_anexos TO authenticated;
GRANT ALL ON public.demanda_anexos TO service_role;

-- helper acesso demanda
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_demanda(_user_id uuid, _dem_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id=_dem_id
      AND d.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.demandas') IN ('todos','equipe')
        OR d.responsavel_id=_user_id OR d.criador_id=_user_id
        OR EXISTS (SELECT 1 FROM public.demanda_participantes dp WHERE dp.demanda_id=d.id AND dp.user_id=_user_id)
      )
  );
$$;

ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demandas leitura" ON public.demandas FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.usuario_escopo_dados(auth.uid(),'operacional.demandas') IN ('todos','equipe')
      OR responsavel_id=auth.uid() OR criador_id=auth.uid()
      OR EXISTS (SELECT 1 FROM public.demanda_participantes dp WHERE dp.demanda_id=id AND dp.user_id=auth.uid())));
CREATE POLICY "demandas insert" ON public.demandas FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "demandas update" ON public.demandas FOR UPDATE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.usuario_escopo_dados(auth.uid(),'operacional.demandas') IN ('todos','equipe')
      OR responsavel_id=auth.uid() OR criador_id=auth.uid()
      OR EXISTS (SELECT 1 FROM public.demanda_participantes dp WHERE dp.demanda_id=id AND dp.user_id=auth.uid())));
CREATE POLICY "demandas delete" ON public.demandas FOR DELETE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente','gestor']::public.app_role[]) OR criador_id=auth.uid()));

CREATE POLICY "dem_part all" ON public.demanda_participantes FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id)) WITH CHECK (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id));
CREATE POLICY "dem_hist leitura" ON public.demanda_historico FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id));
CREATE POLICY "dem_hist insert" ON public.demanda_historico FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id));
CREATE POLICY "dem_msg all" ON public.demanda_mensagens FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id)) WITH CHECK (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id) AND autor_id=auth.uid());
CREATE POLICY "dem_leit all" ON public.demanda_leituras FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id) AND user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY "dem_anexo all" ON public.demanda_anexos FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id)) WITH CHECK (public.usuario_tem_acesso_demanda(auth.uid(), demanda_id));

-- numeração + SLA demanda
CREATE OR REPLACE FUNCTION public.demanda_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_horas numeric;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero='' THEN
      NEW.numero := 'DEM-' || lpad(nextval('public.demanda_numero_seq')::text, 6, '0');
    END IF;
    IF NEW.sla_inicio IS NULL THEN NEW.sla_inicio := now(); END IF;
    IF NEW.sla_horas IS NULL THEN
      SELECT horas_uteis INTO v_horas FROM public.sla_configuracoes
        WHERE correspondente_id=NEW.correspondente_id AND tipo=NEW.tipo AND prioridade=NEW.prioridade AND ativo LIMIT 1;
      NEW.sla_horas := COALESCE(v_horas, CASE NEW.prioridade WHEN 'p1' THEN 4 WHEN 'p2' THEN 8 ELSE 24 END);
    END IF;
    IF NEW.prazo_sla IS NULL THEN
      NEW.prazo_sla := public.add_horas_uteis(NEW.correspondente_id, NEW.sla_inicio, NEW.sla_horas);
    END IF;
  END IF;
  IF NEW.status='concluida' AND NEW.concluida_em IS NULL THEN NEW.concluida_em := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_demanda_before_write BEFORE INSERT OR UPDATE ON public.demandas FOR EACH ROW EXECUTE FUNCTION public.demanda_before_write();

-- ===== NOTIFICAÇÃO helper =====
CREATE OR REPLACE FUNCTION public.emitir_notificacao(_user_id uuid, _corr uuid, _tipo text, _titulo text, _corpo text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notificacoes (user_id, correspondente_id, tipo, titulo, corpo, link)
  VALUES (_user_id, _corr, _tipo, _titulo, _corpo, _link);
END; $$;

-- notifica na criação/transferência da demanda
CREATE OR REPLACE FUNCTION public.demanda_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.demanda_historico (demanda_id, ator_id, acao, responsavel_novo_id, detalhe)
  VALUES (NEW.id, NEW.criador_id, 'criada', NEW.responsavel_id, NEW.titulo);
  PERFORM public.emitir_notificacao(NEW.responsavel_id, NEW.correspondente_id, 'demanda.criada',
    'Nova demanda: ' || NEW.titulo, 'Você foi designado responsável.', '/operacional/demandas/' || NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_demanda_after_insert AFTER INSERT ON public.demandas FOR EACH ROW EXECUTE FUNCTION public.demanda_after_insert();

-- escalonamento por SLA estourado
CREATE OR REPLACE FUNCTION public.demanda_escalar_vencidas(_corr uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD; v_gestor uuid; n int := 0;
BEGIN
  FOR r IN SELECT * FROM public.demandas
    WHERE correspondente_id=_corr AND status NOT IN ('concluida','cancelada')
      AND escalonada=false AND prazo_sla IS NOT NULL AND prazo_sla < now()
  LOOP
    SELECT ur.user_id INTO v_gestor FROM public.user_roles ur
      JOIN public.profiles p ON p.id=ur.user_id
      WHERE p.correspondente_id=_corr AND ur.role IN ('gestor','correspondente') LIMIT 1;
    UPDATE public.demandas SET escalonada=true, escalonada_em=now(),
      responsavel_id=COALESCE(v_gestor, responsavel_id) WHERE id=r.id;
    INSERT INTO public.demanda_historico (demanda_id, ator_id, acao, responsavel_anterior_id, responsavel_novo_id, detalhe)
      VALUES (r.id, NULL, 'escalonada', r.responsavel_id, v_gestor, 'SLA estourado');
    PERFORM public.emitir_notificacao(COALESCE(v_gestor, r.responsavel_id), _corr, 'demanda.sla_estourado',
      'SLA estourado: ' || r.titulo, 'Demanda escalonada automaticamente.', '/operacional/demandas/' || r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

-- ===== REALTIME =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demanda_mensagens;

-- ===== PERMISSÕES (módulos) =====
INSERT INTO public.permissions (nivel_acesso_id, modulo, acao, permitido, escopo_dados)
SELECT al.id, m.modulo, m.acao, true, 'proprios'::public.escopo_dados
FROM public.access_levels al
CROSS JOIN (VALUES
  ('operacional.tarefas','view'),('operacional.tarefas','create'),('operacional.tarefas','edit'),('operacional.tarefas','atribuir'),
  ('operacional.demandas','view'),('operacional.demandas','create'),('operacional.demandas','transferir'),('operacional.demandas','encerrar')
) AS m(modulo, acao)
ON CONFLICT DO NOTHING;
